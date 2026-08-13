import { NextResponse } from 'next/server';
import { getTemplateMasterData, getTemplateRecipeData } from '@/lib/queries/hpp_template';
import * as xlsx from 'xlsx';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const masterData = await getTemplateMasterData();
    const recipeData = await getTemplateRecipeData();

    // 1. Siapkan Sheet Isian
    const isianData = recipeData.map(r => ({
      menu_id: Number(r.menu_id),
      nama_menu: r.nama_menu,
      nama_varian: r.nama_varian || '',
      bahan_id: Number(r.bahan_id),
      nama_bahan: r.nama_bahan,
      takaran: Number(r.takaran),
      satuan: r.satuan
    }));

    // Jika belum ada resep sama sekali, kita isi 1 baris kosong sebagai contoh
    if (isianData.length === 0) {
      isianData.push({
        menu_id: 0,
        nama_menu: 'Contoh: Butterscotch Coffee (Ganti/Hapus baris ini)',
        nama_varian: 'Hot Medium',
        bahan_id: 0,
        nama_bahan: 'Contoh: Kopi',
        takaran: 10,
        satuan: 'Gram'
      });
    }

    const wsIsian = xlsx.utils.json_to_sheet(isianData);
    wsIsian['!cols'] = [
      { wch: 10 }, // menu_id
      { wch: 30 }, // nama_menu
      { wch: 20 }, // nama_varian
      { wch: 10 }, // bahan_id
      { wch: 35 }, // nama_bahan
      { wch: 15 }, // takaran
      { wch: 15 }, // satuan
    ];

    // 2. Siapkan Sheet Referensi Menu
    const wsRefMenu = xlsx.utils.json_to_sheet(
      masterData.menus.map(m => ({
        menu_id: Number(m.menu_id),
        nama_menu: m.nama_menu,
        nama_varian: m.nama_varian || '',
        display_name: m.display_name
      }))
    );
    wsRefMenu['!cols'] = [{ wch: 10 }, { wch: 30 }, { wch: 25 }, { wch: 40 }];

    // 3. Siapkan Sheet Referensi Bahan
    const wsRefBahan = xlsx.utils.json_to_sheet(
      masterData.ingredients.map(b => ({
        bahan_id: Number(b.bahan_id),
        nama_bahan: b.nama_bahan,
        satuan_default: b.satuan
      }))
    );
    wsRefBahan['!cols'] = [{ wch: 10 }, { wch: 35 }, { wch: 15 }];

    // 4. Siapkan Sheet Referensi Satuan
    const wsRefSatuan = xlsx.utils.json_to_sheet(
      masterData.units.map(u => ({
        satuan: u
      }))
    );
    wsRefSatuan['!cols'] = [{ wch: 20 }];

    // 5. Siapkan Sheet Petunjuk
    const petunjukData = [
      { Info: 'PANDUAN PENGISIAN TEMPLATE EXCEL RESEP HPP' },
      { Info: '1. Jangan mengubah nama kolom pada Sheet Isian.' },
      { Info: '2. Gunakan menu_id dan bahan_id yang valid sesuai dengan Sheet Referensi.' },
      { Info: '3. Takaran harus berupa angka lebih dari 0 (misal: 1 atau 1.5).' },
      { Info: '4. Satu menu dapat memiliki banyak bahan, cukup tuliskan menu_id berulang-ulang untuk setiap bahan.' },
      { Info: '5. Data pada Sheet Isian akan menimpa (REPLACE) semua resep lama untuk menu_id yang disebutkan.' },
      { Info: '6. Nama Menu dan Nama Bahan hanya sebagai bantuan pembacaan, sistem membaca ID.' }
    ];
    const wsPetunjuk = xlsx.utils.json_to_sheet(petunjukData);
    wsPetunjuk['!cols'] = [{ wch: 100 }];

    // Buat Workbook
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, wsIsian, 'Isian');
    xlsx.utils.book_append_sheet(wb, wsPetunjuk, 'Petunjuk');
    xlsx.utils.book_append_sheet(wb, wsRefMenu, 'Referensi Menu');
    xlsx.utils.book_append_sheet(wb, wsRefBahan, 'Referensi Bahan');
    xlsx.utils.book_append_sheet(wb, wsRefSatuan, 'Referensi Satuan');

    // Menghasilkan buffer
    const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

    // Return response
    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Disposition': 'attachment; filename="Template_Resep_HPP.xlsx"',
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }
    });

  } catch (error: any) {
    console.error('Error generating template:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
