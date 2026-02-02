import { NextResponse } from 'next/server';

export function isReadOnlyMode(): boolean {
  return process.env.NEXT_PUBLIC_READ_ONLY?.toLowerCase() === 'true';
}

export function readOnlyResponse() {
  return NextResponse.json(
    { error: 'This server is in read-only mode', code: 'READ_ONLY_MODE' },
    { status: 403 }
  );
}
