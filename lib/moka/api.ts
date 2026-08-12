import { getMokaToken, saveMokaToken } from '@/lib/queries/moka';

export async function refreshMokaToken(tokenObj: { access_token: string; refresh_token: string; expires_at?: Date | string; [key: string]: unknown }) {
    if (!tokenObj || !tokenObj.business_id) {
        throw new Error("Cannot refresh token without business_id");
    }

    // Use per-account credentials stored in DB for Private App support
    // Falls back to env vars only if not stored (backward compatibility)
    const clientId = tokenObj.client_id || process.env.MOKA_CLIENT_ID;
    const clientSecret = tokenObj.client_secret || process.env.MOKA_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        throw new Error(`Missing client credentials for business ${tokenObj.business_id}`);
    }

    const refreshRes = await fetch('https://api.mokapos.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: tokenObj.refresh_token,
            grant_type: 'refresh_token'
        })
    });

    if (!refreshRes.ok) {
        console.error(`Refresh token failed for business ${tokenObj.business_id}:`, await refreshRes.text());
        throw new Error("auth_expired");
    }

    const data = await refreshRes.json();
    await saveMokaToken(
        data.access_token,
        data.refresh_token,
        data.expires_in,
        data.scope,
        data.created_at,
        Number(tokenObj.business_id),
        String(tokenObj.account_name || ''),
        String(tokenObj.account_email || ''),
        String(clientId),
        String(clientSecret)
    );
    return data;
}

// BARU: Fungsi fetch menggunakan token spesifik (Untuk Sync Engine Multi-Akun)
export async function fetchMokaAPIWithToken(token: { access_token: string; refresh_token: string; expires_at?: Date | string; [key: string]: unknown }, endpoint: string, method: string = 'GET', body?: unknown) {
    if (!token) throw new Error("Token is required for fetchMokaAPIWithToken");

    // Proactive token refresh (5 minutes buffer)
    if (token.moka_created_at && token.expires_in) {
        const nowUnix = Math.floor(Date.now() / 1000);
        const expiresAt = Number(token.moka_created_at) + Number(token.expires_in);
        if (nowUnix > expiresAt - 300) {
            console.log(`Moka Access Token proactively expired for business ${token.business_id}. Refreshing before request...`);
            const newData = await refreshMokaToken(token);
            token.access_token = newData.access_token;
            token.refresh_token = newData.refresh_token;
            console.log(`Token successfully refreshed proactively for business ${token.business_id}.`);
        }
    }

    const baseUrl = 'https://api.mokapos.com';
    let url = endpoint.startsWith('http') ? endpoint : `${baseUrl}${endpoint}`;

    try {
        const urlObj = new URL(url);
        if (urlObj.searchParams.has('access_token')) {
            urlObj.searchParams.delete('access_token');
            url = urlObj.toString();
        }
    } catch (e) {
        console.warn("Invalid URL format:", url);
    }

    const headers: Record<string, string> = {
        'Authorization': `Bearer ${token.access_token}`,
        'Accept': 'application/json'
    };

    if (body) {
        headers['Content-Type'] = 'application/json';
    }

    let response: Response | null = null;
    const maxRetries = 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        response = await fetch(url, {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined
        });

        // If Unauthorized, try to refresh the token as a fallback
        if (response.status === 401) {
            console.log(`Moka Access Token expired (401) for business ${token.business_id}. Attempting fallback refresh...`);
            const newData = await refreshMokaToken(token);
            
            // Retry original request with new token
            headers['Authorization'] = `Bearer ${newData.access_token}`;
            response = await fetch(url, {
                method,
                headers,
                body: body ? JSON.stringify(body) : undefined
            });
        }

        if (response.ok) {
            return response.json();
        }

        // If 5xx error (e.g. 503 upstream connect error), retry up to maxRetries
        if (response.status >= 500 && attempt < maxRetries) {
            console.warn(`Moka API Error (${response.status}) on attempt ${attempt} for business ${token.business_id}. Retrying in 2 seconds...`);
            await new Promise(r => setTimeout(r, 2000));
            continue;
        }

        // If we reach here, it means it's a non-retriable error or we exhausted retries
        break;
    }

    if (response) {
        const errorText = await response.text();
        console.error(`Moka API Error (${response.status}) for business ${token.business_id}:`, errorText);
        throw new Error(`Moka API Error: ${response.status}`);
    }
    
    throw new Error("Failed to fetch Moka API (No response)");
}

// LAMA: Backward compatibility (menggunakan sembarang 1 token)
export async function fetchMokaAPI(endpoint: string, method: string = 'GET', body?: unknown) {
    let token = await getMokaToken();
    if (!token) throw new Error("Not connected to Moka");
    
    return fetchMokaAPIWithToken(token as any, endpoint, method, body);
}
