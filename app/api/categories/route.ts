import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getCategories, createCategory, updateCategory, deleteCategory } from '@/lib/queries/master';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, message: 'Unauthorized', data: null }, { status: 401 });
  const categories = await getCategories();
  return NextResponse.json({ success: true, message: 'OK', data: categories });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN_PUSAT') return NextResponse.json({ success: false, message: 'Forbidden', data: null }, { status: 403 });
  const body = await req.json();
  const cat = await createCategory({ name: body.name });
  return NextResponse.json({ success: true, message: 'Kategori berhasil ditambahkan', data: cat }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN_PUSAT') return NextResponse.json({ success: false, message: 'Forbidden', data: null }, { status: 403 });
  const body = await req.json();
  const cat = await updateCategory(Number(body.id), { name: body.name });
  return NextResponse.json({ success: true, message: 'Kategori berhasil diperbarui', data: cat });
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN_PUSAT') return NextResponse.json({ success: false, message: 'Forbidden', data: null }, { status: 403 });
  const { searchParams } = new URL(req.url);
  try {
    await deleteCategory(Number(searchParams.get('id')));
    return NextResponse.json({ success: true, message: 'Kategori berhasil dihapus', data: null });
  } catch (error: any) {
    if (error.code === '23503' || (error.message && error.message.includes('foreign key constraint'))) {
      return NextResponse.json({ success: false, message: 'Kategori tidak dapat dihapus kategori.', data: null }, { status: 400 });
    }
    return NextResponse.json({ success: false, message: 'Terjadi kesalahan saat menghapus kategori.', data: null }, { status: 500 });
  }
}
