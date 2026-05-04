import { type NextRequest, NextResponse } from "next/server";
import { incrementGuideViewCount } from "@/lib/guides-store";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  await incrementGuideViewCount(id);
  return new NextResponse(null, { status: 204 });
}
