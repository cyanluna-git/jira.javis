import { type NextRequest, NextResponse } from "next/server";
import { deleteGuide, getGuide, updateGuide } from "@/lib/guides-store";
import {
  resolveAccessContextFromRequest,
  hasWriteCapability,
  isDocumentOwner,
} from "@/lib/access";
import type { AuthUser } from "@/lib/access";

const HTML_MAX_BYTES = 1_048_576;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidFormat(value: unknown): value is "markdown" | "static-html" {
  return value === "markdown" || value === "static-html";
}

async function getOwnershipContext(
  request: NextRequest,
): Promise<{ isAdminToken: boolean; user: AuthUser | null }> {
  const configuredToken = process.env.PORTAL_GUIDE_WRITE_TOKEN?.trim();
  if (configuredToken && request.headers.get("x-portal-admin-token") === configuredToken) {
    return { isAdminToken: true, user: null };
  }
  const access = await resolveAccessContextFromRequest(request);
  return { isAdminToken: false, user: access.user };
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

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const guide = await getGuide(id);
  if (!guide) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(guide);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await checkWriteAccess(request);
  if (denied) return denied;

  const { id } = await params;
  const guide = await getGuide(id);
  if (!guide) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (guide.readonly) {
    return NextResponse.json(
      { error: "This guide is read-only." },
      { status: 403 },
    );
  }

  const { isAdminToken, user } = await getOwnershipContext(request);
  if (!isAdminToken && !isDocumentOwner(guide.author, user)) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Only the author can modify this document." } },
      { status: 403 },
    );
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid guide payload." }, { status: 400 });
  }

  const format = isValidFormat(body.format) ? body.format : undefined;

  if (format === "static-html" && isNonEmptyString(body.content)) {
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

  const isHtml = format === "static-html";
  const updates = {
    title: isNonEmptyString(body.title) ? body.title.trim() : undefined,
    category: isNonEmptyString(body.category) ? body.category.trim() : undefined,
    content: isNonEmptyString(body.content)
      ? isHtml ? body.content : body.content.trim()
      : undefined,
    author: isNonEmptyString(body.author) ? body.author.trim() : undefined,
    format,
  };

  if (
    !updates.title &&
    !updates.category &&
    !updates.content &&
    !updates.author &&
    updates.format === undefined
  ) {
    return NextResponse.json(
      { error: "At least one updatable field is required." },
      { status: 400 },
    );
  }

  const updated = await updateGuide(id, updates);
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(updated);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await checkWriteAccess(request);
  if (denied) return denied;

  const { id } = await params;
  const guide = await getGuide(id);
  if (!guide) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (guide.readonly) {
    return NextResponse.json(
      { error: "This guide is read-only." },
      { status: 403 },
    );
  }

  const { isAdminToken, user } = await getOwnershipContext(request);
  if (!isAdminToken && !isDocumentOwner(guide.author, user)) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Only the author can modify this document." } },
      { status: 403 },
    );
  }

  if (!(await deleteGuide(id))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return new NextResponse(null, { status: 204 });
}
