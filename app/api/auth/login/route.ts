import { NextRequest, NextResponse } from 'next/server';
import { getUserByEmail, validatePassword, getDemoUsers } from '@/lib/queries/auth';
import { signToken, COOKIE_NAME, getSecondsToNextMidnight } from '@/lib/auth';

export async function GET() {
  try {
    const users = await getDemoUsers();
    return NextResponse.json({ success: true, data: users });
  } catch (err) {
    console.error('Failed to fetch demo users:', err);
    return NextResponse.json({ success: false, data: [] }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ success: false, message: 'Email dan password wajib diisi', data: null }, { status: 400 });
    }

    const user = await getUserByEmail(email.toLowerCase().trim());
    if (!user) {
      return NextResponse.json({ success: false, message: 'Email atau password salah', data: null }, { status: 401 });
    }

    if (!user.password_hash) {
      return NextResponse.json({ success: false, message: 'Akun ini hanya dapat masuk menggunakan Login dengan Google', data: null }, { status: 401 });
    }

    const valid = await validatePassword(password, user.password_hash);
    if (!valid) {
      return NextResponse.json({ success: false, message: 'Email atau password salah', data: null }, { status: 401 });
    }

    const token = signToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      outletId: user.outlet_id ?? null,
      name: user.name,
    });

    const secondsToMidnight = getSecondsToNextMidnight();

    const response = NextResponse.json({
      success: true,
      message: 'Login berhasil',
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        outlet_id: user.outlet_id,
        outlet_name: user.outlet_name,
      },
    });

    response.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: secondsToMidnight,
      path: '/',
    });

    return response;
  } catch (err) {
    console.error('Login error:', err);
    return NextResponse.json({ success: false, message: 'Server error', data: null }, { status: 500 });
  }
}
