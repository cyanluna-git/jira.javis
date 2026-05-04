import { type NextRequest, NextResponse } from "next/server";
import { listGuides, createGuide } from "@/lib/guides-store";
import {
  resolveAccessContextFromRequest,
  hasWriteCapability,
} from "@/lib/access";

const HTML_MAX_BYTES = 1_048_576;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidFormat(value: unknown): value is "markdown" | "static-html" {
  return value === "markdown" || value === "static-html";
}

async function checkWriteAccess(request: NextRequest): Promise<NextResponse | null> {
  const configuredToken = process.env.PORTAL_GUIDE_WRITE_TOKEN?.trim();
  if (configuredToken) {
    const provided = request.headers.get("x-portal-admin-token");
    if (provided === configuredToken) return null;
  }

  const access = await resolveAccessContextFromRequest(request);
  if (hasWriteCapability(access, "general")) return null;

  return NextResponse.json(
    { error: "Authentication required to modify guides." },
    { status: 401 },
  );
}

export function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const category = searchParams.get("category") || undefined;
  const search = searchParams.get("search") || undefined;
  return listGuides({ category, search }).then((guides) =>
    NextResponse.json(guides),
  );
}

export async function POST(request: NextRequest) {
  const denied = await checkWriteAccess(request);
  if (denied) return denied;

  const body = await request.json().catch(() => null);
  if (
    !body ||
    !isNonEmptyString(body.title) ||
    !isNonEmptyString(body.category) ||
    !isNonEmptyString(body.content)
  ) {
    return NextResponse.json(
      { error: "Invalid guide payload." },
      { status: 400 },
    );
  }

  const format = isValidFormat(body.format) ? body.format : "markdown";

  if (format === "static-html") {
    const content: string = body.content;
    if (new TextEncoder().encode(content).length > HTML_MAX_BYTES) {
      return NextResponse.json(
        { error: "HTML content exceeds 1 MiB limit." },
        { status: 413 },
      );
    }
    if (!content.includes("<")) {
      return NextResponse.json(
        { error: "Content does not appear to be valid HTML." },
        { status: 400 },
      );
    }
  }

  const guide = await createGuide({
    title: body.title.trim(),
    category: body.category.trim(),
    content: format === "static-html" ? body.content : body.content.trim(),
    author: isNonEmptyString(body.author) ? body.author.trim() : "admin",
    format,
  });
  return NextResponse.json(guide, { status: 201 });
}
