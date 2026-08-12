import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getPurchaseOrderById } from '@/lib/queries/purchase-orders';
import { jsPDF } from 'jspdf';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });

  const { id } = await params;
  const po = await getPurchaseOrderById(Number(id));
  if (!po) return new NextResponse('Not found', { status: 404 });

  // Hanya perhitungkan barang yang qty > total_received (barang yang kurang)
  const missingItems = po.items.filter((item: any) => {
    const receivedSoFar = Number(item.total_received) || 0;
    return item.qty > receivedSoFar;
  });

  if (missingItems.length === 0) {
    return new NextResponse('Tidak ada barang yang kurang untuk PO ini.', { status: 400 });
  }

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  // Font styles
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("LAPORAN KEKURANGAN BARANG (RETUR)", 105, 15, { align: 'center' });

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`No. PO: ${po.po_number}`, 14, 25);
  doc.text(`Vendor: ${po.vendor_name}`, 14, 30);
  doc.text(`Tgl. Order: ${new Date(po.order_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}`, 14, 35);
  doc.text(`Tgl. Cetak Laporan: ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}`, 14, 40);

  const startY = 48;
  const rowH = 8;
  
  // Columns: No | Nama Barang | Pesan | Diterima | Kurang | Satuan
  const colX = [14, 24, 100, 125, 150, 175, 196];

  doc.setFillColor(200, 200, 200);
  doc.rect(colX[0], startY, colX[6] - colX[0], 8, 'FD');

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("No", colX[0] + 5, startY + 5.5, { align: 'center' });
  doc.text("Nama Barang", colX[1] + 38, startY + 5.5, { align: 'center' });
  doc.text("Pesan", colX[2] + 12.5, startY + 5.5, { align: 'center' });
  doc.text("Diterima", colX[3] + 12.5, startY + 5.5, { align: 'center' });
  doc.text("Kurang", colX[4] + 12.5, startY + 5.5, { align: 'center' });
  doc.text("Satuan", colX[5] + 10.5, startY + 5.5, { align: 'center' });

  for (let i = 1; i < 7; i++) doc.line(colX[i], startY, colX[i], startY + 8);

  // Table Body
  doc.setFont("helvetica", "normal");
  let y = startY + 8;
  let index = 1;

  for (const item of missingItems) {
    if (y > 270) {
      doc.addPage();
      y = 15;
      
      // Re-draw headers on new page
      doc.setFillColor(200, 200, 200);
      doc.rect(colX[0], y, colX[6] - colX[0], 8, 'FD');
      doc.setFont("helvetica", "bold");
      doc.text("No", colX[0] + 5, y + 5.5, { align: 'center' });
      doc.text("Nama Barang", colX[1] + 38, y + 5.5, { align: 'center' });
      doc.text("Pesan", colX[2] + 12.5, y + 5.5, { align: 'center' });
      doc.text("Diterima", colX[3] + 12.5, y + 5.5, { align: 'center' });
      doc.text("Kurang", colX[4] + 12.5, y + 5.5, { align: 'center' });
      doc.text("Satuan", colX[5] + 10.5, y + 5.5, { align: 'center' });
      for (let i = 1; i < 7; i++) doc.line(colX[i], y, colX[i], y + 8);
      
      y += 8;
      doc.setFont("helvetica", "normal");
    }

    const receivedSoFar = Number(item.total_received) || 0;
    const missingQty = item.qty - receivedSoFar;

    doc.rect(colX[0], y, colX[6] - colX[0], rowH, 'S'); // Row outline
    for (let i = 1; i < 7; i++) doc.line(colX[i], y, colX[i], y + rowH);

    doc.text(index.toString(), colX[0] + 5, y + 5.5, { align: 'center' });
    doc.text((item.description || '').substring(0, 45), colX[1] + 2, y + 5.5);
    doc.text(Number(item.qty).toLocaleString('id-ID'), colX[2] + 12.5, y + 5.5, { align: 'center' });
    doc.text(receivedSoFar.toLocaleString('id-ID'), colX[3] + 12.5, y + 5.5, { align: 'center' });
    
    doc.setFont("helvetica", "bold");
    doc.setTextColor(220, 38, 38); // Red color for missing qty
    doc.text(missingQty.toLocaleString('id-ID'), colX[4] + 12.5, y + 5.5, { align: 'center' });
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);
    
    doc.text(item.purchase_unit || 'pcs', colX[5] + 10.5, y + 5.5, { align: 'center' });

    y += rowH;
    index++;
  }

  // Footer notes
  y += 10;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Catatan:", 14, y);
  doc.setFont("helvetica", "normal");
  y += 5;
  doc.text("Mohon untuk segera mengirimkan kekurangan barang sesuai dengan daftar di atas.", 14, y);
  y += 5;
  doc.text(`Referensi pesanan: ${po.po_number}`, 14, y);
  
  y += 20;
  doc.text("Dibuat Oleh,", 14, y);
  doc.text("Vendor,", 150, y);
  
  y += 20;
  doc.text("(__________________)", 14, y);
  doc.text("(__________________)", 150, y);

  const pdfBuffer = Buffer.from(doc.output('arraybuffer'));

  return new NextResponse(pdfBuffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="Laporan_Kekurangan_${po.po_number.replace(/\//g, '_')}.pdf"`,
    },
  });
}
