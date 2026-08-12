import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';

const JWT_SECRET = process.env.JWT_SECRET!;
const COOKIE_NAME = 'sd_token';

export interface JwtPayload {
  userId: number;
  email: string;
  role: 'ADMIN_PUSAT' | 'ADMIN_OUTLET';
  outletId: number | null;
  name: string;
}

export function getSecondsToNextMidnight(): number {
  const now = new Date();
  const offset = 7 * 60 * 60 * 1000; // WIB (UTC+7)
  const nowWIB = new Date(now.getTime() + offset);
  
  const nextMidnightWIB = new Date(nowWIB);
  nextMidnightWIB.setUTCHours(24, 0, 0, 0);
  
  const nextMidnightAbsolute = new Date(nextMidnightWIB.getTime() - offset);
  return Math.max(1, Math.floor((nextMidnightAbsolute.getTime() - now.getTime()) / 1000));
}

export function signToken(payload: JwtPayload, expiresInSeconds?: number): string {
  const expiresIn = expiresInSeconds ?? getSecondsToNextMidnight();
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<JwtPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}

export { COOKIE_NAME };
