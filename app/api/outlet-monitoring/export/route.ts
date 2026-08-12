import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getOutletMonitoringData } from '@/lib/queries/outlet-monitoring';
import * as XLSX from 'xlsx';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN_PUSAT') {
    return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
  }

  try {
    const data = await getOutletMonitoringData();
    const { outlets, items, stockMatrix } = data;

    // 1. Susun baris header
    const headers = [
      'Nama Barang',
      'Satuan Terkecil',
      'Satuan Kemasan',
      'Gudang Pusat (Terkecil)',
      'Gudang Pusat (Kemasan)'
    ];

    for (const outlet of outlets) {
      const shortName = outlet.name.replace(/COFFE\s*E?\s*LAB/i, '').trim();
      headers.push(`${shortName} - IN Terkecil`);
      headers.push(`${shortName} - IN Kemasan`);
      headers.push(`${shortName} - OUT Terkecil`);
      headers.push(`${shortName} - OUT Kemasan`);
      headers.push(`${shortName} - Cups (Porsi)`);
      headers.push(`${shortName} - Live Terkecil`);
      headers.push(`${shortName} - Live Kemasan`);
    }

    const rows: unknown[][] = [headers];

    // 2. Isi data tiap item
    for (const item of items) {
      const ratio = Number(item.conversion_ratio) || 1;
      const row: unknown[] = [
        item.name,
        item.smallest_unit || '',
        item.purchase_unit || item.smallest_unit || '',
        Number(item.central_stock || 0),
        Number(item.central_stock || 0) / ratio
      ];

      for (const outlet of outlets) {
        const cell = stockMatrix[item.id]?.[outlet.id] || {
          in_smallest: 0,
          in_package: 0,
          out_smallest: 0,
          out_package: 0,
          cups_sold: 0,
          stock_smallest: 0,
          stock_package: 0
        };

        row.push(
          Number(cell.in_smallest || 0),
          Number(cell.in_package || 0),
          Number(cell.out_smallest || 0),
          Number(cell.out_package || 0),
          Number(cell.cups_sold || 0),
          Number(cell.stock_smallest || 0),
          Number(cell.stock_package || 0)
        );
      }

      rows.push(row);
    }

    // 3. Buat Excel Workbook
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(rows);

    // Atur lebar kolom agar mudah dibaca
    ws['!cols'] = [
      { wch: 30 }, // Nama Barang
      { wch: 15 }, // Satuan Terkecil
      { wch: 15 }, // Satuan Kemasan
      { wch: 22 }, // Gudang Pusat Terkecil
      { wch: 22 }  // Gudang Pusat Kemasan
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Matriks Stok');

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const today = new Date().toISOString().slice(0, 10);

    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="Matriks_Stok_Seluruh_Outlet_${today}.xlsx"`
      }
    });
  } catch (error: unknown) {
    console.error('Export stock monitoring error:', error);
    return NextResponse.json({
      success: false,
      message: (error instanceof Error ? error.message : 'Unknown error') || 'Server error'
    }, { status: 500 });
  }
}
