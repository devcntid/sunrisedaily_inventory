import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getUserById } from '@/lib/queries/auth';

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, message: 'Unauthorized', data: null }, { status: 401 });
  }

  const user = await getUserById(session.userId);
  if (!user) {
    return NextResponse.json({ success: false, message: 'User not found', data: null }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    message: 'OK',
    data: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      outlet_id: user.outlet_id,
      outlet_name: user.outlet_name,
    },
  });
}
