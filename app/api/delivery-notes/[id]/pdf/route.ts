import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getDeliveryNoteById } from '@/lib/queries/delivery-notes';
import { jsPDF } from 'jspdf';
import bwipjs from 'bwip-js';
import { isBarcodeScanRequired } from '@/lib/queries/settings';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });

  const { id } = await params;
  const dn = await getDeliveryNoteById(Number(id));
  if (!dn) return new NextResponse('Not found', { status: 404 });

  // Ubah ke portrait
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  // Font styles
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(`SURAT JALAN - ${(dn.outlet_name || '').toUpperCase()}`, 105, 15, { align: 'center' });

  // Top header boxes (Tanggal & Barang)
  doc.setFontSize(9);
  doc.setFillColor(195, 224, 181); // Light green background #c3e0b5

  // Tanggal box (kiri)
  doc.rect(14, 25, 85, 6, 'F');
  doc.rect(14, 25, 85, 16, 'S');
  doc.line(14, 31, 99, 31);
  doc.text("Tanggal", 56.5, 29, { align: 'center' });
  doc.setFont("helvetica", "bold");
  doc.text("Pemesanan", 16, 35);
  doc.text("Pengiriman", 60, 35);
  doc.setFont("helvetica", "normal");
  doc.text(new Date(dn.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }), 16, 39);
  doc.text(new Date(dn.delivery_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }), 60, 39);

  // Barang box (kanan)
  doc.setFillColor(195, 224, 181);
  doc.rect(111, 25, 85, 16, 'F');
  doc.rect(111, 25, 85, 16, 'S');
  doc.line(135, 25, 135, 41);
  doc.setFont("helvetica", "bold");
  doc.text("Barang", 113, 30);
  doc.text("Outlet", 113, 38);
  doc.setFont("helvetica", "normal");
  doc.text(dn.outlet_name || '', 137, 38);

  // Note Box (Catatan Pesanan)
  doc.setFillColor(245, 245, 245);
  doc.rect(14, 43, 182, 8, 'FD');
  doc.setFont("helvetica", "bold");
  doc.text("Catatan Pesanan:", 16, 48.5);
  doc.setFont("helvetica", "normal");
  const orderNotes = (dn as any).order_notes || "-";
  doc.text(orderNotes.substring(0, 80), 48, 48.5);

  // Main Table Headers
  const startY = 55;
  const rowH = 7;
  // Outlet | Nama Barang | Note | Qty | Satuan | Harga satuan | Total Biaya | Keterangan
  const colX = [14, 29, 74, 104, 114, 126, 146, 168, 196];

  doc.setFillColor(200, 200, 200);
  doc.rect(colX[0], startY, colX[8] - colX[0], 7, 'FD');

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text("Outlet", colX[0] + 7.5, startY + 4.5, { align: 'center' });
  doc.text("Nama Barang", colX[1] + 22.5, startY + 4.5, { align: 'center' });
  doc.text("Note", colX[2] + 15, startY + 4.5, { align: 'center' });
  doc.text("Qty", colX[3] + 5, startY + 4.5, { align: 'center' });
  doc.text("Satuan", colX[4] + 6, startY + 4.5, { align: 'center' });
  doc.text("Harga satuan", colX[5] + 10, startY + 4.5, { align: 'center' });
  doc.text("Total Biaya", colX[6] + 11, startY + 4.5, { align: 'center' });
  doc.text("Keterangan", colX[7] + 14, startY + 4.5, { align: 'center' });

  for (let i = 1; i < 9; i++) doc.line(colX[i], startY, colX[i], startY + 7);

  // Table Body
  doc.setFont("helvetica", "normal");
  let y = startY + 7;
  let totalBelanja = 0;

  for (const item of dn.items) {
    if (y > 260) {
      doc.addPage();
      y = 15;
    }

    const qty = parseFloat((Number(item.qty_shipped) / (Number(item.conversion_ratio) || 1)).toFixed(3));
    const pricePerUnit = Number(item.price_at_shipment || 0) * (Number(item.conversion_ratio) || 1);
    const subtotal = qty * pricePerUnit;
    totalBelanja += subtotal;

    doc.rect(colX[0], y, colX[8] - colX[0], rowH, 'S'); // Row outline
    for (let i = 1; i < 9; i++) doc.line(colX[i], y, colX[i], y + rowH);

    // 0: Outlet
    doc.text((dn.outlet_name || '').substring(0, 10), colX[0] + 1, y + 4.5);
    // 1: Nama Barang
    doc.text(item.item_name.substring(0, 32), colX[1] + 1, y + 4.5);
    
    // 2: Note
    const outletNote = (item as any).additional_notes || '';
    doc.text(outletNote.substring(0, 18), colX[2] + 1, y + 4.5);

    // 3: Qty
    doc.text(qty.toLocaleString('id-ID'), colX[3] + 5, y + 4.5, { align: 'center' });
    // 4: Satuan
    doc.text(item.purchase_unit.substring(0, 6), colX[4] + 6, y + 4.5, { align: 'center' });

    // 5: Harga satuan
    doc.text(pricePerUnit.toLocaleString('id-ID'), colX[6] - 1, y + 4.5, { align: 'right' });
    // 6: Total Biaya
    doc.text(subtotal.toLocaleString('id-ID'), colX[7] - 1, y + 4.5, { align: 'right' });
    
    // 7: Keterangan
    const adminKet = item.keterangan || '';
    doc.text(adminKet.substring(0, 18), colX[7] + 1, y + 4.5);

    y += rowH;
  }

  // Footer Row (TOTAL BELANJA)
  const footerRowH = 7;
  doc.setFillColor(200, 200, 200);
  doc.rect(colX[0], y, colX[8] - colX[0], footerRowH, 'FD');
  doc.setFont("helvetica", "bold");
  doc.text("TOTAL BELANJA", colX[0] + 2, y + 4.5);
  doc.line(colX[6], y, colX[6], y + footerRowH);
  doc.line(colX[7], y, colX[7], y + footerRowH);
  doc.text(totalBelanja.toLocaleString('id-ID'), colX[7] - 1, y + 4.5, { align: 'right' });

  // Section for QR Code (Single Tracking Code per Delivery Order)
  const requireBarcode = await isBarcodeScanRequired();

  if (requireBarcode) {
    y += 15;
    if (y > 250) {
      doc.addPage();
      y = 20;
    }

    const qrSize = 35; // 35x35 mm (Make it slightly larger for easy scanning)
    const qrX = (210 - qrSize) / 2; // Centered
    
    try {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `${req.headers.get('x-forwarded-proto') || 'http'}://${req.headers.get('host') || 'localhost:3000'}`;
      const qrUrl = `${baseUrl}/receive?kode=${encodeURIComponent(dn.delivery_note_number)}`;

      const barcodeBuffer = await bwipjs.toBuffer({
        bcid: 'qrcode',
        text: qrUrl,
        scale: 3,
        height: 10,
        includetext: false,
      });
      const barcodeBase64 = `data:image/png;base64,${barcodeBuffer.toString('base64')}`;
      doc.addImage(barcodeBase64, 'PNG', qrX, y, qrSize, qrSize);
      
      // Intentionally omitting the text label below the QR for security
    } catch (err) {
      doc.text("Error generating QR", 105, y + 15, { align: 'center' });
    }

    y += qrSize + 15;
  } else {
    y += 20;
  }

  // Signatures
  if (y > 260) {
    doc.addPage();
    y = 20;
  }

  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text("Penerima", 40, y);
  doc.text("PIC Pengirim", 145, y);

  y += 25;
  doc.text("(                                        )", 25, y);
  doc.text("(                                        )", 130, y);

  const pdfBuffer = Buffer.from(doc.output('arraybuffer'));

  return new NextResponse(pdfBuffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="Surat_Jalan_${dn.delivery_note_number}.pdf"`,
    },
  });
}
