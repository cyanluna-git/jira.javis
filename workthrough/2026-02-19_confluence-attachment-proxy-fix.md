# Confluence Attachment Proxy: Media API Redirect Handling

## Overview

Javis viewer의 Confluence 첨부파일 프록시 API를 개선하여 이미지와 영상 모두 `api.media.atlassian.com`을 통해 안정적으로 다운로드되도록 수정했다. 프로덕션 서버(10.182.252.32)에서 이미지/영상이 로드되지 않는 문제의 근본 원인을 분석하고, 방화벽 오픈 요청에 필요한 정확한 endpoint를 도출했다.

## Context

- 프로덕션 서버에서 Confluence 페이지의 이미지와 영상이 "Failed to load image/video"로 표시됨
- 원인: Confluence Cloud는 첨부파일 다운로드 시 `api.media.atlassian.com`으로 302 redirect하는데, 프로덕션 서버 방화벽에서 이 호스트가 차단됨
- `ac-avi.atlassian.net` (REST API)만 열려 있고, 실제 파일 바이너리를 서빙하는 `api.media.atlassian.com`은 차단 상태

## 분석 결과: Confluence Cloud 미디어 다운로드 체인

### 이미지 (PNG/JPG)
```
ac-avi.atlassian.net/wiki/download/attachments/{pageId}/{filename}
  → 302 Redirect → api.media.atlassian.com/file/{fileId}/binary?token=JWT
    → 200 OK (image binary)
```

### 영상 (MP4)
```
ac-avi.atlassian.net/wiki/download/attachments/{pageId}/{filename}
  → 401 Unauthorized (Basic Auth로는 video download redirect 불가)

대안: api.media.atlassian.com/file/{fileId}/binary?collection=contentId-{pageId}&token=JWT
  → 200 OK (video binary)
```

### 방화벽 오픈 필요 목록

| Destination | Port | 용도 | 현재 상태 |
|------------|------|------|-----------|
| `ac-avi.atlassian.net` | 443 | REST API (메타데이터) | 이미 열림 |
| **`api.media.atlassian.com`** | **443** | **이미지 + 영상 바이너리** | **차단 — 오픈 필요** |

`media-cdn.atlassian.com`(브라우저 CDN)과 `id.atlassian.com`(OAuth 로그인)은 서버 프록시에서는 불필요.

## Changes Made

### 1. Attachment Proxy Route 전면 개선

**File**: `src/javis-viewer/src/app/api/confluence/attachment/[pageId]/[filename]/route.ts`

기존 코드는 단순히 download URL로 fetch → 실패 시 alternative URL 시도하는 2단계였으나, Confluence Cloud의 media API redirect를 제대로 처리하지 못했음.

**개선 사항:**

1. **`redirect: 'manual'` 사용**: 302 redirect를 자동 follow하지 않고 Location 헤더를 직접 검사
2. **api.media.atlassian.com 감지**: redirect 대상이 media API인 경우 auth 헤더 없이 follow (token이 URL에 포함)
3. **HTML 응답 필터링**: login 페이지로 redirect된 경우 `content-type: text/html` 체크로 거부
4. **4단계 fallback 전략**:
   - Strategy 1: Download URL → manual redirect → api.media follow
   - Strategy 2: Download URL → auto redirect (Node.js fetch 기본 동작)
   - Strategy 3: Alternative download URL 시도
   - Strategy 4: Media API with redirect token (fileId 기반)

## Code Examples

### 핵심 변경: Manual Redirect Handling

```typescript
// route.ts - Strategy 1: Download via redirect to api.media
async function tryDownloadRedirect(
  downloadLink: string,
  authHeader: string,
): Promise<Response | null> {
  const downloadUrl = `${CONFLUENCE_BASE}/wiki${downloadLink}`;

  const res = await fetch(downloadUrl, {
    headers: {
      'Authorization': `Basic ${authHeader}`,
      'X-Atlassian-Token': 'no-check',
    },
    redirect: 'manual',  // Don't auto-follow
  });

  if (res.status === 302) {
    const location = res.headers.get('location');
    if (location && location.includes(MEDIA_API_BASE)) {
      // api.media.atlassian.com redirect — token is in URL, no auth header needed
      const mediaRes = await fetch(location);
      if (mediaRes.ok) return mediaRes;
    }
  }

  if (res.ok) return res;
  return null;
}
```

### HTML 응답 필터링

```typescript
// Strategy 2: Auto redirect with content-type validation
async function tryAutoRedirectDownload(
  downloadLink: string,
  authHeader: string,
): Promise<Response | null> {
  const res = await fetch(downloadUrl, {
    headers: { 'Authorization': `Basic ${authHeader}` },
  });

  if (res.ok) {
    const contentType = res.headers.get('content-type') || '';
    // Reject HTML login pages that come back as 200
    if (!contentType.includes('text/html')) {
      return res;
    }
  }
  return null;
}
```

## Verification Results

### Type Check
```bash
$ npx tsc --noEmit --skipLibCheck route.ts
(no errors)
```

### Local Proxy Tests (dev server on port 3009)

```
Image (PNG, 1.3MB):  HTTP 200, Content-Type: image/png   ✅
Image (JPG, 65KB):   HTTP 200, Content-Type: image/jpeg  ✅
Video (MP4, 9.0MB):  HTTP 200, Content-Type: video/mp4   ✅
Video (MP4, 2.8MB):  HTTP 200, Content-Type: video/mp4   ✅
Nonexistent file:    HTTP 404, error: "Attachment not found" ✅
```

## Next Steps

1. **방화벽 요청**: `api.media.atlassian.com:443` outbound 오픈 요청 (네트워크 팀)
2. **서버 배포**: 방화벽 오픈 확인 후 프로덕션 서버에 코드 배포
3. **서버 검증**: 프로덕션에서 이미지/영상 로딩 확인
