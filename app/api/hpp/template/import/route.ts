import { NextRequest, NextResponse } from 'next/server';
import { importMenuRecipesForAllVenues, ValidatedRecipeRow } from '@/lib/queries/hpp_template';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { data } = body;

    if (!data || !Array.isArray(data)) {
      return NextResponse.json({ error: 'Data tidak valid' }, { status: 400 });
    }

    const rows: ValidatedRecipeRow[] = data.map((d: any) => ({
      menu_id: Number(d.menu_id),
      bahan_id: Number(d.bahan_id),
      takaran: Number(d.takaran),
      satuan: String(d.satuan)
    }));

    // Filter out invalid rows (just in case they slipped through)
    const validRows = rows.filter(r => !isNaN(r.menu_id) && !isNaN(r.bahan_id) && !isNaN(r.takaran) && r.takaran > 0);

    await importMenuRecipesForAllVenues(validRows);

    return NextResponse.json({
      success: true,
      message: 'Data resep berhasil di-import'
    });
  } catch (error: any) {
    console.error('Error importing template:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
