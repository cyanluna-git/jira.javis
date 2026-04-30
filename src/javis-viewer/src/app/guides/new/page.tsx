import { resolveServerAccessContext, hasWriteCapability } from "@/lib/access";
import GuideNewClient from "./GuideNewClient";

export default async function GuideNewPage() {
  const access = await resolveServerAccessContext();

  if (!hasWriteCapability(access, "general")) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="max-w-sm text-center">
          <p className="text-lg font-semibold text-slate-900">Access Denied</p>
          <p className="mt-2 text-sm text-slate-500">
            Write access is required to upload documents.
          </p>
        </div>
      </div>
    );
  }

  const authorName =
    access.user?.name || access.user?.email || access.user?.username || "admin";

  return <GuideNewClient authorName={authorName} />;
}
