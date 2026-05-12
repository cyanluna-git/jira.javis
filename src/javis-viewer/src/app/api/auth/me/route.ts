import { type NextRequest, NextResponse } from "next/server";
import { resolveAccessContextFromRequest } from "@/lib/access";

export async function GET(request: NextRequest) {
  const access = await resolveAccessContextFromRequest(request);
  if (!access.user) {
    return NextResponse.json({ user: null });
  }
  return NextResponse.json({
    user: {
      name: access.user.name,
      email: access.user.email,
      username: access.user.username,
    },
  });
}
