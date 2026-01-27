import os
import requests
import json
import psycopg2
import time
from requests.auth import HTTPBasicAuth
from psycopg2.extras import Json

# --- Configuration ---
def load_env(env_path=".env"):
    config = {}
    try:
        if not os.path.exists(env_path):
            env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")
        with open(env_path, "r") as f:
            for line in f:
                if "=" in line:
                    k, v = line.strip().split("=", 1)
                    config[k] = v
    except: pass
    return config

config = load_env()
JIRA_URL = config.get("JIRA_URL")
CONFLUENCE_URL = f"{JIRA_URL}/wiki"
EMAIL = config.get("JIRA_EMAIL")
TOKEN = config.get("JIRA_TOKEN")

# DB Config
DB_HOST = "localhost"
DB_PORT = "5432"
DB_NAME = "javis_brain"
DB_USER = "javis"
DB_PASS = config.get("JAVIS_DB_PASSWORD", "javis_password")

TARGET_SPACE = "ISP"

if not JIRA_URL or not TOKEN:
    print("❌ Config missing.")
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
    
    # Schema optimized for refactoring & structure analysis
    cur.execute("""
        CREATE TABLE IF NOT EXISTS confluence_pages (
            page_id TEXT PRIMARY KEY,
            space_key TEXT,
            title TEXT,
            parent_id TEXT,
            labels TEXT[],
            body_storage TEXT,
            web_url TEXT,
            version INTEGER,
            created_at TIMESTAMP,
            updated_at TIMESTAMP,
            author_name TEXT,
            raw_data JSONB,
            last_synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    """)
    
    cur.execute("CREATE INDEX IF NOT EXISTS idx_cf_parent_id ON confluence_pages(parent_id);")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_cf_labels ON confluence_pages USING GIN(labels);")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_cf_space ON confluence_pages(space_key);")
    
    conn.commit()
    cur.close()
    conn.close()
    print("✅ Database schema for Confluence Cloud initialized.")

# --- API Client ---
def fetch_pages(start=0, limit=50):
    url = f"{CONFLUENCE_URL}/rest/api/content"
    auth = HTTPBasicAuth(EMAIL, TOKEN)
    
    params = {
        "spaceKey": TARGET_SPACE,
        "type": "page",
        "start": start,
        "limit": limit,
        # Fetch body, labels, ancestors (for hierarchy), version
        "expand": "body.storage,metadata.labels,ancestors,version,history"
    }
    
    retries = 0
    while retries < 5:
        try:
            res = requests.get(url, auth=auth, params=params, timeout=60)
            if res.status_code == 429:
                wait = int(res.headers.get("Retry-After", 5)) + (2 ** retries)
                print(f"⏳ Rate Limit. Waiting {wait}s...")
                time.sleep(wait)
                retries += 1
                continue
            res.raise_for_status()
            return res.json()
        except Exception as e:
            print(f"❌ API Error: {e}")
            time.sleep(5)
            retries += 1
            
    return None

def save_page(conn, page):
    cur = conn.cursor()
    
    page_id = page['id']
    title = page['title']
    space_key = TARGET_SPACE
    web_url = f"{CONFLUENCE_URL}{page.get('_links', {}).get('webui', '')}"
    
    # Body
    body_storage = page.get('body', {}).get('storage', {}).get('value', '')
    
    # Parent ID (Ancestors의 마지막 요소가 직계 부모)
    ancestors = page.get('ancestors', [])
    parent_id = ancestors[-1]['id'] if ancestors else None
    
    # Labels
    labels_data = page.get('metadata', {}).get('labels', {}).get('results', [])
    labels = [l['name'] for l in labels_data]
    
    # Version & History
    version = page.get('version', {}).get('number', 1)
    history = page.get('history', {})
    created_at = history.get('createdDate')
    # updated_at is tricky in v1, usually in version
    updated_at = page.get('version', {}).get('when')
    
    author = history.get('createdBy', {}).get('displayName', 'Unknown')
    
    query = """
        INSERT INTO confluence_pages (
            page_id, space_key, title, parent_id, labels, 
            body_storage, web_url, version, created_at, updated_at, 
            author_name, raw_data, last_synced_at
        ) VALUES (
            %s, %s, %s, %s, %s, 
            %s, %s, %s, %s, %s, 
            %s, %s, NOW()
        )
        ON CONFLICT (page_id) DO UPDATE SET
            title = EXCLUDED.title,
            parent_id = EXCLUDED.parent_id,
            labels = EXCLUDED.labels,
            body_storage = EXCLUDED.body_storage,
            version = EXCLUDED.version,
            updated_at = EXCLUDED.updated_at,
            raw_data = EXCLUDED.raw_data,
            last_synced_at = NOW();
    """
    
    cur.execute(query, (
        page_id, space_key, title, parent_id, labels,
        body_storage, web_url, version, created_at, updated_at,
        author, Json(page)
    ))

def sync_space():
    print(f"🚀 Syncing Confluence Space: {TARGET_SPACE}")
    conn = get_db_connection()
    
    start = 0
    limit = 25 # Smaller batch for heavy content
    total_synced = 0
    
    while True:
        data = fetch_pages(start, limit)
        if not data or 'results' not in data:
            break
            
        pages = data['results']
        if not pages:
            break
            
        for page in pages:
            save_page(conn, page)
            
        conn.commit()
        count = len(pages)
        total_synced += count
        print(f"  - Synced {count} pages (Total: {total_synced})")
        
        if count < limit:
            print("    ✅ End of results.")
            break
            
        start += count
        
    conn.close()
    print(f"✅ Completed. Total {total_synced} pages synced.")

if __name__ == "__main__":
    init_db()
    sync_space()
