import { NextRequest, NextResponse } from 'next/server';
import { getUserIdentityKey, resolveAccessContextFromRequest } from '@/lib/access';
import { disconnectAtlassianConnection, getAtlassianConnectionSummary, getAtlassianRequestedScopes } from '@/lib/atlassian-oauth';

function currentUserResponse(request: NextRequest) {
  return resolveAccessContextFromRequest(request).then((access) => {
    const userKey = getUserIdentityKey(access.user);
    return { access, userKey };
  });
}

export async function GET(request: NextRequest) {
  const { access, userKey } = await currentUserResponse(request);

  if (!access.isAuthenticated) {
    return NextResponse.json(
      { connected: false, configured: false, error: 'Authentication is required' },
      { status: 401 }
    );
  }

  if (!userKey) {
    return NextResponse.json(
      { connected: false, configured: false, error: 'User identity could not be resolved' },
      { status: 409 }
    );
  }

  const connection = await getAtlassianConnectionSummary(userKey);

  return NextResponse.json({
    configured: Boolean(process.env.ATLASSIAN_OAUTH_CLIENT_ID && process.env.ATLASSIAN_OAUTH_CLIENT_SECRET),
    connected: Boolean(connection),
    requestedScopes: getAtlassianRequestedScopes(),
    user: access.user,
    connection,
  });
}

export async function DELETE(request: NextRequest) {
  const { access, userKey } = await currentUserResponse(request);

  if (!access.isAuthenticated) {
    return NextResponse.json(
      { error: 'Authentication is required before disconnecting Atlassian' },
      { status: 401 }
    );
  }

  if (!userKey) {
    return NextResponse.json(
      { error: 'Authenticated session found, but user identity could not be resolved' },
      { status: 409 }
    );
  }

  const removed = await disconnectAtlassianConnection(userKey);
  return NextResponse.json({
    disconnected: removed,
  });
}
