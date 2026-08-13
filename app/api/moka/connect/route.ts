import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { saveMokaOauthState, reactivateMokaAccountByClientId } from '@/lib/queries/moka';

// POST: Receive client_id & client_secret from UI form, store in DB with state token, return Moka auth URL
export async function POST(request: NextRequest) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN_PUSAT') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const body = await request.json();
    const { client_id, client_secret } = body;

    if (!client_id || !client_secret) {
        return NextResponse.json({ error: 'client_id and client_secret are required' }, { status: 400 });
    }

    // ── Shortcut: Jika client_id+secret sudah ada di DB, aktifkan langsung tanpa OAuth ulang ──
    const existing = await reactivateMokaAccountByClientId(client_id.trim(), client_secret.trim());
    if (existing.found) {
        return NextResponse.json({
            reactivated: true,
            account_name: existing.account_name,
            business_id: existing.business_id,
            message: existing.reactivated
                ? `Akun "${existing.account_name}" berhasil diaktifkan kembali.`
                : `Akun "${existing.account_name}" sudah aktif.`
        });
    }

    const redirectUri = process.env.MOKA_REDIRECT_URI;
    if (!redirectUri) {
        return NextResponse.json({ error: 'MOKA_REDIRECT_URI not configured' }, { status: 500 });
    }

    // Generate a unique state token for OAuth flow
    const state = crypto.randomUUID();

    try {
        // Store credentials in DB mapped to the state token
        await saveMokaOauthState(state, client_id, client_secret);

    } catch (dbError) {
        console.error('Failed to save Moka state to DB:', dbError);
        return NextResponse.json({ error: 'Database error while preparing auth' }, { status: 500 });
    }

    const scope = encodeURIComponent('profile library report transaction customer');
    const encodedRedirect = encodeURIComponent(redirectUri);
    // Attach state to the auth URL
    const mokaAuthUrl = `https://api.mokapos.com/oauth/authorize?client_id=${client_id}&redirect_uri=${encodedRedirect}&response_type=code&scope=${scope}&state=${state}`;

    return NextResponse.json({ auth_url: mokaAuthUrl });
}

// GET: Legacy redirect support (kept for direct URL access)
export async function GET() {
    return NextResponse.json({ error: 'Use POST with client_id and client_secret' }, { status: 405 });
}
