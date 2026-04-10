import { NextRequest, NextResponse } from 'next/server';
import { getUserIdentityKey, resolveAccessContextFromRequest } from '@/lib/access';
import {
  buildAtlassianAuthorizationUrl,
  createSignedAtlassianOAuthState,
  getAtlassianOAuthStateCookieMaxAge,
  getAtlassianOAuthStateCookieName,
} from '@/lib/atlassian-oauth';

export async function GET(request: NextRequest) {
  const access = await resolveAccessContextFromRequest(request);
  const userKey = getUserIdentityKey(access.user);

  if (!access.isAuthenticated) {
    return NextResponse.json(
      { error: 'Authentication is required before connecting Atlassian' },
      { status: 401 }
    );
  }

  if (!userKey) {
    return NextResponse.json(
      { error: 'Authenticated session found, but user identity could not be resolved' },
      { status: 409 }
    );
  }

  const returnTo = request.nextUrl.searchParams.get('returnTo') ?? '/';
  const mode = request.nextUrl.searchParams.get('mode');

  try {
    const oauthState = createSignedAtlassianOAuthState({
      userKey,
      returnTo,
    });
    const authorizationUrl = buildAtlassianAuthorizationUrl(request, oauthState.state);

    if (mode === 'json') {
      const response = NextResponse.json({
        authorizationUrl,
        returnTo,
      });
      response.cookies.set(getAtlassianOAuthStateCookieName(), oauthState.signedCookieValue, {
        httpOnly: true,
        sameSite: 'lax',
        secure: request.nextUrl.protocol === 'https:',
        path: '/',
        maxAge: getAtlassianOAuthStateCookieMaxAge(),
      });
      return response;
    }

    const response = NextResponse.redirect(authorizationUrl);
    response.cookies.set(getAtlassianOAuthStateCookieName(), oauthState.signedCookieValue, {
      httpOnly: true,
      sameSite: 'lax',
      secure: request.nextUrl.protocol === 'https:',
      path: '/',
      maxAge: getAtlassianOAuthStateCookieMaxAge(),
    });
    return response;
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to start Atlassian OAuth flow',
      },
      { status: 500 }
    );
  }
}
