import Link from "next/link";
import { ArrowLeft, Headphones } from "lucide-react";
import ServiceDeskContent from "./ServiceDeskContent";
import { getServiceDeskData } from "@/lib/service-desk";

export const dynamic = 'force-dynamic';

export default async function ServiceDeskPage() {
  let initialData;
  let error: string | null = null;

  try {
    initialData = await getServiceDeskData({ businessUnit: 'all' });
  } catch (e) {
    console.error('Error fetching initial data:', e);
    error = 'Failed to load service desk data';
    initialData = {
      tickets: [],
      stats: {
        total: 0,
        open: 0,
        inProgress: 0,
        resolved: 0,
        resolvedPercent: 0,
        byStatus: [],
        byComponent: [],
      },
      filterOptions: {
        statuses: [],
        assignees: [],
        priorities: [],
      },
      pagination: {
        page: 1,
        pageSize: 50,
        totalPages: 0,
        totalCount: 0,
      },
      tabCounts: {
        all: 0,
        'integrated-systems': 0,
        abatement: 0,
      },
    };
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-center gap-4">
          <Link
            href="/"
            className="p-2 bg-white rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </Link>
          <div className="flex items-center gap-3">
            <div className="bg-rose-100 p-2 rounded-lg">
              <Headphones className="w-6 h-6 text-rose-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Service Desk</h1>
              <p className="text-sm text-gray-500">PSSM Ticket Queue</p>
            </div>
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {/* Content */}
        <ServiceDeskContent initialData={initialData} />
      </div>
    </div>
  );
}
