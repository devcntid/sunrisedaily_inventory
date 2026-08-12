import { NextRequest, NextResponse } from 'next/server';
import { getTemplateMasterData } from '@/lib/queries/hpp_template';
import * as xlsx from 'xlsx';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'Tidak ada file yang diunggah' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const wb = xlsx.read(buffer, { type: 'buffer' });
    
    const isianSheetName = wb.SheetNames.find(s => s.toLowerCase() === 'isian');
    if (!isianSheetName) {
      return NextResponse.json({ error: 'Sheet "Isian" tidak ditemukan di dalam file Excel' }, { status: 400 });
    }

    const wsIsian = wb.Sheets[isianSheetName];
    // Pastikan membaca semua data, kita gunakan raw: false agar angka tidak kacau, dsb (sesuaikan jika perlu)
    const rawData: any[] = xlsx.utils.sheet_to_json(wsIsian);

    // Dapatkan data master untuk validasi
    const masterData = await getTemplateMasterData();
    const validMenuIds = new Set(masterData.menus.map(m => Number(m.menu_id)));
    const validBahanIds = new Set(masterData.ingredients.map(b => Number(b.bahan_id)));
    const validSatuan = new Set(masterData.units.map(u => u?.toString().toLowerCase()));

    const previewResult = [];
    let validCount = 0;
    let errorCount = 0;

    for (let i = 0; i < rawData.length; i++) {
      const row = rawData[i];
      let isValid = true;
      let errorMessage = '';

      const menu_id = Number(row.menu_id);
      const bahan_id = Number(row.bahan_id);
      const takaran = Number(row.takaran);
      const satuan = row.satuan?.toString().trim();

      // Skip row kosong atau header example
      if (!row.menu_id && !row.bahan_id && !row.takaran) continue;
      if (menu_id === 0 && bahan_id === 0) continue; // Contoh baris

      // Validasi
      if (isNaN(menu_id) || !validMenuIds.has(menu_id)) {
        isValid = false;
        errorMessage += 'Menu ID tidak valid atau tidak ditemukan. ';
      }
      
      if (isNaN(bahan_id) || !validBahanIds.has(bahan_id)) {
        isValid = false;
        errorMessage += 'Bahan ID tidak valid atau tidak ditemukan. ';
      }

      if (isNaN(takaran) || takaran <= 0) {
        isValid = false;
        errorMessage += 'Takaran harus berupa angka lebih besar dari 0. ';
      }

      if (!satuan || !validSatuan.has(satuan.toLowerCase())) {
        isValid = false;
        errorMessage += 'Satuan tidak valid. ';
      }

      if (isValid) {
        validCount++;
      } else {
        errorCount++;
      }

      previewResult.push({
        row_index: i + 2, // Asumsi baris 1 adalah header
        menu_id,
        nama_menu: row.nama_menu || '-',
        bahan_id,
        nama_bahan: row.nama_bahan || '-',
        takaran,
        satuan: satuan || '-',
        isValid,
        errorMessage: errorMessage.trim()
      });
    }

    return NextResponse.json({
      success: true,
      data: previewResult,
      summary: {
        total: previewResult.length,
        valid: validCount,
        error: errorCount
      }
    });
  } catch (error: any) {
    console.error('Error previewing template:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
