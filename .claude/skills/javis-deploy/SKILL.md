---
name: javis-deploy
description: Deploy the Javis viewer frontend to the remote server with sw-portal.atlascopco.group as the canonical host. Use when the user says "배포해줘", "deploy viewer", or "publish Jarvis".
allowed-tools: Bash(docker* ssh* scp* curl*)
---

# Javis Deploy

Routine deploy skill for the Javis viewer frontend.

## Default Target

- **Canonical host:** `sw-portal.atlascopco.group`
- **Server:** `atlasAdmin@10.182.252.32`

## Workflow

When triggered, this skill should:

1. Build only the `javis-viewer` Docker image from `src/javis-viewer/`.
2. Upload only the viewer image tarball to `/data/javis/` on the remote server.
3. Reload only the remote `javis-viewer` container with `docker-compose up -d javis-viewer`.
4. Verify the deployed app responds on the canonical host.

## Deployment Rules

- Treat `sw-portal.atlascopco.group` as the **canonical Jarvis host**.
- Do **not** upload `.env`, nginx config, or DB images during routine viewer deploys.
- Do **not** recreate `javis-db` unless the user explicitly asked for a DB deploy.
- Do **not** let `sw-portal` or `jarvis` hosts redirect to `eob` by default.
- Keep token handoff support optional: if `?token=` and `?refresh=` are present, session bootstrap can run, but normal direct access must still work.

## Nginx / Proxy Notes

- Jarvis host routing is aligned with `../edwards/engineering.management/nginx_remote_proxy.conf`.
- If canonical host or proxy behavior must change, update the engineering.management nginx config there instead of overwriting Javis-specific nginx files from this repo.

## Bundled Resources

- `scripts/deploy_viewer.sh`: safe routine deploy script for viewer-only deploys

## Usage

```bash
/javis-deploy
/javis-deploy deploy
/javis-deploy verify
```
