import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getSettings, updateSettings } from '@/lib/queries/settings';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  
  try {
    const settings = await getSettings();
    return NextResponse.json({ success: true, data: settings });
  } catch (err) {
    return NextResponse.json({ success: false, message: 'Gagal memuat pengaturan' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN_PUSAT') {
    return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await req.json();
    await updateSettings(body);
    return NextResponse.json({ success: true, message: 'Pengaturan berhasil disimpan' });
  } catch (err) {
    return NextResponse.json({ success: false, message: 'Gagal menyimpan pengaturan' }, { status: 500 });
  }
}
