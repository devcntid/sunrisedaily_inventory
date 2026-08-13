import { query } from "@/lib/db";

export async function saveMokaOauthState(state: string, clientId: string, clientSecret: string) {
    await query(`
        INSERT INTO moka_oauth_states (state, client_id, client_secret)
        VALUES ($1, $2, $3)
    `, [state, clientId, clientSecret]);
}

export async function getMokaOauthState(state: string) {
    const res = await query(`SELECT client_id, client_secret FROM moka_oauth_states WHERE state = $1`, [state]);
    return res.rows[0] || null;
}

export async function deleteMokaOauthState(state: string) {
    await query(`DELETE FROM moka_oauth_states WHERE state = $1`, [state]);
}

// Mempertahankan kompatibilitas untuk kode lama (mengambil 1 token aktif sembarang)
export async function getMokaToken() {
    try {
        const result = await query('SELECT * FROM moka_tokens WHERE is_active = true ORDER BY created_at DESC LIMIT 1');
        return result.rows[0] || null;
    } catch (error) {
        console.error("Error fetching Moka token:", error);
        return null;
    }
}

// BARU: Mengambil seluruh token Moka yang aktif (Multi-Account)
export async function getAllActiveMokaTokens() {
    try {
        const result = await query('SELECT * FROM moka_tokens WHERE is_active = true ORDER BY created_at ASC');
        return result.rows || [];
    } catch (error) {
        console.error("Error fetching all active Moka tokens:", error);
        return [];
    }
}

// BARU: Mengambil token Moka berdasarkan ID Bisnis spesifik
export async function getMokaTokenByBusinessId(businessId: number) {
    try {
        const result = await query('SELECT * FROM moka_tokens WHERE business_id = $1 LIMIT 1', [businessId]);
        return result.rows[0] || null;
    } catch (error) {
        console.error(`Error fetching Moka token for business ${businessId}:`, error);
        return null;
    }
}

// DIPERBARUI: Menyimpan token dengan UPSERT berdasarkan business_id
// Setiap Private App menyimpan client_id & client_secret-nya sendiri
export async function saveMokaToken(
    accessToken: string,
    refreshToken: string,
    expiresIn: number,
    scope: string,
    mokaCreatedAt: number,
    businessId: number,
    accountName: string,
    accountEmail: string = '',
    clientId: string = '',
    clientSecret: string = ''
) {
    if (!businessId) {
        console.error("FATAL ERROR: saveMokaToken called with null/undefined businessId!");
        return false;
    }
    try {
        await query(`
            INSERT INTO moka_tokens (
                access_token, refresh_token, expires_in, scope, moka_created_at, 
                business_id, account_name, account_email, is_active,
                client_id, client_secret
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, $9, $10)
            ON CONFLICT (business_id) DO UPDATE SET
                access_token = EXCLUDED.access_token,
                refresh_token = EXCLUDED.refresh_token,
                expires_in = EXCLUDED.expires_in,
                scope = EXCLUDED.scope,
                moka_created_at = EXCLUDED.moka_created_at,
                account_name = EXCLUDED.account_name,
                account_email = EXCLUDED.account_email,
                client_id = EXCLUDED.client_id,
                client_secret = EXCLUDED.client_secret,
                is_active = true,
                updated_at = CURRENT_TIMESTAMP
        `, [accessToken, refreshToken, expiresIn, scope, mokaCreatedAt, businessId, accountName, accountEmail, clientId, clientSecret]);
        return true;
    } catch (error) {
        console.error("Error saving Moka token:", error);
        return false;
    }
}

// Cek apakah client_id sudah pernah terdaftar (aktif maupun non-aktif)
// Jika ADA & AKTIF → tidak perlu apa-apa (sudah terhubung)
// Jika ADA & TIDAK AKTIF → kembalikan found:false agar sistem paksa OAuth ulang (token lama expired)
export async function reactivateMokaAccountByClientId(clientId: string, clientSecret: string) {
    try {
        const res = await query(
            `SELECT id, business_id, account_name, is_active FROM moka_tokens WHERE client_id = $1 AND client_secret = $2 LIMIT 1`,
            [clientId, clientSecret]
        );
        if (res.rowCount === 0) return { found: false };
        const row = res.rows[0];
        // Jika sudah aktif → berarti memang sudah terhubung & token masih valid
        if (row.is_active) {
            return { found: true, reactivated: false, business_id: row.business_id, account_name: row.account_name };
        }
        // Jika tidak aktif → token expired/dicabut Moka. Harus OAuth ulang untuk dapat token segar.
        // Kembalikan found:false agar pemanggil memulai flow OAuth normal.
        return { found: false };
    } catch (error) {
        console.error('Error checking Moka account by client_id:', error);
        return { found: false };
    }
}

// Menonaktifkan satu akun Moka tanpa menghapus data
export async function deactivateMokaAccount(businessId: number) {
    try {
        await query('UPDATE moka_tokens SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE business_id = $1', [businessId]);
        return true;
    } catch (error) {
        console.error(`Error deactivating Moka account ${businessId}:`, error);
        return false;
    }
}
