import { NextResponse } from 'next/server';
import { getTemplateVendors } from '@/lib/queries/vendor_template';
import * as xlsx from 'xlsx';

export async function GET() {
  try {
    const vendors = await getTemplateVendors();

    // 1. Siapkan Sheet Isian
    const isianData = vendors.map(v => ({
      id_vendor: Number(v.vendor_id),
      tipe_vendor: v.vendor_type === 'Individual' ? 'INDIVIDU' : 'PERUSAHAAN',
      nama_vendor: v.vendor_name,
      status: v.is_active ? 'AKTIF' : 'NONAKTIF',
      telepon: v.phone || '',
      email: v.email || '',
      kontak_person: v.contact_person || '',
      website: v.website || '',
      alamat_1: v.address_1 || '',
      alamat_2: v.address_2 || '',
      kota: v.city || '',
      provinsi: v.province || '',
      kode_pos: v.postal_code || '',
      negara: v.country || '',
      npwp: v.npwp || ''
    }));

    // Jika belum ada vendor sama sekali, kita isi 1 baris kosong sebagai contoh
    if (isianData.length === 0) {
      isianData.push({
        id_vendor: '' as any, // ID kosong untuk insert baru
        tipe_vendor: 'PERUSAHAAN',
        nama_vendor: 'Contoh: PT ABC',
        status: 'AKTIF',
        telepon: '0812345678',
        email: 'abc@example.com',
        kontak_person: 'Budi',
        website: 'www.abc.com',
        alamat_1: 'Jl. Merdeka No 1',
        alamat_2: '',
        kota: 'Jakarta',
        provinsi: 'DKI Jakarta',
        kode_pos: '10000',
        negara: 'Indonesia',
        npwp: '12.345.678.9-012.000'
      });
    }

    const wsIsian = xlsx.utils.json_to_sheet(isianData);
    wsIsian['!cols'] = [
      { wch: 10 }, // id_vendor
      { wch: 15 }, // tipe_vendor
      { wch: 35 }, // nama_vendor
      { wch: 12 }, // status
      { wch: 15 }, // telepon
      { wch: 25 }, // email
      { wch: 20 }, // kontak_person
      { wch: 25 }, // website
      { wch: 40 }, // alamat_1
      { wch: 25 }, // alamat_2
      { wch: 20 }, // kota
      { wch: 20 }, // provinsi
      { wch: 12 }, // kode_pos
      { wch: 15 }, // negara
      { wch: 20 }  // npwp
    ];

    // 2. Siapkan Sheet Referensi Tipe Supplier
    const wsRefType = xlsx.utils.json_to_sheet([
      { code: 'INDIVIDU', nama: 'Individu' },
      { code: 'PERUSAHAAN', nama: 'Perusahaan' }
    ]);
    wsRefType['!cols'] = [{ wch: 15 }, { wch: 15 }];

    // 3. Siapkan Sheet Referensi Status
    const wsRefStatus = xlsx.utils.json_to_sheet([
      { code: 'AKTIF', nama: 'Aktif' },
      { code: 'NONAKTIF', nama: 'Nonaktif' }
    ]);
    wsRefStatus['!cols'] = [{ wch: 15 }, { wch: 15 }];

    // 4. Siapkan Sheet Petunjuk
    const petunjukData = [
      { Info: 'PANDUAN PENGISIAN TEMPLATE EXCEL MASTER VENDORS' },
      { Info: '1. Jangan mengubah nama kolom pada Sheet Isian.' },
      { Info: '2. Untuk TAMBAH data baru, biarkan kolom id_vendor KOSONG.' },
      { Info: '3. Untuk UPDATE data lama, JANGAN UBAH id_vendor yang sudah ada.' },
      { Info: '4. Nilai yang dikosongkan pada baris UPDATE tidak akan menghapus data lama di database.' },
      { Info: '5. Tipe supplier harus diisi INDIVIDU atau PERUSAHAAN.' },
      { Info: '6. Status harus diisi AKTIF atau NONAKTIF.' }
    ];
    const wsPetunjuk = xlsx.utils.json_to_sheet(petunjukData);
    wsPetunjuk['!cols'] = [{ wch: 100 }];

    // Buat Workbook
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, wsIsian, 'Isian');
    xlsx.utils.book_append_sheet(wb, wsPetunjuk, 'Petunjuk');
    xlsx.utils.book_append_sheet(wb, wsRefType, 'Referensi Tipe');
    xlsx.utils.book_append_sheet(wb, wsRefStatus, 'Referensi Status');

    // Menghasilkan buffer
    const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

    // Return response
    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Disposition': 'attachment; filename="Template_Master_Vendors.xlsx"',
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }
    });

  } catch (error: any) {
    console.error('Error generating template:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
