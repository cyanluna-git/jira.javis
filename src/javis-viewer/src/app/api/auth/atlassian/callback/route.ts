import { NextRequest, NextResponse } from 'next/server';
import { getUserIdentityKey, resolveAccessContextFromRequest } from '@/lib/access';
import {
  exchangeCodeForTokenSet,
  fetchAtlassianProfile,
  getAtlassianOAuthStateCookieName,
  listAccessibleResources,
  selectPreferredResource,
  upsertAtlassianConnection,
  verifyAtlassianOAuthState,
} from '@/lib/atlassian-oauth';

export async function GET(request: NextRequest) {
  const stateCookieName = getAtlassianOAuthStateCookieName();
  const rawStateCookie = request.cookies.get(stateCookieName)?.value;
  const state = request.nextUrl.searchParams.get('state');
  const payload = verifyAtlassianOAuthState(rawStateCookie, state);
  const redirectPath = new URL(payload?.returnTo ?? '/', request.nextUrl.origin);

  const finalizeRedirect = (searchKey: string, message: string, status = 302) => {
    redirectPath.searchParams.set(searchKey, message);
    const response = NextResponse.redirect(redirectPath, { status });
    response.cookies.set(stateCookieName, '', {
      httpOnly: true,
      sameSite: 'lax',
      secure: request.nextUrl.protocol === 'https:',
      path: '/',
      maxAge: 0,
    });
    return response;
  };

  if (!payload) {
    return finalizeRedirect('atlassian_oauth_error', 'Invalid or expired Atlassian OAuth state');
  }

  const providerError = request.nextUrl.searchParams.get('error');
  if (providerError) {
    const providerMessage = request.nextUrl.searchParams.get('error_description') || providerError;
    return finalizeRedirect('atlassian_oauth_error', providerMessage);
  }

  const code = request.nextUrl.searchParams.get('code');
  if (!code) {
    return finalizeRedirect('atlassian_oauth_error', 'Missing Atlassian authorization code');
  }

  const access = await resolveAccessContextFromRequest(request);
  const currentUserKey = getUserIdentityKey(access.user);

  if (currentUserKey && currentUserKey !== payload.userKey) {
    return finalizeRedirect('atlassian_oauth_error', 'Authenticated user changed during Atlassian OAuth flow');
  }

  try {
    const tokenSet = await exchangeCodeForTokenSet({ code, request });
    const resources = await listAccessibleResources(tokenSet.access_token);
    const selectedResource = selectPreferredResource(resources);
    const profile = await fetchAtlassianProfile(tokenSet.access_token);

    await upsertAtlassianConnection({
      appUser: {
        key: payload.userKey,
        id: access.user?.id ?? null,
        email: access.user?.email ?? null,
        name: access.user?.name ?? null,
        username: access.user?.username ?? null,
      },
      profile,
      resources,
      selectedResource,
      tokenSet,
    });

    return finalizeRedirect('atlassian_oauth', 'connected');
  } catch (error) {
    return finalizeRedirect(
      'atlassian_oauth_error',
      error instanceof Error ? error.message : 'Failed to complete Atlassian OAuth flow'
    );
  }
}
