import { NextRequest, NextResponse } from 'next/server';
import { getServiceDeskData } from '@/lib/service-desk';
import type { BusinessUnit } from '@/types/service-desk';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  const businessUnit = (searchParams.get('businessUnit') || 'all') as BusinessUnit;
  const status = searchParams.get('status') || undefined;
  const assignee = searchParams.get('assignee') || undefined;
  const priority = searchParams.get('priority') || undefined;
  const search = searchParams.get('search') || undefined;
  const page = parseInt(searchParams.get('page') || '1');
  const pageSize = parseInt(searchParams.get('pageSize') || '50');

  try {
    const data = await getServiceDeskData({
      businessUnit,
      status,
      assignee,
      priority,
      search,
      page,
      pageSize,
    });

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching service desk tickets:', error);
    return NextResponse.json(
      { error: 'Failed to fetch service desk tickets' },
      { status: 500 }
    );
  }
}
