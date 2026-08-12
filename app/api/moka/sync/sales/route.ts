import { NextRequest, NextResponse } from "next/server";
import { getSession } from '@/lib/auth';
import { syncSales } from "@/lib/queries/moka_sales";
import { getAllActiveMokaTokens } from "@/lib/queries/moka";
import { getActiveStoreOutlets } from "@/lib/queries/master";
import { syncTransactions } from "@/lib/queries/moka_transactions";
import { deductOutletStockFromSales } from "@/lib/queries/outlet-inventory";

export async function POST(req: NextRequest) {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN_PUSAT') return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
    try {
        const body = await req.json();
        const { start_date, end_date, outlet_id } = body;

        if (!start_date || !end_date) {
            return NextResponse.json({ message: "Tanggal Mulai dan Tanggal Akhir harus diisi (YYYY-MM-DD)" }, { status: 400 });
        }

        let tokens = await getAllActiveMokaTokens();
        if (!tokens || tokens.length === 0) {
            return NextResponse.json({ message: "Tidak ada akun Moka yang terhubung." }, { status: 400 });
        }

        if (outlet_id) {
            const { getOutletMokaBusinessId } = await import('@/lib/queries/master');
            const businessId = await getOutletMokaBusinessId(outlet_id);
            if (businessId) {
                tokens = tokens.filter((t: any) => t.business_id === businessId);
            }
        }

        // ── LANGKAH 1: Sync moka_item_sales (untuk tampilan cups/revenue di dashboard) ──

        const salesResults = await Promise.allSettled(
            tokens.map((token: any) => syncSales(token, start_date, end_date, outlet_id))
        );

        let salesSynced = 0;
        salesResults.forEach(r => {
            if (r.status === 'fulfilled' && r.value.success) {
                salesSynced++;
            }
        });

        // ── LANGKAH 2: Sync moka_transactions (data transaksi individual, idempotent via ON CONFLICT) ──
        // Ini diperlukan agar deductOutletStockFromSales punya data yang bisa diproses.
        // ON CONFLICT (id) DO UPDATE → aman dipanggil berkali-kali oleh Pusat maupun Outlet.
        const startEpoch = Math.floor(new Date(`${start_date}T00:00:00+07:00`).getTime() / 1000);
        const endEpoch = Math.floor(new Date(`${end_date}T23:59:59+07:00`).getTime() / 1000);

        const trxResults = await Promise.allSettled(
            tokens.map((token: any) =>
                syncTransactions(token, startEpoch, endEpoch, outlet_id?.toString())
            )
        );

        let trxSynced = 0;
        trxResults.forEach(r => {
            if (r.status === 'fulfilled' && (r.value as any).success) trxSynced++;
        });

        // ── LANGKAH 3: Deduct stok outlet dari transaksi yang belum diproses ──
        // deductOutletStockFromSales hanya memproses transaksi WHERE is_stock_deducted = FALSE,
        // lalu menandai is_stock_deducted = TRUE. Ini menjamin idempotency penuh:
        // → Jika Outlet sudah klik "Sync Penjualan" lebih dulu, semua transaksi sudah TRUE → Pusat tidak double.
        // → Jika Pusat klik lebih dulu, transaksi di-set TRUE → Outlet sync tidak double.
        // → Jika keduanya klik bersamaan, DB transaction lock memastikan hanya satu yang proses.
        if (salesSynced > 0 || trxSynced > 0) {
            const activeOutlets = outlet_id
                ? [{ id: outlet_id }]
                : await getActiveStoreOutlets();

            // Jalankan deduct per tanggal dalam rentang start_date..end_date
            const dates: string[] = [];
            const cur = new Date(start_date);
            const endD = new Date(end_date);
            while (cur <= endD) {
                dates.push(cur.toISOString().slice(0, 10));
                cur.setDate(cur.getDate() + 1);
            }

            const deductResults = await Promise.allSettled(
                activeOutlets.flatMap((o: any) =>
                    dates.map(d => deductOutletStockFromSales(Number(o.id), d))
                )
            );

            const deductedCount = deductResults.filter(r => r.status === 'fulfilled').length;

            const unmatchedMenusRaw = deductResults
                .filter(r => r.status === 'fulfilled')
                .flatMap(r => (r as PromiseFulfilledResult<any>).value.unmatchedMenus || []);
            
            const unmatchedMenus = Array.from(new Set(unmatchedMenusRaw));

            return NextResponse.json({
                success: true,
                message: `Sinkronisasi selesai!`,
                sales_synced: salesSynced,
                trx_synced: trxSynced,
                deduct_count: deductedCount,
                unmatched_menus: unmatchedMenus
            });
        } else {
            return NextResponse.json({ message: 'Gagal sinkronisasi dari semua akun yang terhubung.' }, { status: 500 });
        }

    } catch (error: unknown) {
        console.error("Sync sales API error:", error);
        return NextResponse.json(
            { message: (error instanceof Error ? error.message : 'Unknown error') || "Internal server error" },
            { status: 500 }
        );
    }
}
