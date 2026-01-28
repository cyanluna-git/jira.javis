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
JIRA_URL = config.get("JIRA_URL") # https://ac-avi.atlassian.net
CONFLUENCE_BASE = JIRA_URL.rstrip('/') # https://ac-avi.atlassian.net
EMAIL = config.get("JIRA_EMAIL")
TOKEN = config.get("JIRA_TOKEN")

# DB Config
DB_HOST = "localhost"
DB_PORT = config.get("DB_PORT", "5439")
DB_NAME = "javis_brain"
DB_USER = "javis"
DB_PASS = config.get("JAVIS_DB_PASSWORD", "javis_password")

SPACE_ID = "67043441" # ISP Space ID
AUTH = HTTPBasicAuth(EMAIL, TOKEN)

# --- Database Setup ---
def get_db_connection():
    return psycopg2.connect(host=DB_HOST, port=DB_PORT, dbname=DB_NAME, user=DB_USER, password=DB_PASS)

def init_db():
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS confluence_v2_content (
            id TEXT PRIMARY KEY,
            type TEXT, -- 'page', 'folder'
            title TEXT,
            parent_id TEXT,
            space_id TEXT,
            labels TEXT[],
            body_storage TEXT,
            version INTEGER,
            web_url TEXT,
            raw_data JSONB,
            created_at TIMESTAMP,
            last_synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    """)
    cur.execute("CREATE INDEX IF NOT EXISTS idx_v2_parent_id ON confluence_v2_content(parent_id);")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_v2_labels ON confluence_v2_content USING GIN(labels);")
    conn.commit()
    cur.close()
    conn.close()

# --- API Helpers ---
def api_get(endpoint):
    # endpoint can be relative like '/wiki/api/v2/...' or '/api/v2/...'
    if endpoint.startswith('http'):
        url = endpoint
    elif endpoint.startswith('/wiki'):
        url = f"{CONFLUENCE_BASE}{endpoint}"
    else:
        url = f"{CONFLUENCE_BASE}/wiki{endpoint}"
        
    retries = 0
    while retries < 3:
        try:
            res = requests.get(url, auth=AUTH, timeout=60)
            if res.status_code == 404:
                return None
            if res.status_code == 429:
                wait = int(res.headers.get("Retry-After", 5)) + (2 ** retries)
                time.sleep(wait)
                retries += 1
                continue
            res.raise_for_status()
            return res.json()
        except Exception as e:
            print(f"❌ API Error ({url}): {e}")
            time.sleep(5)
            retries += 1
    return None

def fetch_labels(content_id, content_type='pages'):
    endpoint = f"/api/v2/{content_type}/{content_id}/labels"
    data = api_get(endpoint)
    if data and 'results' in data:
        return [l['name'] for l in data['results']]
    return []

def save_content(conn, item, content_type):
    cur = conn.cursor()
    cid, title = item['id'], item['title']
    parent_id = item.get('parentId')
    space_id = item.get('spaceId')
    version = item.get('version', {}).get('number', 1)
    created_at = item.get('createdAt')
    body = item.get('body', {}).get('storage', {}).get('value', '')
    web_url = f"{CONFLUENCE_BASE}/wiki{item.get('_links', {}).get('webui', '')}"
    
    # Optional: fetch labels if needed for refactoring
    labels = fetch_labels(cid, 'folders' if content_type == 'folder' else 'pages')
    
    query = """
        INSERT INTO confluence_v2_content (
            id, type, title, parent_id, space_id, labels, body_storage, version, web_url, raw_data, created_at, last_synced_at
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
        ON CONFLICT (id) DO UPDATE SET
            title = EXCLUDED.title, parent_id = EXCLUDED.parent_id, labels = EXCLUDED.labels,
            body_storage = EXCLUDED.body_storage, version = EXCLUDED.version,
            raw_data = EXCLUDED.raw_data, last_synced_at = NOW();
    """
    cur.execute(query, (cid, content_type, title, parent_id, space_id, labels, body, version, web_url, Json(item), created_at))

def sync_v2_resource(resource_type):
    print(f"🚀 Syncing {resource_type}...")
    conn = get_db_connection()

    # Initial URL
    current_url = f"/api/v2/spaces/{SPACE_ID}/{resource_type}?limit=50"
    if resource_type == 'pages':
        current_url += "&body-format=storage"

    total = 0
    while current_url:
        data = api_get(current_url)
        if not data or 'results' not in data:
            break

        results = data['results']
        for item in results:
            save_content(conn, item, resource_type.rstrip('s'))
            total += 1
            if total % 10 == 0: print(f"  - {resource_type}: {total} synced...")

        conn.commit()
        next_link = data.get('_links', {}).get('next')
        current_url = next_link # v2 next links are usually relative from /wiki

    conn.close()
    print(f"✅ Total {resource_type}: {total}")

def fetch_folder_details(folder_id):
    """Fetch full folder details including parent info"""
    endpoint = f"/api/v2/folders/{folder_id}"
    return api_get(endpoint)

def sync_folders_recursive():
    """Sync folders by traversing the content tree using direct-children endpoint"""
    print("🚀 Syncing folders recursively...")
    conn = get_db_connection()

    # Get all root pages first
    cur = conn.cursor()
    cur.execute("SELECT id FROM confluence_v2_content WHERE parent_id IS NULL AND type = 'page'")
    root_pages = [row[0] for row in cur.fetchall()]

    # Also get pages that might have folder children
    cur.execute("SELECT DISTINCT id FROM confluence_v2_content WHERE type = 'page'")
    all_pages = [row[0] for row in cur.fetchall()]

    # Queue for BFS: start with root pages
    queue = list(root_pages)
    visited_pages = set()
    folder_count = 0

    while queue:
        page_id = queue.pop(0)
        if page_id in visited_pages:
            continue
        visited_pages.add(page_id)

        # Get direct children of this page
        current_url = f"/api/v2/pages/{page_id}/direct-children?limit=100"
        while current_url:
            data = api_get(current_url)
            if not data or 'results' not in data:
                break

            for child in data['results']:
                child_type = child.get('type')
                child_id = child.get('id')

                if child_type == 'folder':
                    # Fetch full folder details
                    folder_data = fetch_folder_details(child_id)
                    if folder_data:
                        save_content(conn, folder_data, 'folder')
                        folder_count += 1
                        if folder_count % 10 == 0:
                            print(f"  - folders: {folder_count} synced...")
                    # Add folder to queue to check its children
                    queue.append(child_id)
                elif child_type == 'page' and child_id not in visited_pages:
                    queue.append(child_id)

            conn.commit()
            next_link = data.get('_links', {}).get('next')
            current_url = next_link

    # Also traverse folders to find nested folders
    cur.execute("SELECT id FROM confluence_v2_content WHERE type = 'folder'")
    folder_ids = [row[0] for row in cur.fetchall()]

    for folder_id in folder_ids:
        if folder_id in visited_pages:
            continue
        visited_pages.add(folder_id)

        current_url = f"/api/v2/folders/{folder_id}/direct-children?limit=100"
        while current_url:
            data = api_get(current_url)
            if not data or 'results' not in data:
                break

            for child in data['results']:
                child_type = child.get('type')
                child_id = child.get('id')

                if child_type == 'folder':
                    folder_data = fetch_folder_details(child_id)
                    if folder_data:
                        save_content(conn, folder_data, 'folder')
                        folder_count += 1
                        folder_ids.append(child_id)  # Add to list for further traversal

            conn.commit()
            next_link = data.get('_links', {}).get('next')
            current_url = next_link

    conn.close()
    print(f"✅ Total folders: {folder_count}")

if __name__ == "__main__":
    init_db()
    sync_v2_resource('pages')  # Sync pages first
    sync_folders_recursive()    # Then sync folders by traversing the tree
    print("\n🎉 Done!")
