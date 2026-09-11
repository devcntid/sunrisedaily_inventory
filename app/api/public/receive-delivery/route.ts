import { NextRequest, NextResponse } from 'next/server';
import { getDeliveryNoteByCode, processPublicReceive } from '@/lib/queries/delivery-notes';
import { isBarcodeScanRequired } from '@/lib/queries/settings';
import { uploadFile } from '@/lib/upload';

// GET: Fetch delivery note info (public, no auth)
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('kode');
  if (!code) {
    return NextResponse.json({ success: false, message: 'Parameter kode tidak boleh kosong.' }, { status: 400 });
  }

  try {
    const dn = await getDeliveryNoteByCode(code);
    if (!dn) {
      return NextResponse.json({ success: false, message: 'Surat Jalan tidak ditemukan.' }, { status: 404 });
    }
    const requireBarcode = await isBarcodeScanRequired();
    return NextResponse.json({ success: true, dn, requireBarcode });
  } catch (error: unknown) {
    return NextResponse.json({ success: false, message: (error instanceof Error ? error.message : 'Unknown error') }, { status: 500 });
  }
}

// POST: Submit delivery receipt
export async function POST(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('kode');
  if (!code) {
    return NextResponse.json({ success: false, message: 'Parameter kode tidak boleh kosong.' }, { status: 400 });
  }

  try {
    const formData = await req.formData();
    const photo = formData.get('photo') as File | null;
    const recipient_name = formData.get('recipient_name') as string;
    const itemsJson = formData.get('items') as string;

    const requireBarcode = await isBarcodeScanRequired();
    if (requireBarcode && !photo) {
      return NextResponse.json({ success: false, message: 'Foto bukti penerimaan wajib diunggah.' }, { status: 400 });
    }
    if (!recipient_name || recipient_name.trim() === '') {
      return NextResponse.json({ success: false, message: 'Nama penerima wajib diisi.' }, { status: 400 });
    }
    if (!itemsJson) {
      return NextResponse.json({ success: false, message: 'Data barang tidak valid.' }, { status: 400 });
    }

    let items: { 
      delivery_note_item_id: number;
      order_item_id?: number; 
      qty_received: number; 
      receive_notes: string;
      has_issue?: boolean;
      qty_issue?: number;
      issue_reason?: string;
      issue_photo_url?: string;
    }[] = [];
    try {
      items = JSON.parse(itemsJson);
    } catch {
      return NextResponse.json({ success: false, message: 'Format data barang salah.' }, { status: 400 });
    }

    // Check delivery note
    const dn = await getDeliveryNoteByCode(code);
    if (!dn) {
      return NextResponse.json({ success: false, message: 'Surat Jalan tidak ditemukan.' }, { status: 404 });
    }
    if (dn.status !== 'DIKIRIM') {
      return NextResponse.json({ success: false, message: `Surat Jalan ini tidak bisa diterima karena statusnya "${dn.status}". Hanya Surat Jalan berstatus DIKIRIM yang bisa dikonfirmasi.` }, { status: 400 });
    }

    // Upload main DO photo
    let proofUrl: string | undefined = undefined;
    if (photo) {
      proofUrl = await uploadFile(photo, 'proofs');
    }

    // Upload issue photos
    for (let i = 0; i < items.length; i++) {
      if (items[i].has_issue) {
        const issuePhoto = formData.get(`issue_photo_${i}`) as File | null;
        if (issuePhoto) {
          items[i].issue_photo_url = await uploadFile(issuePhoto, 'issues');
        }
      }
    }

    // Update database
    await processPublicReceive({
      delivery_note_id: dn.id,
      recipient_name: recipient_name.trim(),
      proof_image_url: proofUrl,
      items,
    });

    return NextResponse.json({ success: true, message: 'Penerimaan berhasil disimpan.' });
  } catch (error: unknown) {
    console.error('Error receiving delivery:', error);
    return NextResponse.json({ success: false, message: 'Gagal memproses: ' + (error instanceof Error ? error.message : 'Unknown error') }, { status: 500 });
  }
}
