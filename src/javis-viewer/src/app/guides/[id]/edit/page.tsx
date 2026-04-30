import { notFound } from "next/navigation";
import { getGuide } from "@/lib/guides-store";
import { resolveServerAccessContext, hasWriteCapability } from "@/lib/access";
import GuideEditClient from "./GuideEditClient";

export default async function GuideEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [guide, access] = await Promise.all([
    getGuide(id),
    resolveServerAccessContext(),
  ]);

  if (!guide) notFound();

  if (!hasWriteCapability(access, "general") || guide.readonly) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="max-w-sm text-center">
          <p className="text-lg font-semibold text-slate-900">Access Denied</p>
          <p className="mt-2 text-sm text-slate-500">
            Write access is required to edit this document.
          </p>
        </div>
      </div>
    );
  }

  const authorName =
    access.user?.name || access.user?.email || access.user?.username || "admin";

  return (
    <GuideEditClient
      id={id}
      format={guide.format ?? "markdown"}
      initialTitle={guide.title}
      initialCategory={guide.category}
      initialContent={guide.content}
      authorName={authorName}
    />
  );
}
