export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getHppVariants } from '@/lib/queries/hpp';

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const variants = await getHppVariants();
    return NextResponse.json({ success: true, data: variants });
  } catch (error: unknown) {
    console.error('Error fetching variants:', error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}
