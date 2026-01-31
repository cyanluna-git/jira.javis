import pool from "@/lib/db";
import OperationsContent from "./OperationsContent";
import { NavigationButtons } from "@/components/NavigationButtons";

export const dynamic = 'force-dynamic';

interface Operation {
  id: string;
  operation_type: string;
  target_type: string;
  target_ids: string[];
  status: string;
  error_message: string | null;
  created_by: string | null;
  approved_by: string | null;
  created_at: string;
  approved_at: string | null;
  executed_at: string | null;
}

interface StatusCounts {
  pending: number;
  approved: number;
  executing: number;
  completed: number;
  failed: number;
  cancelled: number;
}

async function getOperations(): Promise<{ operations: Operation[]; counts: StatusCounts }> {
  const client = await pool.connect();
  try {
    const operationsResult = await client.query(`
      SELECT
        id, operation_type, target_type, target_ids,
        status, error_message, created_by, approved_by,
        created_at, approved_at, executed_at
      FROM content_operations
      ORDER BY created_at DESC
      LIMIT 100
    `);

    const countsResult = await client.query(`
      SELECT status, COUNT(*) as count
      FROM content_operations
      GROUP BY status
    `);

    const counts: StatusCounts = {
      pending: 0,
      approved: 0,
      executing: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
    };

    countsResult.rows.forEach(row => {
      if (row.status in counts) {
        counts[row.status as keyof StatusCounts] = parseInt(row.count);
      }
    });

    return {
      operations: operationsResult.rows,
      counts,
    };
  } finally {
    client.release();
  }
}

export default async function OperationsPage() {
  let data: { operations: Operation[]; counts: StatusCounts };

  try {
    data = await getOperations();
  } catch (error) {
    // Table might not exist yet
    console.error('Error loading operations:', error);
    data = {
      operations: [],
      counts: { pending: 0, approved: 0, executing: 0, completed: 0, failed: 0, cancelled: 0 }
    };
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex items-center gap-4">
          <NavigationButtons />
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Content Operations</h1>
            <p className="text-gray-500 mt-1">Manage AI-driven content operations queue</p>
          </div>
        </div>

        <OperationsContent
          initialOperations={data.operations}
          initialCounts={data.counts}
        />
      </div>
    </div>
  );
}
