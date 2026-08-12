import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getHppCategories, createHppCategory, updateHppCategory, deleteHppCategory } from '@/lib/queries/hpp';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  
  try {
    const categories = await getHppCategories();
    return NextResponse.json({ success: true, data: categories });
  } catch (err: unknown) {
    return NextResponse.json({ success: false, message: (err instanceof Error ? err.message : 'Unknown error') }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN_PUSAT') {
    return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
  }
  const body = await req.json();
  try {
    const cat = await createHppCategory(body.name);
    return NextResponse.json({ success: true, message: 'Kategori berhasil ditambahkan', data: cat }, { status: 201 });
  } catch (err: unknown) {
    const pgError = err as { code?: string };
    if (pgError.code === '23505') {
      return NextResponse.json({ success: false, message: 'Nama kategori ini sudah digunakan' }, { status: 400 });
    }
    return NextResponse.json({ success: false, message: (err instanceof Error ? err.message : 'Unknown error') }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN_PUSAT') {
    return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
  }
  const body = await req.json();
  try {
    const cat = await updateHppCategory(Number(body.id), body.name);
    return NextResponse.json({ success: true, message: 'Kategori berhasil diperbarui', data: cat });
  } catch (err: unknown) {
    const pgError = err as { code?: string };
    if (pgError.code === '23505') {
      return NextResponse.json({ success: false, message: 'Nama kategori ini sudah digunakan' }, { status: 400 });
    }
    return NextResponse.json({ success: false, message: (err instanceof Error ? err.message : 'Unknown error') }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN_PUSAT') {
    return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
  }
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ success: false, message: 'ID diperlukan' }, { status: 400 });
  
  try {
    await deleteHppCategory(Number(id));
    return NextResponse.json({ success: true, message: 'Kategori berhasil dihapus' });
  } catch (err: unknown) {
    const pgError = err as { code?: string };
    if (pgError.code === '23503') {
      return NextResponse.json({ success: false, message: 'Kategori tidak dapat dihapus karena masih digunakan pada menu/produk.' }, { status: 400 });
    }
    return NextResponse.json({ success: false, message: (err instanceof Error ? err.message : 'Unknown error') }, { status: 500 });
  }
}
