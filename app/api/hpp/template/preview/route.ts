import { NextRequest, NextResponse } from 'next/server';
import { getTemplateMasterData } from '@/lib/queries/hpp_template';
import { query } from '@/lib/db';
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
    const rawData: any[] = xlsx.utils.sheet_to_json(wsIsian);

    // Dapatkan data master untuk validasi
    const masterData = await getTemplateMasterData();
    const validMenuIds = new Set(masterData.menus.map(m => Number(m.menu_id)));
    const validBahanIds = new Set(masterData.ingredients.map(b => Number(b.bahan_id)));
    const validSatuan = new Set(masterData.units.map(u => u?.toString().toLowerCase()));

    // Kumpulkan semua menu_id yang ada di upload untuk fetch data DB sekaligus
    const uploadedMenuIds = Array.from(new Set(
      rawData
        .map(r => Number(r.menu_id))
        .filter(id => !isNaN(id) && id > 0)
    ));

    // Fetch data resep yang ADA di database untuk menu-menu tersebut
    // Key: "menu_id:ingredient_id" → { quantity, unit }
    const existingMap = new Map<string, { quantity: number; unit: string }>();
    // Track semua bahan per menu yang ada di DB (untuk deteksi REMOVED)
    const existingByMenu = new Map<number, Set<number>>();

    if (uploadedMenuIds.length > 0) {
      const dbRes = await query(`
        SELECT DISTINCT ON (m.id, ri.ingredient_id)
          m.id AS menu_id,
          ri.ingredient_id AS bahan_id,
          ri.quantity,
          ri.unit
        FROM recipe_ingredients ri
        JOIN recipes r ON r.id = ri.recipe_id
        JOIN menus m ON m.id = r.menu_id
        WHERE m.id = ANY($1::int[])
        ORDER BY m.id, ri.ingredient_id, r.venue_id
      `, [uploadedMenuIds]);

      for (const row of dbRes.rows) {
        const key = `${row.menu_id}:${row.bahan_id}`;
        existingMap.set(key, {
          quantity: Number(row.quantity),
          unit: String(row.unit || '').trim().toLowerCase()
        });
        if (!existingByMenu.has(Number(row.menu_id))) {
          existingByMenu.set(Number(row.menu_id), new Set());
        }
        existingByMenu.get(Number(row.menu_id))!.add(Number(row.bahan_id));
      }
    }

    // Track bahan yang diupload per menu (untuk deteksi REMOVED)
    const uploadedByMenu = new Map<number, Set<number>>();

    const previewResult = [];
    let validCount = 0;
    let errorCount = 0;
    let changedCount = 0;

    for (let i = 0; i < rawData.length; i++) {
      const row = rawData[i];
      let isValid = true;
      let errorMessage = '';

      const menu_id = Number(row.menu_id);
      const bahan_id = Number(row.bahan_id);
      const takaran = Number(row.takaran);
      const satuan = row.satuan?.toString().trim();
      const nama_varian = row.nama_varian?.toString().trim() || '';

      // Skip row kosong atau contoh
      if (!row.menu_id && !row.bahan_id && !row.takaran) continue;
      if (menu_id === 0 && bahan_id === 0) continue;

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

      // Track bahan per menu yang diupload
      if (!uploadedByMenu.has(menu_id)) uploadedByMenu.set(menu_id, new Set());
      uploadedByMenu.get(menu_id)!.add(bahan_id);

      // Deteksi perubahan (diff) vs data DB
      let changeStatus: 'NEW' | 'CHANGED' | 'UNCHANGED' | 'ERROR' = 'UNCHANGED';
      let changeDetail = '';

      if (isValid) {
        const key = `${menu_id}:${bahan_id}`;
        const existing = existingMap.get(key);

        if (!existing) {
          // Bahan baru yang tidak ada di resep sebelumnya
          changeStatus = 'NEW';
          changeDetail = 'Bahan baru ditambahkan ke resep ini';
          changedCount++;
        } else {
          // Bandingkan takaran dan satuan
          const takaranChanged = Math.abs(existing.quantity - takaran) > 0.0001;
          const satuanChanged = existing.unit !== satuan.toLowerCase();

          if (takaranChanged || satuanChanged) {
            changeStatus = 'CHANGED';
            const details = [];
            if (takaranChanged) details.push(`Takaran: ${existing.quantity} → ${takaran}`);
            if (satuanChanged) details.push(`Satuan: ${existing.unit} → ${satuan}`);
            changeDetail = details.join(', ');
            changedCount++;
          }
        }

        validCount++;
      } else {
        changeStatus = 'ERROR';
        errorCount++;
      }

      previewResult.push({
        row_index: i + 2,
        menu_id,
        nama_menu: row.nama_menu || '-',
        nama_varian: nama_varian || '-',
        bahan_id,
        nama_bahan: row.nama_bahan || '-',
        takaran,
        satuan: satuan || '-',
        isValid,
        errorMessage: errorMessage.trim(),
        changeStatus,
        changeDetail
      });
    }

    // Deteksi bahan yang DIHAPUS (ada di DB tapi tidak ada di upload)
    const removedRows = [];
    for (const [menuId, dbBahanSet] of existingByMenu.entries()) {
      const uploadedBahanSet = uploadedByMenu.get(menuId) || new Set();
      for (const bahanId of dbBahanSet) {
        if (!uploadedBahanSet.has(bahanId)) {
          // Cari nama bahan dari master data
          const bahanInfo = masterData.ingredients.find(b => Number(b.bahan_id) === bahanId);
          const menuInfo = masterData.menus.find(m => Number(m.menu_id) === menuId);
          removedRows.push({
            row_index: null,
            menu_id: menuId,
            nama_menu: (menuInfo as any)?.nama_menu || '-',
            nama_varian: (menuInfo as any)?.nama_varian || '-',
            bahan_id: bahanId,
            nama_bahan: (bahanInfo as any)?.nama_bahan || String(bahanId),
            takaran: null,
            satuan: '-',
            isValid: true,
            errorMessage: '',
            changeStatus: 'REMOVED',
            changeDetail: 'Bahan ini akan dihapus dari resep'
          });
          changedCount++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: [...previewResult, ...removedRows],
      summary: {
        total: previewResult.length,
        valid: validCount,
        error: errorCount,
        changed: changedCount,
        hasChanges: changedCount > 0
      }
    });
  } catch (error: any) {
    console.error('Error previewing template:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
