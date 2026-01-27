import { Suspense } from 'react';
import MemberDashboard from './MemberDashboard';

export const dynamic = 'force-dynamic';

export default function MembersPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <MemberDashboard />
    </Suspense>
  );
}

function LoadingState() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <span className="text-gray-600">Loading members...</span>
      </div>
    </div>
  );
}
