import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getPurchaseOrderById } from '@/lib/queries/purchase-orders';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import fs from 'fs';
import path from 'path';

const fmtCurrency = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });

  const { id } = await params;
  const po = await getPurchaseOrderById(Number(id));
  if (!po) return new NextResponse('Not found', { status: 404 });

  const doc = new jsPDF();
  
  try {
    const fontPath = path.join(process.cwd(), 'public/fonts/AlbertSans-Regular.ttf');
    const fontPathBold = path.join(process.cwd(), 'public/fonts/AlbertSans-Bold.ttf');
    doc.addFileToVFS('AlbertSans-Regular.ttf', fs.readFileSync(fontPath).toString('base64'));
    doc.addFont('AlbertSans-Regular.ttf', 'Albert Sans', 'normal');
    doc.addFileToVFS('AlbertSans-Bold.ttf', fs.readFileSync(fontPathBold).toString('base64'));
    doc.addFont('AlbertSans-Bold.ttf', 'Albert Sans', 'bold');
    doc.setFont('Albert Sans', 'normal');
  } catch (e) {
    console.error('Failed to load custom font', e);
  }

  const poNum = po.po_number || 'DRAFT';

  // Header
  doc.setFontSize(20);
  doc.text('PESANAN PEMBELIAN', 14, 22);
  doc.setFontSize(10);
  doc.text(`No. PO: ${poNum}`, 14, 30);
  doc.text(`Tanggal Order: ${new Date(po.order_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}`, 14, 35);
  doc.text(`Vendor: ${po.vendor_name || ''}`, 14, 40);
  doc.text(`Kirim Ke: ${po.destination_outlet_name || ''}`, 14, 45);

  let computedSubtotal = 0;
  let computedTax = 0;

  // Table
  const tableData = (po.items || []).map((l: any, i: number) => {
    if (l.line_type === 'CATATAN') {
      return [
        i + 1,
        { content: l.description, styles: { fontStyle: 'italic', textColor: '#64748b' } },
        '',
        '',
        '',
        ''
      ];
    }

    const q = Number(l.qty) || 0;
    const up = Number(l.unit_price) || 0;
    const t = Number(l.tax_percent) || 0;
    const d = Number(l.discount_percent) || 0;
    const net = (q * up) * (1 - d / 100);
    computedSubtotal += net;
    computedTax += net * (t / 100);

    return [
      i + 1,
      l.description || l.item_name || '',
      l.qty,
      l.purchase_unit || '-',
      fmtCurrency(up).replace(',00', ''),
      fmtCurrency(net).replace(',00', '')
    ];
  });

  autoTable(doc, {
    startY: 55,
    styles: { font: 'Albert Sans' },
    headStyles: { font: 'Albert Sans', fontStyle: 'bold' },
    head: [['No', 'Deskripsi', 'Jml', 'Satuan', 'Harga Satuan', 'Jumlah']],
    body: tableData as any,
  });

  const computedTotal = computedSubtotal + computedTax;

  // Totals
  const finalY = (doc as any).lastAutoTable.finalY || 55;
  doc.text(`Subtotal: ${fmtCurrency(computedSubtotal).replace(',00', '')}`, 140, finalY + 10);
  doc.text(`Pajak: ${fmtCurrency(computedTax).replace(',00', '')}`, 140, finalY + 16);
  doc.setFont('Albert Sans', 'bold');
  doc.text(`Total: ${fmtCurrency(computedTotal).replace(',00', '')}`, 140, finalY + 24);

  const pdfBuffer = Buffer.from(doc.output('arraybuffer'));

  return new NextResponse(pdfBuffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${new Date(po.order_date).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-')}.pdf"`,
    },
  });
}
