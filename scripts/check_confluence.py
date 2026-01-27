import os
import requests
import json
from requests.auth import HTTPBasicAuth

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
JIRA_URL = config.get("JIRA_URL") # e.g. https://ac-avi.atlassian.net
CONFLUENCE_URL = f"{JIRA_URL}/wiki"
EMAIL = config.get("JIRA_EMAIL")
TOKEN = config.get("JIRA_TOKEN")

if not JIRA_URL or not TOKEN:
    print("❌ Config missing.")
    exit(1)

auth = HTTPBasicAuth(EMAIL, TOKEN)

print(f"🔍 Checking Confluence: {CONFLUENCE_URL}")

# 1. Get Space ID for 'ISP'
try:
    print("\n1️⃣  Fetching Space 'ISP'...")
    # Using v2 API to find space by key
    url = f"{CONFLUENCE_URL}/api/v2/spaces?keys=ISP"
    res = requests.get(url, auth=auth)
    
    if res.status_code == 200:
        data = res.json()
        if data['results']:
            space = data['results'][0]
            space_id = space['id']
            print(f"   ✅ Space Found: {space['name']} (ID: {space_id})")
            
            # 2. Get 1 Page from this Space with Body & Labels
            print(f"\n2️⃣  Fetching Sample Page from Space {space_id}...")
            # Note: v2 API requires specific params for body/labels if not default
            # v2 pages endpoint: /api/v2/spaces/{id}/pages
            page_url = f"{CONFLUENCE_URL}/api/v2/spaces/{space_id}/pages?limit=1&body-format=storage"
            
            res_p = requests.get(page_url, auth=auth)
            if res_p.status_code == 200:
                pages = res_p.json()['results']
                if pages:
                    p = pages[0]
                    print(f"   ✅ Page: {p['title']} (ID: {p['id']})")
                    print(f"   Parent ID: {p.get('parentId')}")
                    # v2 might not return labels by default, let's check structure
                    print(f"   Structure keys: {list(p.keys())}")
                else:
                    print("   ⚠️ No pages found in this space.")
            else:
                print(f"   ❌ Page Fetch Error: {res_p.status_code} {res_p.text[:200]}")
                
        else:
            print("   ❌ Space 'ISP' not found.")
    else:
        print(f"   ❌ Space API Error: {res.status_code} {res.text[:200]}")

except Exception as e:
    print(f"   ❌ Error: {e}")
