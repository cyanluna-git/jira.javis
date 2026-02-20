import BundleContent from "./BundleContent";
import { NavigationButtons } from "@/components/NavigationButtons";

export const dynamic = 'force-dynamic';

export default function BundlesPage() {
  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 flex items-center gap-4">
          <NavigationButtons />
          <h1 className="text-3xl font-bold text-gray-900">Bundle Board</h1>
        </div>

        <BundleContent />
      </div>
    </div>
  );
}
