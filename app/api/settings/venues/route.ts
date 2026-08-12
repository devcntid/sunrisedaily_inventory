import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getVenues } from '@/lib/queries/master';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, message: 'Unauthorized', data: null }, { status: 401 });

  try {
    const venues = await getVenues();
    return NextResponse.json({ success: true, message: 'OK', data: venues });
  } catch (error: unknown) {
    return NextResponse.json({ success: false, message: 'Gagal mengambil data', data: null }, { status: 500 });
  }
}
