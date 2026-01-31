'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Home } from 'lucide-react';

export function NavigationButtons() {
  const router = useRouter();

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => router.back()}
        className="p-2 bg-white rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
        aria-label="Go back"
      >
        <ArrowLeft className="w-5 h-5 text-gray-600" />
      </button>
      <Link
        href="/"
        className="p-2 bg-white rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
        aria-label="Go to home"
      >
        <Home className="w-5 h-5 text-gray-600" />
      </Link>
    </div>
  );
}
