import sqlite3
import urllib.request
import urllib.error
import base64
import json
import ssl
import time
import os
import random

# --- Configuration ---
def load_env(env_path=".env"):
    """Simple .env parser"""
    config = {}
    try:
        # Try to find .env in current dir or parent dir (root)
        if not os.path.exists(env_path):
             # If running from scripts/, try ../.env
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
        print(f"❌ Error: .env file not found at {env_path}")
    return config

config = load_env()
JIRA_URL = config.get("JIRA_URL")
JIRA_EMAIL = config.get("JIRA_EMAIL")
JIRA_TOKEN = config.get("JIRA_TOKEN")

if not JIRA_URL or not JIRA_TOKEN:
    print("⚠️  Credentials missing in .env. Please check JIRA_URL, JIRA_EMAIL, JIRA_TOKEN.")
    exit(1)

# Projects to fetch (From your mapping)
TARGET_PROJECTS = ["NSS", "EUV", "PROT", "PSSM", "ASP"]

# Paths relative to the script execution or absolute
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_FILE = os.path.join(BASE_DIR, "data", "db", "jira_backup.db")
ATTACHMENT_DIR = os.path.join(BASE_DIR, "data", "attachments")
SKIP_ATTACHMENTS = True  # Set to True for fast metadata sync

# --- Setup ---
if not os.path.exists(ATTACHMENT_DIR):
    os.makedirs(ATTACHMENT_DIR)

conn = sqlite3.connect(DB_FILE)
cursor = conn.cursor()

# Create Tables
cursor.execute('''
    CREATE TABLE IF NOT EXISTS issues (
        key TEXT PRIMARY KEY,
        project TEXT,
        summary TEXT,
        status TEXT,
        created TEXT,
        updated TEXT,
        raw_json TEXT
    )
''')
cursor.execute('''
    CREATE TABLE IF NOT EXISTS attachments (
        id TEXT PRIMARY KEY,
        issue_key TEXT,
        filename TEXT,
        mime_type TEXT,
        size INTEGER,
        local_path TEXT,
        url TEXT
    )
''')
conn.commit()

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

# --- API Helper with Retry ---
def jira_request(method, endpoint, data=None, stream=False):
    url = f"{JIRA_URL}/rest/api/3{endpoint}"
    auth_str = f"{JIRA_EMAIL}:{JIRA_TOKEN}"
    b64_auth = base64.b64encode(auth_str.encode()).decode()
    
    headers = {
        "Authorization": f"Basic {b64_auth}",
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (DataBackupBot/1.0)"
    }
    
    req = urllib.request.Request(
        url, 
        data=json.dumps(data).encode('utf-8') if data else None,
        headers=headers,
        method=method
    )

    retries = 0
    max_retries = 5
    
    while retries < max_retries:
        try:
            if stream:
                return urllib.request.urlopen(req, context=ctx)
            
            with urllib.request.urlopen(req, context=ctx) as res:
                return json.loads(res.read().decode())

        except urllib.error.HTTPError as e:
            if e.code == 429: # Too Many Requests
                wait_time = int(e.headers.get('Retry-After', 5)) + (2 ** retries)
                print(f"⏳ Rate Limit hit! Waiting {wait_time}s...")
                time.sleep(wait_time)
                retries += 1
                continue
            elif e.code >= 500: # Server Error
                print(f"⚠️ Server Error {e.code}. Retrying...")
                time.sleep(5)
                retries += 1
                continue
            else:
                print(f"❌ Error {e.code} ({endpoint}): {e.read().decode()[:100]}")
                return None
        except Exception as e:
            print(f"❌ Network Error: {e}")
            time.sleep(5)
            retries += 1
            continue
            
    return None

def download_attachment(url, issue_key, filename, attachment_id):
    # Create issue folder
    issue_dir = os.path.join(ATTACHMENT_DIR, issue_key)
    if not os.path.exists(issue_dir):
        os.makedirs(issue_dir)
        
    local_path = os.path.join(issue_dir, f"{attachment_id}_{filename}")
    
    # Check if already downloaded
    if os.path.exists(local_path):
        return local_path

    # Download with Auth
    auth_str = f"{JIRA_EMAIL}:{JIRA_TOKEN}"
    b64_auth = base64.b64encode(auth_str.encode()).decode()
    req = urllib.request.Request(
        url,
        headers={"Authorization": f"Basic {b64_auth}", "User-Agent": "Mozilla/5.0"}
    )
    
    try:
        with urllib.request.urlopen(req, context=ctx) as res:
            with open(local_path, "wb") as f:
                f.write(res.read())
        return local_path
    except Exception as e:
        print(f"    ❌ Failed to download {filename}: {e}")
        return None

# --- Main Fetch Logic ---
def fetch_project(project_key):
    print(f"\n📂 Fetching Project: {project_key}")
    
    start_at = 0
    batch_size = 50 
    next_token = None
    
    while True:
        print(f"  📥 Batch {start_at}~...")
        
        # REMOVED "expand" field as it causes 400 on /search/jql
        query = {
            "jql": f"project = {project_key} ORDER BY created ASC",
            "maxResults": batch_size,
            "fields": ["*all"]
        }
        if next_token:
            query["nextPageToken"] = next_token
            
        res = jira_request("POST", "/search/jql", query)
        
        if not res or 'issues' not in res:
            print("    ⚠️ Failed to fetch batch. Stopping project.")
            break
            
        issues = res['issues']
        if not issues:
            print("    ✅ No more issues.")
            break
            
        print(f"    -> Got {len(issues)} issues. Saving to DB...")
        
        for issue in issues:
            key = issue['key']
            fields = issue['fields']
            
            # 1. Save Issue
            cursor.execute('''
                INSERT OR REPLACE INTO issues (key, project, summary, status, created, updated, raw_json)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (
                key,
                project_key,
                fields.get('summary', ''),
                fields.get('status', {}).get('name', ''),
                fields.get('created', ''),
                fields.get('updated', ''),
                json.dumps(issue)
            ))
            
            # 2. Download Attachments
            if not SKIP_ATTACHMENTS and 'attachment' in fields and fields['attachment']:
                print(f"    📎 {key}: Found {len(fields['attachment'])} attachments")
                for att in fields['attachment']:
                    download_attachment(att['content'], key, att['filename'], att['id'])
            
        conn.commit()
        
        # Next Page
        if 'nextPageToken' in res:
            next_token = res['nextPageToken']
        else:
            break
            
        time.sleep(2) 

def main():
    print("🐢 Starting Slow & Steady Jira Backup...")
    for proj in TARGET_PROJECTS:
        fetch_project(proj)
    
    conn.close()
    print("\n✅ All Done! Data saved to jira_backup.db")

if __name__ == "__main__":
    main()
