import { put } from '@vercel/blob';
import fs from 'fs/promises';
import path from 'path';

/**
 * Uploads a file.
 * Prioritizes Vercel Blob when BLOB_READ_WRITE_TOKEN is configured.
 * Automatically falls back to saving in public/uploads/<folder>/ for local development.
 */
export async function uploadFile(file: File, folder: string = 'proofs'): Promise<string> {
  const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_') || 'file.jpg';
  const filename = `${Date.now()}-${safeName}`;
  const pathname = `${folder}/${filename}`;

  // If BLOB_READ_WRITE_TOKEN is configured, use Vercel Blob
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      const blob = await put(pathname, file, { access: 'public', addRandomSuffix: true });
      return blob.url;
    } catch (err) {
      console.warn('Vercel Blob upload failed, falling back to local storage:', err);
    }
  }

  // Fallback for local development or when Vercel Blob token is missing
  try {
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const uploadsDir = path.join(process.cwd(), 'public', 'uploads', folder);
    await fs.mkdir(uploadsDir, { recursive: true });

    const filePath = path.join(uploadsDir, filename);
    await fs.writeFile(filePath, buffer);

    return `/uploads/${folder}/${filename}`;
  } catch (localErr) {
    console.error('Local upload fallback failed:', localErr);
    throw new Error('Gagal mengunggah file.');
  }
}
