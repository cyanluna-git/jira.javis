import os
import json
import time
import base64
import requests
import psycopg2
from psycopg2.extras import Json
from datetime import datetime

# --- Configuration ---
def load_env(env_path=".env"):
    config = {}
    try:
        if not os.path.exists(env_path):
            # Try finding .env in root if running from scripts/
            env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")
            
        with open(env_path, "r") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                if "=" in line:
                    key, value = line.split("=", 1)
                    config[key.strip()] = value.strip()
    except FileNotFoundError:
        print(f"⚠️ Warning: .env file not found at {env_path}")
    return config

config = load_env()
JIRA_URL = config.get("JIRA_URL")
JIRA_EMAIL = config.get("JIRA_EMAIL")
JIRA_TOKEN = config.get("JIRA_TOKEN")

# DB Config
DB_HOST = "localhost"
DB_PORT = config.get("DB_PORT", "5432")
DB_NAME = "javis_brain"
DB_USER = "javis"
DB_PASS = config.get("JAVIS_DB_PASSWORD", "javis_password")

# Projects to fetch
TARGET_PROJECTS = ["EUV", "ASP", "PSSM"]

if not JIRA_URL or not JIRA_TOKEN:
    print("❌ Error: JIRA_URL or JIRA_TOKEN missing in .env")
    exit(1)

# --- Database Setup ---
def get_db_connection():
    return psycopg2.connect(
        host=DB_HOST,
        port=DB_PORT,
        dbname=DB_NAME,
        user=DB_USER,
        password=DB_PASS
    )

def init_db():
    conn = get_db_connection()
    cur = conn.cursor()
    
    cur.execute("""
        CREATE TABLE IF NOT EXISTS jira_issues (
            key TEXT PRIMARY KEY,
            project TEXT,
            summary TEXT,
            status TEXT,
            created_at TIMESTAMP,
            updated_at TIMESTAMP,
            raw_data JSONB,
            last_synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    """)
    
    cur.execute("""
        CREATE INDEX IF NOT EXISTS idx_jira_issues_raw_data ON jira_issues USING GIN (raw_data);
    """)
    
    conn.commit()
    cur.close()
    conn.close()
    print("✅ Database schema initialized.")

# --- Jira API Client ---
def fetch_issues(project_key, next_token=None, batch_size=50):
    url = f"{JIRA_URL}/rest/api/3/search/jql"
    auth = (JIRA_EMAIL, JIRA_TOKEN)
    
    jql = f"project = {project_key} ORDER BY created ASC"
    
    payload = {
        "jql": jql,
        "maxResults": batch_size,
        "fields": [
            "key", "summary", "status", "created", "updated", 
            "description", "project", "priority", "assignee", 
            "creator", "reporter", "issuetype", "components",
            "versions", "fixVersions", "environment", "resolution",
            "resolutiondate", "duedate", "labels", "attachment", 
            "comment", "issuelinks", "worklog", "subtasks"
        ]
    }
    
    if next_token:
        payload["nextPageToken"] = next_token
    
    retries = 0
    max_retries = 5
    
    while retries < max_retries:
        try:
            res = requests.post(url, auth=auth, json=payload, timeout=30)
            
            if res.status_code == 429:
                wait_time = int(res.headers.get("Retry-After", 5)) + (2 ** retries)
                print(f"⏳ Rate Limit (429). Waiting {wait_time}s...")
                time.sleep(wait_time)
                retries += 1
                continue
                
            res.raise_for_status()
            return res.json()
            
        except requests.exceptions.RequestException as e:
            print(f"❌ API Error: {e}")
            if hasattr(e, 'response') and e.response is not None:
                 print(f"   Response: {e.response.text[:200]}")
            
            # Simple retry for 5xx errors
            if hasattr(e, 'response') and e.response is not None and e.response.status_code >= 500:
                time.sleep(5)
                retries += 1
                continue
            
            return None
    return None

def save_issue(conn, issue):
    cur = conn.cursor()
    
    key = issue.get('key')
    if not key:
        return # Skip if no key
        
    fields = issue.get('fields', {})
    project = fields.get('project', {}).get('key', '')
    summary = fields.get('summary', '')
    status = fields.get('status', {}).get('name', '')
    
    created = fields.get('created')
    updated = fields.get('updated')
    
    # Upsert Query
    query = """
        INSERT INTO jira_issues (key, project, summary, status, created_at, updated_at, raw_data, last_synced_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s, NOW())
        ON CONFLICT (key) DO UPDATE SET
            summary = EXCLUDED.summary,
            status = EXCLUDED.status,
            updated_at = EXCLUDED.updated_at,
            raw_data = EXCLUDED.raw_data,
            last_synced_at = NOW();
    """
    
    cur.execute(query, (key, project, summary, status, created, updated, Json(issue)))

def sync_project(project_key):
    print(f"\n🚀 Syncing Project: {project_key}")
    conn = get_db_connection()
    
    next_token = None
    batch_size = 50
    total_synced = 0
    
    while True:
        data = fetch_issues(project_key, next_token, batch_size)
        if not data or 'issues' not in data:
            break
            
        issues = data['issues']
        if not issues:
            break
            
        for issue in issues:
            save_issue(conn, issue)
            
        conn.commit()
        count = len(issues)
        total_synced += count
        print(f"  - Saved {count} issues (Total: {total_synced})")
        
        # Pagination Logic
        next_token = data.get('nextPageToken')
        if not next_token:
            print("    ✅ End of results (No next token).")
            break

        time.sleep(1) # Be nice to API
        
    conn.close()
    print(f"✅ Completed {project_key}: {total_synced} issues synced.")

def main():
    print("🔄 Starting Jira -> PostgreSQL Mirroring...")
    
    try:
        init_db()
    except Exception as e:
        print(f"❌ Database connection failed: {e}")
        print("   Did you start the docker container? (docker compose up -d)")
        exit(1)

    for project in TARGET_PROJECTS:
        sync_project(project)
        
    print("\n🎉 All projects synced successfully!")

if __name__ == "__main__":
    main()
