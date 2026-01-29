import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import BundleContent from "./BundleContent";

export const dynamic = 'force-dynamic';

export default function BundlesPage() {
  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 flex items-center gap-4">
          <Link href="/" className="p-2 bg-white rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Bundle Board</h1>
        </div>

        <BundleContent />
      </div>
    </div>
  );
}
