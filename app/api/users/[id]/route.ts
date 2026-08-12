import { NextRequest, NextResponse } from 'next/server';
import { updateUser } from '@/lib/queries/auth';
import { getSession } from '@/lib/auth';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN_PUSAT') {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    
    const updated = await updateUser(parseInt(id), body);
    
    if (!updated) {
      return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 });
    }
    
    return NextResponse.json({ success: true, data: updated, message: 'User successfully updated' });
  } catch (err: unknown) {
    const pgError = err as { code?: string };
    if (pgError.code === '23505') {
      return NextResponse.json({ success: false, message: 'Email is already in use' }, { status: 400 });
    }
    return NextResponse.json({ success: false, message: 'Failed to update user' }, { status: 500 });
  }
}
