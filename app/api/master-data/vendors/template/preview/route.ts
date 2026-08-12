import { NextRequest, NextResponse } from 'next/server';
import * as xlsx from 'xlsx';
import { getTemplateVendors } from '@/lib/queries/vendor_template';

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
    // Pastikan membaca semua data, kita gunakan raw: false agar angka seperti telepon dibaca sebagai teks (string)
    const rawData: any[] = xlsx.utils.sheet_to_json(wsIsian, { raw: false, defval: '' });

    // Dapatkan data master untuk validasi update
    const vendors = await getTemplateVendors();
    const existingVendorIds = new Set(vendors.map(v => Number(v.vendor_id)));

    const previewResult = [];
    let validCount = 0;
    let errorCount = 0;
    let insertCount = 0;
    let updateCount = 0;

    for (let i = 0; i < rawData.length; i++) {
      const row = rawData[i];
      let isValid = true;
      let errorMessage = '';

      let vendor_id: number | null = null;
      if (row.id_vendor && row.id_vendor !== '') {
         vendor_id = Number(row.id_vendor);
      }
      
      const vendor_type = row.tipe_vendor?.toString().trim().toUpperCase();
      const vendor_name = row.nama_vendor?.toString().trim();
      const status = row.status?.toString().trim().toUpperCase();

      // Skip row kosong (termasuk row contoh)
      if (!vendor_id && (!vendor_name || vendor_name.startsWith('Contoh:'))) continue;

      let action = 'INSERT';

      if (vendor_id !== null) {
        if (isNaN(vendor_id) || !existingVendorIds.has(vendor_id)) {
          // Jika ID bukan angka atau tidak ditemukan di DB (misal ID dari sistem lama perusahaannya),
          // sistem akan menyesuaikan dengan mengabaikan ID tersebut dan memasukkannya sebagai data baru.
          action = 'INSERT';
          vendor_id = null;
        } else {
          action = 'UPDATE';
        }
      }

      if (!vendor_name) {
        isValid = false;
        errorMessage += 'Nama vendor wajib diisi. ';
      }

      if (vendor_type !== 'INDIVIDU' && vendor_type !== 'PERUSAHAAN') {
        isValid = false;
        errorMessage += 'Tipe harus INDIVIDU atau PERUSAHAAN. ';
      }

      if (status !== 'AKTIF' && status !== 'NONAKTIF') {
        isValid = false;
        errorMessage += 'Status harus AKTIF atau NONAKTIF. ';
      }

      if (isValid) {
        validCount++;
        if (action === 'INSERT') insertCount++;
        if (action === 'UPDATE') updateCount++;
      } else {
        errorCount++;
      }

      previewResult.push({
        row_index: i + 2, // Asumsi baris 1 adalah header
        vendor_id,
        action,
        vendor_type,
        vendor_name,
        status,
        phone: row.telepon || null,
        email: row.email || null,
        contact_person: row.kontak_person || null,
        website: row.website || null,
        address_1: row.alamat_1 || null,
        address_2: row.alamat_2 || null,
        city: row.kota || null,
        province: row.provinsi || null,
        postal_code: row.kode_pos || null,
        country: row.negara || null,
        npwp: row.npwp || null,
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
        error: errorCount,
        insert: insertCount,
        update: updateCount
      }
    });
  } catch (error: any) {
    console.error('Error previewing vendor template:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
