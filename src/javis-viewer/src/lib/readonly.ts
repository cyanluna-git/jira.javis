import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getCapabilityReason, resolveAccessContextFromRequest, type AccessContext, type WriteCapability } from '@/lib/access';

const READ_ONLY_MESSAGES: Record<ReturnType<typeof getCapabilityReason>, string> = {
  write_enabled: 'Write access available',
  global_read_only: 'This server is in read-only mode',
  authentication_required: 'Authentication is required before write access is allowed',
  identity_unresolved: 'Authenticated session found, but user identity could not be resolved',
  general_write_not_enabled: 'Your account does not have write access for this area',
  jira_write_not_enabled: 'Your account does not have Jira write access',
  confluence_write_not_enabled: 'Your account does not have Confluence write access',
};

export async function isReadOnlyMode(
  request?: Pick<NextRequest, 'cookies' | 'headers'>,
  capability: WriteCapability = 'general'
): Promise<boolean> {
  if (!request) {
    return process.env.NEXT_PUBLIC_READ_ONLY?.toLowerCase() === 'true';
  }

  const access = await resolveAccessContextFromRequest(request);
  return getCapabilityReason(access, capability) !== 'write_enabled';
}

export async function enforceWriteAccess(
  request: Pick<NextRequest, 'cookies' | 'headers'>,
  capability: WriteCapability = 'general'
) {
  const access = await resolveAccessContextFromRequest(request);
  const reason = getCapabilityReason(access, capability);

  if (reason === 'write_enabled') {
    return null;
  }

  return readOnlyResponse(access, capability);
}

export function readOnlyResponse(
  access?: AccessContext,
  capability: WriteCapability = 'general'
) {
  const reason = access ? getCapabilityReason(access, capability) : 'global_read_only';

  return NextResponse.json(
    {
      error: READ_ONLY_MESSAGES[reason],
      code: 'READ_ONLY_MODE',
      capability,
      reason,
      access,
    },
    { status: 403 }
  );
}
