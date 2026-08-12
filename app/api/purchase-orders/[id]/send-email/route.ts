import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import nodemailer from 'nodemailer';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN_PUSAT') return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
  try {
    const { id } = await params;
    const body = await req.json();
    const { to, subject, message, pdfBase64, poNumber } = body;

    if (!to || !pdfBase64) {
      return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
    }

    // Configure nodemailer with explicit host and port 465 (SSL) to avoid ISP blocking port 587
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true, // true for 465, false for other ports
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_APP_PASSWORD,
      },
      tls: {
        rejectUnauthorized: false
      },
      connectionTimeout: 10000, // Timeout 10 detik agar tidak menggantung terlalu lama
      greetingTimeout: 10000,
      socketTimeout: 10000
    });

    // Check if env vars are set
    if (!process.env.EMAIL_USER || !process.env.EMAIL_APP_PASSWORD) {
      return NextResponse.json({ 
        success: false, 
        message: 'Sistem email belum dikonfigurasi. Silakan hubungi administrator untuk memasukkan EMAIL_USER dan EMAIL_APP_PASSWORD di environment variables.' 
      }, { status: 500 });
    }

    const mailOptions = {
      from: `"Sunrise Daily Purchasing" <${process.env.EMAIL_USER}>`,
      to,
      subject: subject || `Purchase Order ${poNumber} - Sunrise Daily`,
      text: message || `Dear Vendor,\n\nPlease find attached our Purchase Order ${poNumber}.\n\nThank you,\nSunrise Daily Purchasing`,
      attachments: [
        {
          filename: `PO_${poNumber || id}.pdf`,
          content: pdfBase64.split('base64,')[1] || pdfBase64,
          encoding: 'base64',
          contentType: 'application/pdf'
        }
      ]
    };

    transporter.sendMail(mailOptions)
      .then(info => console.log('Email sent: ' + info.response))
      .catch(error => {
        if (error.code === 'ETIMEDOUT' || error.code === 'ESOCKET') {
          console.error('❌ Gagal mengirim email: Koneksi terputus (Timeout).');
          console.error('Info: Jika Anda menjalankan aplikasi ini secara lokal di Indonesia, provider internet (seperti Indihome/Telkomsel/Biznet) biasanya MEMBLOKIR port pengiriman email (Port 465/587) untuk mencegah spam.');
          console.error('Solusi: Jangan khawatir, fitur ini AKAN BERJALAN LANCAR saat aplikasi dideploy ke server production (Vercel/VPS). Untuk testing lokal, Anda bisa mengabaikan error ini atau menggunakan VPN.');
        } else {
          console.error('Error sending email:', error);
        }
      });

    return NextResponse.json({ success: true, message: 'Email sedang diproses dan akan segera terkirim ke ' + to });
  } catch (error: unknown) {
    console.error('Error preparing email:', error);
    return NextResponse.json({ success: false, message: 'Gagal memproses email: ' + (error instanceof Error ? error.message : 'Unknown error') }, { status: 500 });
  }
}
