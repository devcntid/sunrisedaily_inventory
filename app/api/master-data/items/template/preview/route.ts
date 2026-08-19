import { NextRequest, NextResponse } from 'next/server';
import * as xlsx from 'xlsx';
import { getSession } from '@/lib/auth';
import { buildItemPreviewRows } from '@/lib/queries/item_template';

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN_PUSAT') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'Tidak ada file yang diunggah' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const wb = xlsx.read(buffer, { type: 'buffer' });

    const isianSheetName = wb.SheetNames.find((s) => s.toLowerCase() === 'isian');
    if (!isianSheetName) {
      return NextResponse.json({ error: 'Sheet "Isian" tidak ditemukan di dalam file Excel' }, { status: 400 });
    }

    const wsIsian = wb.Sheets[isianSheetName];
    const rawData = xlsx.utils.sheet_to_json<Record<string, unknown>>(wsIsian, {
      raw: false,
      defval: '',
    });

    const { rows, summary } = await buildItemPreviewRows(rawData);

    return NextResponse.json({
      success: true,
      data: rows,
      summary,
    });
  } catch (error: unknown) {
    console.error('Error previewing item template:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}
