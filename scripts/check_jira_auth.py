import os
import requests
from requests.auth import HTTPBasicAuth

# --- Configuration ---
def load_env(env_path=".env"):
    config = {}
    try:
        if not os.path.exists(env_path):
            env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")
        with open(env_path, "r") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"): continue
                if "=" in line:
                    key, value = line.split("=", 1)
                    config[key.strip()] = value.strip()
    except: pass
    return config

config = load_env()
JIRA_URL = config.get("JIRA_URL")
JIRA_EMAIL = config.get("JIRA_EMAIL")
JIRA_TOKEN = config.get("JIRA_TOKEN")

if not JIRA_URL or not JIRA_TOKEN:
    print("❌ Config missing.")
    exit(1)

auth = HTTPBasicAuth(JIRA_EMAIL, JIRA_TOKEN)

print(f"🔍 Testing Connection to: {JIRA_URL}")

# 1. Check Myself
try:
    print("\n1️⃣  Checking Myself (/rest/api/3/myself)...")
    res = requests.get(f"{JIRA_URL}/rest/api/3/myself", auth=auth)
    print(f"   Status: {res.status_code}")
    if res.status_code == 200:
        print(f"   ✅ Hello, {res.json().get('displayName')}!")
    else:
        print(f"   ❌ Response: {res.text[:100]}")
except Exception as e:
    print(f"   ❌ Network Error: {e}")

# 2. Check Projects
try:
    print("\n2️⃣  Checking Projects (/rest/api/3/project)...")
    res = requests.get(f"{JIRA_URL}/rest/api/3/project", auth=auth)
    print(f"   Status: {res.status_code}")
    if res.status_code == 200:
        projects = res.json()
        print(f"   ✅ Found {len(projects)} projects.")
    else:
        print(f"   ❌ Response: {res.text[:100]}")
except Exception as e:
    print(f"   ❌ Network Error: {e}")

# 3. Search Test (GET v2)
try:
    print("\n3️⃣  Testing Search GET v2 (/rest/api/2/search?jql=maxResults=1)...")
    res = requests.get(f"{JIRA_URL}/rest/api/2/search?maxResults=1", auth=auth)
    print(f"   Status: {res.status_code}")
    if res.status_code != 200:
        print(f"   ❌ Response: {res.text[:100]}")
    else:
        print("   ✅ Search works!")
except Exception as e:
    print(f"   Error: {e}")

# 4. Search Test (POST v3)
try:
    print("\n4️⃣  Testing Search POST v3 (/rest/api/3/search)...")
    res = requests.post(
        f"{JIRA_URL}/rest/api/3/search", 
        auth=auth, 
        json={"jql": "", "maxResults": 1}
    )
    print(f"   Status: {res.status_code}")
    if res.status_code != 200:
        print(f"   ❌ Response: {res.text[:100]}")
    else:
        print("   ✅ Search works!")
except Exception as e:
    print(f"   Error: {e}")