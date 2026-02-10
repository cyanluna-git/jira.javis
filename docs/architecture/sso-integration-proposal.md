# Javis - EOB Service SSO Integration Proposal

## Overview
This document outlines the technical proposal to secure the **Javis Viewer** application by integrating it with the existing **EOB (Edwards Engineering Management)** authentication system.

The goal is to restrict access to Javis Viewer (`jarvis.10.182.252.32.sslip.io`) so that only users logged into the EOB service (`eob.10.182.252.32.sslip.io`) can access it, without implementing a separate login system for Javis.

## Proposed Solution: Nginx `auth_request`
We recommend using the Nginx `auth_request` module. This allows Nginx to act as a gatekeeper, verifying user authentication with the EOB backend before allowing traffic to reach the Javis container.

### Architecture Flow
1. **User Request:** User accesses `http://jarvis.10.182.252.32.sslip.io`.
2. **Nginx Interception:** Nginx pauses the request and makes an internal sub-request to the EOB Backend verification endpoint (e.g., `/api/auth/verify`).
3. **Verification:**
   - The sub-request includes the user's browser cookies (Session/JWT).
   - **Case A (Logged In):** EOB Backend returns `200 OK`.
   - **Case B (Not Logged In):** EOB Backend returns `401 Unauthorized` or `403 Forbidden`.
4. **Result:**
   - **If 200 OK:** Nginx forwards the original request to the `javis-viewer` container. The user sees the dashboard.
   - **If 401/403:** Nginx redirects the user to the EOB Login page (`http://eob.10.182.252.32.sslip.io/login`).

## Implementation Requirements

### 1. EOB Backend (Prerequisite)
- **Verification Endpoint:** An API endpoint (e.g., `GET /api/auth/check` or `GET /api/user/me`) must exist.
  - Must return `200` status code if the session/token is valid.
  - Must return `401` or `403` if invalid.
- **Cookie Domain:** Authentication cookies (Session ID or JWT) must be set with the domain `.10.182.252.32.sslip.io` (wildcard) so they are visible to both `eob` and `jarvis` subdomains.

### 2. Nginx Configuration (`javis_nginx.conf`)
The Nginx configuration for Javis needs to be updated as follows:

```nginx
server {
    listen 80;
    server_name jarvis.10.182.252.32.sslip.io;

    # 1. Authentication Check
    location / {
        auth_request /_auth_verify; # Internal sub-request
        
        # If 401, redirect to EOB login
        error_page 401 = @login_redirect;

        # Proxy to Javis Viewer
        proxy_pass http://127.0.0.1:3009;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }

    # 2. Internal Verification Location
    location = /_auth_verify {
        internal;
        # Proxy to EOB Backend (assuming port 3004)
        proxy_pass http://127.0.0.1:3004/api/auth/verify; 
        
        # Do not send the request body to the auth service
        proxy_pass_request_body off;
        proxy_set_header Content-Length "";
        
        # Pass original cookies and URI
        proxy_set_header X-Original-URI $request_uri;
        proxy_set_header Cookie $http_cookie;
    }

    # 3. Redirect Handler
    location @login_redirect {
        return 302 http://eob.10.182.252.32.sslip.io/login?redirect=$scheme://$http_host$request_uri;
    }
}
```

## Alternative: JWT Sharing (Frontend Integration)
If Nginx integration is difficult, we can share a JWT token via URL.
1. EOB Frontend links to Javis with a token: `http://jarvis...?token=<JWT>`.
2. Javis Middleware verifies the token using the same `JWT_SECRET` as EOB.
3. If valid, set a cookie for Javis and proceed.

**Recommendation:** The **Nginx `auth_request`** method is superior as it handles security at the infrastructure level, requiring zero code changes in the Javis application logic.
