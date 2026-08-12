import { NextRequest, NextResponse } from 'next/server';
import { saveMokaToken, getMokaOauthState, deleteMokaOauthState } from '@/lib/queries/moka';

// Force Turbopack recompile for Multi-Account Private App support
export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');

    if (!code) {
        return NextResponse.redirect(new URL('/settings/moka?error=no_code', request.url));
    }

    if (!state) {
        console.error('Missing state parameter in callback');
        return NextResponse.redirect(new URL('/settings/moka?error=missing_credentials', request.url));
    }

    let clientId = '';
    let clientSecret = '';

    try {
        // Fetch credentials from DB based on the state token
        const stateRes = await getMokaOauthState(state);
        if (!stateRes) {
            console.error('State token not found or expired:', state);
            return NextResponse.redirect(new URL('/settings/moka?error=missing_credentials', request.url));
        }

        clientId = stateRes.client_id;
        clientSecret = stateRes.client_secret;

        // Delete state immediately to prevent reuse (one-time use only)
        await deleteMokaOauthState(state);
    } catch (dbError) {
        console.error('Error fetching state from DB:', dbError);

        return NextResponse.redirect(new URL('/settings/moka?error=db_error', request.url));
    }

    const redirectUri = process.env.MOKA_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
        console.error('Missing credentials or env:', { clientId: !!clientId, clientSecret: !!clientSecret, redirectUri: !!redirectUri });
        return NextResponse.redirect(new URL('/settings/moka?error=missing_credentials', request.url));
    }

    try {
        const response = await fetch('https://api.mokapos.com/oauth/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                client_id: clientId,
                client_secret: clientSecret,
                code: code,
                grant_type: 'authorization_code',
                redirect_uri: redirectUri
            })
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('Moka token error:', data);
            return NextResponse.redirect(new URL('/settings/moka?error=moka_api_error', request.url));
        }

        // --- Ambil informasi Business ID & Nama dari Moka API ---
        let businessId = 0;
        let accountName = '';
        let accountEmail = '';

        try {
            const bizRes = await fetch('https://api.mokapos.com/v1/businesses', {
                headers: {
                    'Authorization': `Bearer ${data.access_token}`,
                    'Accept': 'application/json'
                }
            });
            const bizData = await bizRes.json();
            console.log('Moka /v1/businesses response:', JSON.stringify(bizData).substring(0, 500));

            if (bizData && bizData.data && bizData.data.business) {
                // For /v1/businesses, data is an object containing 'business'
                const primaryBiz = bizData.data.business;
                businessId = primaryBiz.id;
                accountName = primaryBiz.name;
                accountEmail = primaryBiz.email || '';
            } else if (bizData && Array.isArray(bizData.data) && bizData.data.length > 0) {
                // Fallback just in case Moka returns an array
                const primaryBiz = bizData.data[0];
                businessId = primaryBiz.id;
                accountName = primaryBiz.name;
                accountEmail = primaryBiz.email || '';
            } else {
                // Fallback for Private Apps: try to get business_id from outlets API
                console.log('No business data found in /v1/businesses, trying /v1/outlets...');
                const outRes = await fetch('https://api.mokapos.com/v1/outlets', {
                    headers: {
                        'Authorization': `Bearer ${data.access_token}`,
                        'Accept': 'application/json'
                    }
                });
                const outData = await outRes.json();
                console.log('Moka /v1/outlets response:', JSON.stringify(outData).substring(0, 500));
                
                if (outData && outData.data && outData.data.outlets && outData.data.outlets.length > 0) {
                    const primaryOut = outData.data.outlets[0];
                    businessId = primaryOut.business_id;
                    accountName = primaryOut.name ? `Account via ${primaryOut.name}` : 'Unknown Account';
                } else if (outData && Array.isArray(outData.data) && outData.data.length > 0) {
                     const primaryOut = outData.data[0];
                     businessId = primaryOut.business_id;
                     accountName = primaryOut.name ? `Account via ${primaryOut.name}` : 'Unknown Account';
                }
            }
        } catch (bizError) {
            console.error('Failed to fetch business info from Moka:', bizError);
        }

        if (!businessId) {
            console.error('Business ID not found in Moka response.');
            return NextResponse.redirect(new URL('/settings/moka?error=no_business_id', request.url));
        }

        const success = await saveMokaToken(
            data.access_token,
            data.refresh_token,
            data.expires_in,
            data.scope,
            data.created_at,
            businessId,
            accountName,
            accountEmail,
            clientId,      // Store per-account credentials
            clientSecret
        );

        if (!success) {
            return NextResponse.redirect(new URL('/settings/moka?error=db_error', request.url));
        }

        return NextResponse.redirect(new URL('/settings/moka?success=true', request.url));

    } catch (error) {
        console.error('Callback error:', error);
        return NextResponse.redirect(new URL('/settings/moka?error=internal_error', request.url));
    }
}
