import { NextResponse } from 'next/server';
import * as xlsx from 'xlsx';
import { PURCHASE_UNITS, SMALLEST_UNITS } from '@/lib/constants/units';
import { getTemplateCategories, getTemplateItems } from '@/lib/queries/item_template';

export async function GET() {
  try {
    const [items, categories] = await Promise.all([
      getTemplateItems(),
      getTemplateCategories(),
    ]);

    const isianData = items.map((row) => ({
      id_barang: Number(row.item_id),
      nama_barang: row.nama_barang,
      kategori: row.kategori,
      satuan_beli: row.satuan_beli,
      satuan_terkecil: row.satuan_terkecil,
      rasio_konversi: Number(row.rasio_konversi),
      batas_minimum: Number(row.batas_minimum),
      tipe_batas: row.tipe_batas || 'ABSOLUT',
      stok_target: Number(row.stok_target ?? 0),
      harga_rata: Number(row.harga_rata ?? 0),
      barcode: row.barcode || '',
      status: row.status || 'AKTIF',
      is_perishable: row.is_perishable || 'TIDAK',
    }));

    if (isianData.length === 0) {
      isianData.push({
        id_barang: '' as unknown as number,
        nama_barang: 'Contoh: Arabica Blend Premium',
        kategori: categories[0]?.name || 'Bahan Baku',
        satuan_beli: 'Dus',
        satuan_terkecil: 'ml',
        rasio_konversi: 10000,
        batas_minimum: 100000,
        tipe_batas: 'ABSOLUT',
        stok_target: 0,
        harga_rata: 50,
        barcode: '',
        status: 'AKTIF',
        is_perishable: 'TIDAK',
      });
    }

    const wsIsian = xlsx.utils.json_to_sheet(isianData);
    wsIsian['!cols'] = [
      { wch: 12 },
      { wch: 35 },
      { wch: 20 },
      { wch: 14 },
      { wch: 16 },
      { wch: 14 },
      { wch: 14 },
      { wch: 12 },
      { wch: 12 },
      { wch: 14 },
      { wch: 14 },
      { wch: 12 },
      { wch: 14 },
    ];

    const wsPetunjuk = xlsx.utils.json_to_sheet([
      { Info: 'PANDUAN PENGISIAN TEMPLATE EXCEL MASTER BARANG' },
      { Info: '1. Jangan mengubah nama kolom pada Sheet Isian.' },
      { Info: '2. Untuk TAMBAH data baru, biarkan kolom id_barang KOSONG.' },
      { Info: '3. Untuk UPDATE data lama, JANGAN UBAH id_barang yang sudah ada.' },
      { Info: '4. Kolom kategori harus sama persis dengan nama di sheet Referensi Kategori.' },
      { Info: '5. Satuan beli / satuan terkecil harus ada di sheet referensi satuan.' },
      { Info: '6. tipe_batas: ABSOLUT atau PERSENTASE.' },
      { Info: '7. status: AKTIF atau NONAKTIF.' },
      { Info: '8. is_perishable: YA atau TIDAK.' },
      { Info: '9. Jika barcode kosong saat INSERT, sistem akan membuat barcode otomatis (ERC######).' },
      { Info: '10. Template hanya untuk barang induk (bukan brand/anak).' },
    ]);
    wsPetunjuk['!cols'] = [{ wch: 110 }];

    const wsKategori = xlsx.utils.json_to_sheet(
      categories.map((c) => ({ id_kategori: Number(c.id), nama_kategori: c.name }))
    );
    wsKategori['!cols'] = [{ wch: 12 }, { wch: 30 }];

    const wsSatuanBeli = xlsx.utils.json_to_sheet(
      PURCHASE_UNITS.map((u) => ({ satuan: u }))
    );
    wsSatuanBeli['!cols'] = [{ wch: 16 }];

    const wsSatuanTerkecil = xlsx.utils.json_to_sheet(
      SMALLEST_UNITS.map((u) => ({ satuan: u }))
    );
    wsSatuanTerkecil['!cols'] = [{ wch: 16 }];

    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, wsIsian, 'Isian');
    xlsx.utils.book_append_sheet(wb, wsPetunjuk, 'Petunjuk');
    xlsx.utils.book_append_sheet(wb, wsKategori, 'Referensi Kategori');
    xlsx.utils.book_append_sheet(wb, wsSatuanBeli, 'Referensi Satuan Beli');
    xlsx.utils.book_append_sheet(wb, wsSatuanTerkecil, 'Referensi Satuan Terkecil');

    const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Disposition': 'attachment; filename="Template_Master_Barang.xlsx"',
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      },
    });
  } catch (error: unknown) {
    console.error('Error generating item template:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}
