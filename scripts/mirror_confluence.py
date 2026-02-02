import os
import psycopg2
import re
from datetime import datetime

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
DB_HOST = "localhost"
DB_PORT = "5432"
DB_NAME = "javis_brain"
DB_USER = "javis"
DB_PASS = config.get("JAVIS_DB_PASSWORD", "javis_password")

ROOT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "archive", "confluence")

# --- DB Setup ---
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
        CREATE TABLE IF NOT EXISTS confluence_pages (
            id SERIAL PRIMARY KEY,
            path TEXT UNIQUE NOT NULL,
            title TEXT,
            content TEXT,
            parent_folder TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP,
            last_synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    """)
    
    # Vector search prep (standard text search for now)
    cur.execute("""
        CREATE INDEX IF NOT EXISTS idx_confluence_path ON confluence_pages(path);
    """)
    
    conn.commit()
    cur.close()
    conn.close()
    print("✅ Database schema for Confluence initialized.")

# --- Processing ---
def extract_title(content, filename):
    # Try to find first H1 header
    match = re.search(r'^#\s+(.+)$', content, re.MULTILINE)
    if match:
        return match.group(1).strip()
    
    # Fallback to filename without extension
    return os.path.splitext(filename)[0].replace("-", " ")

def sync_confluence():
    print(f"📂 Scanning directory: {ROOT_DIR}")
    conn = get_db_connection()
    cur = conn.cursor()
    
    count = 0
    for root, dirs, files in os.walk(ROOT_DIR):
        for file in files:
            if not file.endswith(".md"):
                continue
                
            full_path = os.path.join(root, file)
            # Relative path from archive/confluence
            rel_path = os.path.relpath(full_path, ROOT_DIR)
            parent_folder = os.path.basename(os.path.dirname(full_path))
            
            try:
                with open(full_path, "r", encoding="utf-8") as f:
                    content = f.read()
            except Exception as e:
                print(f"❌ Failed to read {rel_path}: {e}")
                continue
                
            title = extract_title(content, file)
            
            # Upsert
            query = """
                INSERT INTO confluence_pages (path, title, content, parent_folder, updated_at, last_synced_at)
                VALUES (%s, %s, %s, %s, NOW(), NOW())
                ON CONFLICT (path) DO UPDATE SET
                    title = EXCLUDED.title,
                    content = EXCLUDED.content,
                    parent_folder = EXCLUDED.parent_folder,
                    updated_at = EXCLUDED.updated_at,
                    last_synced_at = NOW();
            """
            cur.execute(query, (rel_path, title, content, parent_folder))
            count += 1
            if count % 10 == 0:
                print(f"  - Synced {count} pages...")
                
    conn.commit()
    conn.close()
    print(f"✅ Total {count} Confluence pages synced to PostgreSQL.")

if __name__ == "__main__":
    try:
        init_db()
        sync_confluence()
    except Exception as e:
        print(f"❌ Error: {e}")
