import os
import requests
from requests.auth import HTTPBasicAuth

config = {}
# ... (Load Env Code Skipped for brevity, assume same as before) ...
try:
    if not os.path.exists(".env"):
        env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")
    else:
        env_path = ".env"
        
    with open(env_path, "r") as f:
        for line in f:
            if "=" in line:
                k, v = line.strip().split("=", 1)
                config[k] = v
except: pass

JIRA_URL = config.get("JIRA_URL")
JIRA_EMAIL = config.get("JIRA_EMAIL")
JIRA_TOKEN = config.get("JIRA_TOKEN")
auth = HTTPBasicAuth(JIRA_EMAIL, JIRA_TOKEN)

print(f"🔍 Probing /rest/api/3/search/jql on {JIRA_URL}")

# Test 1: GET
try:
    print("\n1️⃣  GET Request")
    res = requests.get(
        f"{JIRA_URL}/rest/api/3/search/jql", 
        auth=auth, 
        params={"jql": "order by created", "maxResults": 1}
    )
    print(f"   Status: {res.status_code}")
    print(f"   Response: {res.text[:200]}")
except Exception as e: print(e)

# Test 2: POST with JSON {"jql": ...}
try:
    print("\n2️⃣  POST with JSON {'jql': ...}")
    res = requests.post(
        f"{JIRA_URL}/rest/api/3/search/jql", 
        auth=auth, 
        json={"jql": "order by created", "maxResults": 1}
    )
    print(f"   Status: {res.status_code}")
    print(f"   Response: {res.text[:200]}")
except Exception as e: print(e)

# Test 3: POST with JSON {"query": ...}
try:
    print("\n3️⃣  POST with JSON {'query': ...}")
    res = requests.post(
        f"{JIRA_URL}/rest/api/3/search/jql", 
        auth=auth, 
        json={"query": "order by created"}
    )
    print(f"   Status: {res.status_code}")
    print(f"   Response: {res.text[:200]}")
except Exception as e: print(e)
