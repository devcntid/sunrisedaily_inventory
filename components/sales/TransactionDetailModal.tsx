import React, { useEffect, useState } from 'react';
import { X, Loader2 } from 'lucide-react';

interface TransactionDetailModalProps {
  transactionId: string | null;
  onClose: () => void;
}

interface DetailHeader {
  id: string;
  payment_no: string | null;
  payment_type: string | null;
  payment_type_label: string | null;
  total_collected: number;
  subtotal: number;
  discounts: number;
  gratuities: number;
  taxes: number;
  tendered: number;
  change_amount: number;
  transaction_date: string | null;
  transaction_time: string | null;
  collected_by: string | null;
  served_by: string | null;
  outlet_name: string | null;
  is_refunded?: boolean;
  created_at: string;
}

interface DetailItem {
  uuid: string;
  item_name: string;
  item_variant_name: string | null;
  category_name: string | null;
  quantity: number;
  price: number;
  gross_sales: number;
  net_sales: number;
}

export function TransactionDetailModal({ transactionId, onClose }: TransactionDetailModalProps) {
  const [loading, setLoading] = useState(false);
  const [header, setHeader] = useState<DetailHeader | null>(null);
  const [items, setItems] = useState<DetailItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!transactionId) return;

    let isMounted = true;
    setLoading(true);
    setError(null);

    fetch(`/api/sales-transactions/detail/${transactionId}`)
      .then(res => res.json())
      .then(json => {
        if (!isMounted) return;
        if (json.success && json.data) {
          setHeader(json.data.header);
          setItems(json.data.items || []);
        } else {
          setError(json.error || 'Failed to load transaction detail');
        }
      })
      .catch(() => {
        if (isMounted) setError('Network error');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => { isMounted = false; };
  }, [transactionId]);

  if (!transactionId) return null;

  const formatRp = (val: number) => `Rp ${Math.round(val || 0).toLocaleString('id-ID')}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white rounded-xl shadow-2xl overflow-hidden max-h-[95vh] flex flex-col animate-in fade-in zoom-in-95 duration-150"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between shrink-0">
          <div>
            <h3 className="font-bold text-gray-900 text-[16px] font-['Cabin']">Transaction Detail</h3>
            <p className="text-[12px] text-gray-500 font-mono mt-0.5">{header?.payment_no || transactionId}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="p-4 md:p-5 flex flex-col space-y-3 flex-1 min-h-0 overflow-y-auto">
          {loading ? (
            <div className="py-8 text-center text-[12px] text-gray-500 flex flex-col items-center justify-center gap-2 bg-gray-50/50 rounded-lg border border-gray-100">
              <Loader2 className="w-4 h-4 animate-spin text-[#016e3f]" /> Loading items...
            </div>
          ) : error ? (
            <div className="py-8 text-center text-[12px] text-red-500 bg-red-50 rounded-lg border border-red-100">
              {error}
            </div>
          ) : header ? (
            <>
              {/* Transaction Meta Grid */}
              <div className="bg-gray-50 rounded-lg p-3 grid grid-cols-2 gap-y-2.5 text-[11px] shrink-0">
                <div>
                  <span className="text-gray-500 block text-[10px] mb-0.5">Date</span>
                  <span className="font-medium text-gray-900">
                    {header.created_at ? new Date(header.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 block text-[10px] mb-0.5">Time</span>
                  <span className="font-medium text-gray-900">
                    {header.transaction_time || (header.created_at ? new Date(header.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '-')}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 block text-[10px] mb-0.5">Outlet</span>
                  <span className="font-medium text-gray-900 line-clamp-1" title={header.outlet_name || ''}>
                    {header.outlet_name || '-'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 block text-[10px] mb-0.5">Cashier</span>
                  <span className="font-medium text-gray-900 line-clamp-1" title={header.served_by || header.collected_by || ''}>
                    {header.served_by || header.collected_by || '-'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 block text-[10px] mb-0.5">Payment</span>
                  <span className="font-medium text-gray-900 capitalize">
                    {header.payment_type_label || header.payment_type || '-'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 block text-[10px] mb-0.5">Status</span>
                  {header.is_refunded ? (
                    <span className="text-red-600 font-semibold">Refunded</span>
                  ) : (
                    <span className="text-green-600 font-semibold">Completed</span>
                  )}
                </div>
              </div>

              {/* Items Ordered Section */}
              <div className="flex flex-col flex-1 min-h-0 shrink">
                <div className="flex justify-between items-center mb-2 shrink-0">
                  <h4 className="font-bold text-gray-900 text-[13px]">Items Ordered</h4>
                  <span className="text-[11px] font-medium bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                    {items.length} items
                  </span>
                </div>

                {items.length === 0 ? (
                  <div className="py-8 text-center text-[12px] text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-200 flex items-center justify-center">
                    No items found.
                  </div>
                ) : (
                  <div className="border border-gray-200 rounded-lg p-3 bg-white overflow-y-auto divide-y divide-gray-100 space-y-2.5 min-h-0 shrink">
                    {items.map((item, idx) => (
                      <div key={item.uuid || idx} className="flex justify-between items-start pt-2.5 first:pt-0">
                        <div className="pr-2">
                          <div className="font-medium text-gray-900 text-[12px] leading-tight">{item.item_name}</div>
                          {item.item_variant_name && (
                            <div className="text-[11px] text-gray-500 mt-0.5">{item.item_variant_name}</div>
                          )}
                          <div className="text-[11px] text-gray-400 mt-0.5">
                            {item.quantity} × {formatRp(item.price)}
                          </div>
                        </div>
                        <div className="font-semibold text-gray-900 text-[12px] whitespace-nowrap">
                          {formatRp(item.gross_sales)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Financial Summary */}
              <div className="pt-3 border-t border-gray-100 space-y-1.5 text-[12px] shrink-0">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal</span>
                  <span>{formatRp(header.subtotal || header.total_collected)}</span>
                </div>
                {Number(header.discounts) > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Discount</span>
                    <span>- {formatRp(header.discounts)}</span>
                  </div>
                )}
                {Number(header.taxes) > 0 && (
                  <div className="flex justify-between text-gray-600">
                    <span>Tax</span>
                    <span>+ {formatRp(header.taxes)}</span>
                  </div>
                )}
                {Number(header.gratuities) > 0 && (
                  <div className="flex justify-between text-gray-600">
                    <span>Service Charge</span>
                    <span>+ {formatRp(header.gratuities)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-gray-900 pt-2 border-t border-gray-100 text-[14px]">
                  <span>Total Paid</span>
                  <span className="text-[#016e3f]">{formatRp(header.total_collected)}</span>
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
