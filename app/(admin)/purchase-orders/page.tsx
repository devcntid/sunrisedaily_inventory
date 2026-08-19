'use client';
import { useState, useEffect, useCallback } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Modal } from '@/components/ui/Modal';
import { Toast } from '@/components/ui/Toast';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Select } from '@/components/ui/Select';
import { Pagination } from '@/components/ui/Pagination';
import { ItemSelectWithBrand } from '@/components/shared/ItemSelectWithBrand';
import { FullScreenLoader } from '@/components/ui/FullScreenLoader';
interface PO {
  id: number; po_number: string; vendor_name: string; vendor_id?: number | string; order_date: string;
  order_deadline?: string; status: string; total: number; buyer_name: string;
  created_at: string;
}

interface Vendor { id: number; name: string; is_active?: boolean; email?: string; phone?: string; }
interface Item { id: number; name: string; purchase_unit: string; smallest_unit?: string; conversion_ratio: number; current_average_price: number; last_purchase_price?: number; parent_id?: number | null; has_children?: boolean; }
interface Outlet { id: number; name: string; is_active?: boolean; }

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  RFQ: { label: 'RFQ', bg: '#f1f5f9', text: '#475569' },
  RFQ_TERKIRIM: { label: 'RFQ Terkirim', bg: '#dbeafe', text: '#1d4ed8' },
  PURCHASE_ORDER: { label: 'Purchase Order', bg: '#e0e7ff', text: '#4338ca' },
  DITERIMA_SEBAGIAN: { label: 'Diterima Sebagian', bg: '#fefce8', text: '#a16207' },
  SELESAI: { label: 'Selesai', bg: '#dcfce7', text: '#15803d' },
  DIBATALKAN: { label: 'Dibatalkan', bg: '#fee2e2', text: '#b91c1c' },
};

const fmtCurrency = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);

const STATUSES = ['RFQ', 'RFQ_TERKIRIM', 'PURCHASE_ORDER', 'DITERIMA_SEBAGIAN', 'SELESAI', 'DIBATALKAN'];

export default function PurchaseOrdersPage() {
  const [pos, setPos] = useState<PO[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [alerts, setAlerts] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 20;
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingLabel, setLoadingLabel] = useState('Memproses...');
  const [confirmCancel, setConfirmCancel] = useState(false);
  const setError = (message: string) => {
    if (message) setToast({ isOpen: true, message, type: 'error' });
  };
  const [form, setForm] = useState({ vendor_id: '', vendor_reference: '', deliver_to: 'Gudang Cihapit', destination_outlet_id: '', order_date: new Date().toISOString().split('T')[0], order_deadline: '', payment_terms: '', internal_notes: '' });
  const [lines, setLines] = useState<{ type: string; parent_id?: string | number; item_id: string | number; description: string; qty: string | number; unit_price: string | number; tax_percent: string | number; disc_percent: string | number }[]>([{ type: 'product', parent_id: '', item_id: '', description: '', qty: '', unit_price: '', tax_percent: '0', disc_percent: '0' }]);
  const [draftPO, setDraftPO] = useState<PO | null>(null);
  const [activeTab, setActiveTab] = useState('Bahan / Produk');
  const [activeDropdown, setActiveDropdown] = useState<number | null>(null);
  const [deliverToFocused, setDeliverToFocused] = useState(false);
  const [shouldAutoFill, setShouldAutoFill] = useState(false);
  const [bulkAddQty, setBulkAddQty] = useState('5');

  // Email state
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailForm, setEmailForm] = useState({ to: '', subject: '', message: '' });
  const [sendingEmail, setSendingEmail] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState('');
  const [toast, setToast] = useState({ isOpen: false, message: '', type: 'success' as 'success' | 'error' | 'info' });

  const fetchPOs = useCallback(async () => {
    setLoading(true);
    const params = statusFilter ? `?status=${statusFilter}` : '';
    const res = await fetch(`/api/purchase-orders${params}`);
    const data = await res.json();
    setPos(data.data ?? []);
    setLoading(false);
    setCurrentPage(1);
  }, [statusFilter]);

  useEffect(() => {
    fetchPOs();
    fetch('/api/vendors').then(r => r.json()).then(d => setVendors((d.data ?? []).filter((v: Vendor) => v.is_active !== false)));
    fetch('/api/items?active_only=true').then(r => r.json()).then(d => setItems(d.data ?? []));
    fetch('/api/purchase-orders/suggestions').then(r => r.json()).then(d => setAlerts(d.data ?? []));
    fetch('/api/outlets').then(r => r.json()).then(d => {
      const activeOutlets = (d.data ?? []).filter((o: Outlet) => o.is_active !== false);
      setOutlets(activeOutlets);
    });
  }, [fetchPOs]);

  useEffect(() => {
    if (shouldAutoFill && items.length > 0) {
      setShouldAutoFill(false);
      autoFillLowStock(true); // pass true to indicate it's an auto-trigger (so we don't show toast if empty)
    }
  }, [shouldAutoFill, items]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const openId = urlParams.get('open');
      if (openId) {
        handleViewPO({ id: Number(openId) } as any);
        window.history.replaceState({}, '', '/purchase-orders');
      }

      const createItemsStr = urlParams.get('create_items');
      if (createItemsStr) {
        setShowModal(true);
        setShouldAutoFill(true);
        window.history.replaceState({}, '', '/purchase-orders');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function addLine() {
    setLines(l => [{ type: 'product', parent_id: '', item_id: '', description: '', qty: '', unit_price: '', tax_percent: '0', disc_percent: '0' }, ...l]);
  }

  function addNote() {
    setLines(l => [{ type: 'note', item_id: '', description: '', qty: '', unit_price: '', tax_percent: '0', disc_percent: '0' }, ...l]);
  }

  function removeLine(i: number) {
    setLines(l => l.filter((_, idx) => idx !== i));
  }

  async function autoFillLowStock(isAuto = false) {
    try {
      const res = await fetch('/api/purchase-orders/suggestions');
      const data = await res.json();
      if (data.success && data.data) {
        const suggestions = data.data;
        if (suggestions.length === 0) {
          if (!isAuto) setToast({ isOpen: true, message: 'Saat ini tidak ada barang yang berada di bawah batas minimum (stok aman).', type: 'success' });
          return;
        }

        const existingItemIds = lines.map(l => String(l.item_id)).filter(Boolean);
        const newSuggestions = suggestions.filter((s: any) => !existingItemIds.includes(String(s.item_id)));

        if (newSuggestions.length === 0) {
          if (!isAuto) setToast({ isOpen: true, message: 'Semua barang dengan stok rendah sudah ada di dalam daftar.', type: 'info' });
          return;
        }

        if (!isAuto) setToast({ isOpen: true, message: `Berhasil menambahkan ${newSuggestions.length} barang ke dalam daftar.`, type: 'success' });

        setLines(current => {
          const valid = current.filter(l => l.description || l.item_id || (l.type === 'note' && l.description));
          const newLines = newSuggestions.map((a: any) => {
            const item = items.find((i: any) => String(i.id) === String(a.item_id));
            const conversion = Number(item && item.conversion_ratio > 0 ? item.conversion_ratio : 1) || 1;
            const deficit = a.minimum_threshold - Number(a.current_balance);
            const suggestedPurchaseQty = deficit > 0 ? Math.ceil(deficit / conversion) : 1;
            const hasBrands = !!item?.has_children;

            return {
              type: 'product',
              parent_id: String(a.item_id), // always assign as parent
              item_id: hasBrands ? '' : String(a.item_id), // force select brand if it has children
              description: a.item_name,
              qty: String(suggestedPurchaseQty),
              unit_price: (() => {
                if (hasBrands) return ''; // user must select brand to get price
                if (!item) return '0';
                return String(Math.round((item.last_purchase_price || item.current_average_price || 0) * conversion));
              })(),
              tax_percent: '0',
              disc_percent: '0',
              purchase_unit: item ? item.purchase_unit : a.smallest_unit,
            };
          });
          return [...newLines, ...valid];
        });
      }
    } catch (e) {
      setToast({ isOpen: true, message: 'Gagal memuat barang dengan stok rendah', type: 'error' });
    }
  }

  function updateLine(i: number, field: string, value: string) {
    setLines(l => l.map((line, idx) => idx === i ? { ...line, [field]: value } : line));
  }

  function handleItemTextChange(lineIdx: number, text: string) {
    const item = items.find(i => i.name === text);
    if (item) {
      // Gunakan last_purchase_price atau current_average_price (Harga dari Master Data)
      const prefillPricePerUnit = Math.round((item.last_purchase_price || item.current_average_price || 0) * (item.conversion_ratio || 1));
      setLines(l => l.map((line, idx) => idx === lineIdx ? { ...line, item_id: String(item.id), description: text, unit_price: String(prefillPricePerUnit), purchase_unit: item.purchase_unit || '', package_qty: '', package_inner_size: '', conversion_ratio: item.conversion_ratio ? String(item.conversion_ratio) : '' } : line));
    } else {
      setLines(l => l.map((line, idx) => idx === lineIdx ? { ...line, item_id: '', description: text } : line));
    }
  }

  let computedSubtotal = 0;
  let computedTax = 0;
  lines.forEach(l => {
    if (l.type === 'product') {
      const q = Number(l.qty) || 0;
      const up = Number(l.unit_price) || 0;
      const t = Number(l.tax_percent) || 0;
      const d = Number(l.disc_percent) || 0;
      const net = (q * up) * (1 - d / 100);
      computedSubtotal += net;
      computedTax += net * (t / 100);
    }
  });
  const computedTotal = computedSubtotal + computedTax;

  async function handleSave(statusToSet?: string) {
    if (!form.vendor_id) { setError('Kolom Vendor tidak boleh kosong.'); return; }
    if (!form.deliver_to.trim()) { setError('Kolom Deliver To tidak boleh kosong.'); return; }
    if (!form.order_deadline) { setError('Kolom Order Deadline tidak boleh kosong.'); return; }

    const hasIncompleteBrand = lines.some(l => l.type === 'product' && l.parent_id && !l.item_id);
    if (hasIncompleteBrand) {
      setError('Ada Bahan Utama yang belum dipilih Brand-nya. Mohon lengkapi pilihan Brand (Wajib) atau hapus baris tersebut.');
      return;
    }
    const validLines = lines.filter(l => (l.type === 'product' ? (l.item_id && l.qty && l.unit_price) : l.description));
    if (!validLines.length) { setError('Minimal 1 item/bahan harus diisi dengan lengkap.'); return; }

    const invalidQtyOrPrice = validLines.some(l => l.type === 'product' && (Number(l.qty) <= 0 || Number(l.unit_price) < 0));
    if (invalidQtyOrPrice) {
      setError('Kuantitas (Qty) produk harus lebih dari 0 dan Harga Satuan tidak boleh minus.');
      return;
    }

    setSaving(true); setError('');
    try {
      const url = draftPO ? `/api/purchase-orders/${draftPO.id}` : '/api/purchase-orders';
      const method = draftPO ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          vendor_id: Number(form.vendor_id),
          items: validLines.map((l: any, idx: number) => ({
            line_type: l.type === 'note' ? 'CATATAN' : 'PRODUK',
            item_id: l.type === 'product' ? Number(l.item_id) : null,
            description: l.description,
            qty: l.type === 'product' ? Number(l.qty) : null,
            unit_price: l.type === 'product' ? Number(l.unit_price) : null,
            tax_percent: l.type === 'product' ? Number(l.tax_percent) : null,
            discount_percent: l.type === 'product' ? Number(l.disc_percent) : null,
            purchase_unit: l.type === 'product' ? l.purchase_unit : null,
            package_qty: l.type === 'product' ? Number(l.package_qty) || null : null,
            package_inner_size: l.type === 'product' ? Number(l.package_inner_size) || null : null,
            conversion_ratio: l.type === 'product' ? Number(l.conversion_ratio) || null : null,
            sort_order: idx,
          })),
        }),
      });
      const data = await res.json();
      if (!data.success) { setError(data.message); return; }

      let finalPO = data.data;

      if (statusToSet) {
        await fetch(`/api/purchase-orders/${finalPO.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: statusToSet }),
        });
        const res2 = await fetch(`/api/purchase-orders/${finalPO.id}`);
        const data2 = await res2.json();
        finalPO = data2.data;
      }

      setDraftPO(finalPO);
      fetchPOs();
    } finally { setSaving(false); }
  }

  async function handleViewPO(po: PO) {
    const res = await fetch(`/api/purchase-orders/${po.id}`);
    const data = await res.json();
    const fetchedPO = data.data;

    setDraftPO(fetchedPO);
    setForm({
      vendor_id: String(fetchedPO.vendor_id || ''),
      vendor_reference: fetchedPO.vendor_reference || '',
      deliver_to: fetchedPO.deliver_to || '',
      destination_outlet_id: fetchedPO.destination_outlet_id ? String(fetchedPO.destination_outlet_id) : '',
      order_date: fetchedPO.order_date ? fetchedPO.order_date.split('T')[0] : '',
      order_deadline: fetchedPO.order_deadline ? fetchedPO.order_deadline.split('T')[0] : '',
      payment_terms: fetchedPO.payment_terms || '',
      internal_notes: fetchedPO.internal_notes || ''
    } as any);

    const fetchedLines = (fetchedPO.items || []).map((i: { line_type?: string; item_id?: number; item_name?: string; description?: string; qty?: number; unit_price?: number; tax_percent?: number; discount_percent?: number; purchase_unit?: string; package_qty?: number; package_inner_size?: number; conversion_ratio?: number; parent_id?: number | null; }) => ({
      type: i.line_type === 'CATATAN' ? 'note' : 'product',
      parent_id: i.parent_id ? String(i.parent_id) : (i.item_id ? String(i.item_id) : ''),
      item_id: i.item_id ? String(i.item_id) : '',
      description: i.description || '',
      qty: String(i.qty || ''),
      unit_price: String(i.unit_price || ''),
      tax_percent: String(i.tax_percent || '0'),
      disc_percent: String(i.discount_percent || '0'),
      purchase_unit: i.purchase_unit || '',
      package_qty: i.package_qty ? String(i.package_qty) : '',
      package_inner_size: i.package_inner_size ? String(i.package_inner_size) : '',
      conversion_ratio: i.conversion_ratio ? String(i.conversion_ratio) : ''
    }));

    setLines(fetchedLines.length ? fetchedLines : [{ type: 'product', parent_id: '', item_id: '', description: '', qty: '', unit_price: '', tax_percent: '0', disc_percent: '0', purchase_unit: '', package_qty: '', package_inner_size: '', conversion_ratio: '' }]);
    setActiveTab('Bahan / Produk');
    setShowModal(true);
  }

  async function handleUpdateStatus(poId: number, status: string) {
    if (status === 'PURCHASE_ORDER') setLoadingLabel('Mengkonfirmasi Order...');
    else if (status === 'DIBATALKAN') setLoadingLabel('Membatalkan Order...');
    else setLoadingLabel('Memproses...');

    setSaving(true);
    try {
      await fetch(`/api/purchase-orders/${poId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const res = await fetch(`/api/purchase-orders/${poId}`);
      const data = await res.json();
      setDraftPO(data.data);
      fetchPOs();
    } finally {
      setSaving(false);
      setLoadingLabel('Memproses...');
    }
  }

  function generatePDFBase64(): string {
    const doc = new jsPDF();
    const poNum = draftPO?.po_number || 'DRAFT';

    // Header
    doc.setFontSize(20);
    doc.text('PURCHASE ORDER', 14, 22);
    doc.setFontSize(10);
    doc.text(`PO Number: ${poNum}`, 14, 30);
    doc.text(`Order Date: ${form.order_date}`, 14, 35);
    doc.text(`Vendor: ${vendors.find(v => String(v.id) === form.vendor_id)?.name || ''}`, 14, 40);
    doc.text(`Deliver To: ${form.deliver_to}`, 14, 45);

    // Table
    const tableData = lines.filter(l => l.description).map((l, i) => {
      if (l.type === 'note') {
        return [
          i + 1,
          { content: l.description, styles: { fontStyle: 'italic', textColor: '#64748b' } },
          '',
          '',
          '',
          ''
        ];
      }
      return [
        i + 1,
        l.description,
        l.qty,
        (l as any).purchase_unit || (items.find((it: any) => String(it.id) === String(l.item_id)) as any)?.purchase_unit || '-',
        fmtCurrency(Number(l.unit_price)).replace(',00', ''),
        fmtCurrency(Number(l.qty) * Number(l.unit_price) * (1 - Number(l.disc_percent) / 100)).replace(',00', '')
      ];
    });

    autoTable(doc, {
      startY: 55,
      head: [['#', 'Description', 'Qty', 'Unit', 'Unit Price', 'Amount']],
      body: tableData,
    });

    // Totals
    const finalY = (doc as any).lastAutoTable.finalY || 55;
    doc.text(`Subtotal: ${fmtCurrency(computedSubtotal).replace(',00', '')}`, 140, finalY + 10);
    doc.text(`Taxes: ${fmtCurrency(computedTax).replace(',00', '')}`, 140, finalY + 16);
    doc.setFont('helvetica', 'bold');
    doc.text(`Total: ${fmtCurrency(computedTotal).replace(',00', '')}`, 140, finalY + 24);

    // Output as base64 data uri
    return doc.output('datauristring');
  }

  async function handleSendEmail() {
    if (!emailForm.to) {
      setError('Alamat email tujuan harus diisi.');
      return;
    }

    setSendingEmail(true);
    setError('');

    try {
      // Auto-save as RFQ_TERKIRIM if it's currently RFQ
      if (!draftPO || draftPO.status === 'RFQ') {
        await handleSave('RFQ_TERKIRIM');
      }

      const pdfBase64 = generatePDFBase64();
      const res = await fetch(`/api/purchase-orders/${draftPO?.id || 'new'}/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: emailForm.to,
          subject: emailForm.subject,
          message: emailForm.message,
          pdfBase64,
          poNumber: draftPO?.po_number || 'DRAFT'
        }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.message);
      } else {
        setShowEmailModal(false);
        setToast({ isOpen: true, message: 'Email berhasil dikirim!', type: 'success' });
        if (draftPO?.status === 'RFQ') {
          handleUpdateStatus(draftPO.id, 'RFQ_TERKIRIM');
        }
      }
    } catch (err: unknown) {
      setError('Gagal mengirim email: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setSendingEmail(false);
    }
  }
  const handleSendWA = async () => {
    if (!draftPO) return;
    const selectedVendor = vendors.find(v => String(v.id) === String(draftPO.vendor_id));
    if (!selectedVendor?.phone) {
      setToast({ isOpen: true, message: 'Nomor telepon vendor ini belum terdaftar. Harap lengkapi pada menu Master Data terlebih dahulu.', type: 'error' });
      return;
    }

    let phone = selectedVendor.phone.replace(/\D/g, '');
    if (phone.startsWith('0')) {
      phone = '62' + phone.substring(1);
    }

    const text = `Halo ${selectedVendor.name}, berikut adalah dokumen Purchase Order (PO: ${draftPO.po_number}) dari Sunrise Daily. Terima kasih.`;
    const encodedText = encodeURIComponent(text);

    if (draftPO.status === 'RFQ') {
      handleUpdateStatus(draftPO.id, 'RFQ_TERKIRIM');
    }

    // Buka WhatsApp Web/App di tab baru langsung agar tidak diblokir popup blocker
    window.open(`https://wa.me/${phone}?text=${encodedText}`, '_blank');

    // Otomatis download PDF tanpa membuka tab baru (menggunakan fetch & Blob)
    try {
      const res = await fetch(`/api/purchase-orders/${draftPO.id}/pdf`);
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const formattedDate = draftPO.order_date ? new Date(draftPO.order_date).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-') : 'PO';
        a.download = `${formattedDate}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (err) {
    }
  };


  function handleDownloadPDF() {
    if (!draftPO || !draftPO.id) {
      setToast({ isOpen: true, message: 'Harap simpan PO terlebih dahulu sebelum melihat dokumen PDF.', type: 'info' });
      return;
    }
    window.open(`/api/purchase-orders/${draftPO.id}/pdf`, '_blank');
  }

  function openEmailModal() {
    // Basic validation before opening
    if (!form.vendor_id || !form.deliver_to) {
      setError('Mohon lengkapi Vendor dan Deliver To terlebih dahulu.');
      return;
    }
    const hasIncompleteBrand = lines.some(l => l.type === 'product' && l.parent_id && !l.item_id);
    if (hasIncompleteBrand) {
      setError('Ada Bahan Utama yang belum dipilih Brand-nya. Mohon lengkapi pilihan Brand (Wajib) atau hapus baris tersebut.');
      return;
    }

    const validLines = lines.filter(l => (l.type === 'product' ? (l.item_id && l.qty && l.unit_price) : l.description));
    if (!validLines.length) { setError('Minimal 1 item/bahan harus diisi dengan lengkap.'); return; }

    const invalidQtyOrPrice = validLines.some(l => l.type === 'product' && (Number(l.qty) <= 0 || Number(l.unit_price) < 0));
    if (invalidQtyOrPrice) {
      setError('Kuantitas (Qty) produk harus lebih dari 0 dan Harga Satuan tidak boleh minus.');
      return;
    }
    const selectedVendor = vendors.find(v => String(v.id) === form.vendor_id);
    if (!selectedVendor?.email) {
      setError('Email vendor ini belum terdaftar. Harap lengkapi email vendor pada menu Master Data terlebih dahulu agar dapat mengirim email.');
      return;
    }
    setEmailForm({
      to: selectedVendor.email,
      subject: `Purchase Order ${draftPO?.po_number || 'Baru'} - Sunrise Daily`,
      message: `Yth. Tim Penjualan ${selectedVendor.name},\n\nBersama email ini, kami bermaksud untuk mengirimkan dokumen Purchase Order (PO) terbaru dari Sunrise Daily.\n\nDetail pemesanan beserta rincian barang, jumlah, dan harga telah kami lampirkan secara lengkap pada dokumen PDF di email ini.\nKami harap barang dapat dipersiapkan dan dikirimkan sesuai dengan tenggat waktu yang telah disepakati.\n\nMohon bantuannya untuk segera memproses pesanan ini dan memberikan konfirmasi tanda terima dengan membalas email ini.\n\nAtas perhatian dan kerja samanya, kami ucapkan terima kasih.\n\nHormat kami,\nTim Purchasing\nSunrise Daily`
    });
    setPdfPreviewUrl(''); // Reset preview url
    setShowEmailModal(true);
  }

  // Calculate KPIs
  const toSend = pos.filter(p => p.status === 'RFQ').length;
  const waiting = pos.filter(p => p.status === 'RFQ_TERKIRIM' || p.status === 'PURCHASE_ORDER').length;
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const late = pos.filter(p => {
    if (!p.order_deadline || ['SELESAI', 'DIBATALKAN'].includes(p.status)) return false;
    const deadline = new Date(p.order_deadline);
    deadline.setHours(0, 0, 0, 0);
    return deadline.getTime() < todayStart.getTime();
  }).length;

  const avgOrderValue = pos.length ? pos.reduce((s, p) => s + Number(p.total), 0) / pos.length : 0;
  const purchased7Days = pos.filter(p => new Date(p.created_at) > new Date(Date.now() - 7 * 86400000)).reduce((s, p) => s + Number(p.total), 0);
  const rfqSent7Days = pos.filter(p => p.status === 'RFQ_TERKIRIM' && new Date(p.created_at) > new Date(Date.now() - 7 * 86400000)).length;

  return (
    <section className="screen">
      <Toast {...toast} duration={1500} onClose={() => setToast(t => ({ ...t, isOpen: false }))} />
      <FullScreenLoader open={saving || sendingEmail} label={sendingEmail ? 'Mengirim email...' : loadingLabel} />

      <ConfirmDialog
        open={confirmCancel}
        title="Batalkan Pesanan Ini?"
        message="Yakin ingin membatalkan pesanan ini?"
        confirmText="Batalkan Pesanan"
        danger={true}
        onConfirm={() => {
          if (draftPO) handleUpdateStatus(draftPO.id, 'DIBATALKAN');
          setConfirmCancel(false);
        }}
        onCancel={() => setConfirmCancel(false)}
      />

      {!showModal ? (
        <div className="card">
          <div className="card-head" style={{ paddingBottom: 10 }}>
            <div>
              <h3 style={{ fontSize: 18, margin: 0 }}>Permintaan Penawaran (PO)</h3>
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => {
              setError('');
              setDraftPO(null);
              setForm({ vendor_id: '', vendor_reference: '', deliver_to: 'Gudang Cihapit', destination_outlet_id: '', order_date: new Date().toISOString().split('T')[0], order_deadline: '', payment_terms: '', internal_notes: '' });
              setLines([{ type: 'product', item_id: '', description: '', qty: '', unit_price: '', tax_percent: '0', disc_percent: '0', purchase_unit: '', package_qty: '', package_inner_size: '', conversion_ratio: '' } as any]);
              setActiveTab('Bahan / Produk');
              setShowModal(true);
            }}>Buat PO</button>
          </div>

          {/* Odoo KPI Dashboard */}
          <div style={{ padding: '10px 16px', display: 'flex', gap: 24, borderBottom: '1px solid var(--border)', background: '#fff', alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Left KPI Cards */}
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ width: 85, height: 50, background: 'var(--primary)', color: 'white', borderRadius: 6, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 4px rgba(1, 110, 63, 0.2)' }} onClick={() => setStatusFilter('RFQ')}>
                <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1 }}>{toSend}</div>
                <div style={{ fontSize: 11, marginTop: 2 }}>Akan Dikirim</div>
              </div>
              <div style={{ width: 85, height: 50, background: '#f8fafc', color: '#475569', borderRadius: 6, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: '1px solid #e2e8f0', cursor: 'pointer' }} onClick={() => setStatusFilter('RFQ_TERKIRIM')}>
                <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1, color: 'var(--primary)' }}>{waiting}</div>
                <div style={{ fontSize: 11, marginTop: 2 }}>Menunggu</div>
              </div>
              <div style={{ width: 85, height: 50, background: '#fef2f2', color: '#ef4444', borderRadius: 6, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: '1px solid #fecaca', cursor: 'pointer' }}>
                <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1 }}>{late}</div>
                <div style={{ fontSize: 11, marginTop: 2 }}>Terlambat</div>
              </div>
            </div>

            {/* Right Metrics */}
            <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 32px', fontSize: 12, color: '#475569' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 3, borderBottom: '1px solid #f1f5f9' }}>
                <span>Rata-rata Nilai Order</span>
                <span className="font-bold text-dark">{fmtCurrency(avgOrderValue).replace(',00', '')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 3, borderBottom: '1px solid #f1f5f9' }}>
                <span>Pembelian 7 Hari Terakhir</span>
                <span className="font-bold text-dark">{fmtCurrency(purchased7Days).replace(',00', '')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 3, borderBottom: '1px solid #f1f5f9' }}>
                <span>Waktu Tunggu Pembelian</span>
                <span className="font-bold text-dark">0.00 Hari</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 3, borderBottom: '1px solid #f1f5f9' }}>
                <span>RFQ Dikirim 7 Hari Terakhir</span>
                <span className="font-bold text-dark">{rfqSent7Days}</span>
              </div>
            </div>
          </div>

          <div className="card-body flush table-responsive" style={{ minHeight: 400 }}>
            {loading ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>Memuat...</div> : pos.length === 0 ? (
              <div style={{ padding: 60, textAlign: 'center', color: '#64748b', fontSize: 15 }}>
                Tidak ada purchase order ditemukan
              </div>
            ) : (
              <>
                <table style={{ border: 'none' }}>
                  <thead>
                    <tr style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', color: '#334155' }}>
                      <th style={{ width: 40, paddingLeft: 16 }}><input type="checkbox" /></th>
                      <th style={{ width: 30 }}></th>
                      <th>NO. PO</th>
                      <th>Vendor</th>
                      <th>Batas Waktu Order</th>
                      <th>Aktivitas</th>
                      <th>Dokumen Sumber</th>
                      <th className="right">Total</th>
                      <th className="center">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pos.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE).map(po => {
                      const cfg = STATUS_CONFIG[po.status] ?? { label: po.status, bg: '#f1f5f9', text: '#475569' };
                      return (
                        <tr key={po.id} onClick={() => handleViewPO(po)} style={{ cursor: 'pointer', borderBottom: '1px solid #f1f5f9' }} className="hover-row">
                          <td style={{ paddingLeft: 16 }} onClick={e => e.stopPropagation()}><input type="checkbox" /></td>
                          <td className="muted" style={{ fontSize: 16 }}>☆</td>
                          <td className="font-bold text-primary">{po.po_number}</td>
                          <td className="text-dark">{po.vendor_name}</td>
                          <td className="text-dark">{po.order_deadline ? new Date(po.order_deadline).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</td>
                          <td className="muted">
                            {['RFQ_TERKIRIM', 'PURCHASE_ORDER', 'DITERIMA_SEBAGIAN', 'SELESAI'].includes(po.status) ? (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#016e3f', fontSize: 13, fontWeight: 600 }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                                Dikirim
                              </span>
                            ) : '—'}
                          </td>
                          <td className="muted">—</td>
                          <td className="right num text-dark font-bold">{fmtCurrency(po.total).replace(',00', '')}</td>
                          <td className="center"><span style={{ background: cfg.bg, color: cfg.text, border: `1px solid ${cfg.text}33`, padding: '4px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700 }}>{cfg.label}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {pos.length > ITEMS_PER_PAGE && (
                  <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #e2e8f0' }}>
                    <div className="muted" style={{ fontSize: 13 }}>
                      Menampilkan {(currentPage - 1) * ITEMS_PER_PAGE + 1} - {Math.min(currentPage * ITEMS_PER_PAGE, pos.length)} dari {pos.length}
                    </div>
                    <Pagination 
                      currentPage={currentPage} 
                      totalPages={Math.ceil(pos.length / ITEMS_PER_PAGE)} 
                      totalItems={pos.length} 
                      itemsPerPage={ITEMS_PER_PAGE} 
                      onPageChange={setCurrentPage} 
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="card">
          <style>{`
            .po-table-input {
              border: 1px solid transparent;
              background: transparent;
              padding: 4px 8px;
              width: 100%;
              border-radius: 4px;
              font-size: 13px;
              outline: none;
              transition: border-color 0.2s, background 0.2s;
            }
            .po-table-input:focus {
              border-color: var(--primary);
              background: #fff;
            }
            .po-table-input.ingredient-input {
              border-color: #e2e8f0;
              background: #fff;
              height: 32px;
            }
            .po-table-input.transparent-input {
              border-color: transparent;
              background: transparent;
              text-align: right;
            }
            .po-table-input.transparent-input:hover {
              background: #f8fafc;
            }
            .po-table-input.transparent-input:focus {
              border-color: #cbd5e1;
              background: #fff;
            }
            .po-table-input[type=number]::-webkit-inner-spin-button,
            .po-table-input[type=number]::-webkit-outer-spin-button {
              -webkit-appearance: none;
              margin: 0;
            }
            .po-table-input[type=number] {
              -moz-appearance: textfield;
            }
          `}</style>
          <div style={{ borderBottom: '1px solid var(--border)', background: '#fff', borderTopLeftRadius: 8, borderTopRightRadius: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 24px', flexWrap: 'wrap', gap: 12 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                {(!draftPO || draftPO.status === 'RFQ') && (
                  <>
                    <button className="btn btn-sm" style={{ background: 'var(--primary)', color: '#fff', border: 'none', fontWeight: 600 }} onClick={openEmailModal} disabled={saving}>Kirim via Email</button>
                    {/* <button className="btn btn-sm" style={{ background: 'var(--primary)', color: '#fff', border: 'none', fontWeight: 600 }} onClick={handleSendWA} disabled={saving}>Kirim via WA</button> */}
                    <button className="btn btn-sm btn-outline" style={{ background: '#fff', color: 'var(--primary)', border: '1px solid var(--primary)', fontWeight: 600 }} onClick={() => handleSave()} disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan Draft'}</button>
                  </>
                )}
                {draftPO?.status === 'RFQ_TERKIRIM' && (
                  <button className="btn btn-sm" style={{ background: 'var(--primary)', color: '#fff', border: 'none', fontWeight: 600 }} onClick={() => handleUpdateStatus(draftPO.id, 'PURCHASE_ORDER')} disabled={saving}>Konfirmasi Order</button>
                )}
                {(draftPO?.status === 'PURCHASE_ORDER' || draftPO?.status === 'DITERIMA_SEBAGIAN') && (
                  <button className="btn btn-sm" style={{ background: 'var(--primary)', color: '#fff', border: 'none', fontWeight: 600 }} onClick={() => {
                    window.location.href = `/warehouse/receipt/${draftPO.id}`;
                  }} disabled={saving}>Terima Produk</button>
                )}
                {draftPO && draftPO.status !== 'DIBATALKAN' && draftPO.status !== 'SELESAI' && draftPO.status !== 'DITERIMA_SEBAGIAN' && (
                  <button className="btn btn-sm btn-outline" style={{ background: '#fff', color: '#b91c1c', border: '1px solid #f87171', fontWeight: 600 }} onClick={() => setConfirmCancel(true)} disabled={saving}>Batalkan Order</button>
                )}
                <button className="btn btn-sm btn-outline" style={{ background: '#fff', color: 'var(--primary)', border: '1px solid var(--primary)', fontWeight: 600 }} onClick={handleDownloadPDF} title="Download/View PDF Document">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 6 }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                  PDF
                </button>
                <button className="btn btn-sm btn-outline" style={{ background: '#fff', color: '#475569', border: '1px solid #cbd5e1', fontWeight: 600 }} onClick={() => setShowModal(false)}>Kembali</button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', fontSize: 11, fontWeight: 600, color: '#64748b' }}>
                {draftPO?.status === 'DIBATALKAN' ? (
                  <div style={{ background: '#fef2f2', color: '#b91c1c', padding: '2px 10px', borderRadius: 12, border: '1px solid #f87171' }}>Dibatalkan</div>
                ) : (
                  <>
                    <div style={{ background: (!draftPO || draftPO.status === 'RFQ') ? 'var(--primary)' : '#f1f5f9', color: (!draftPO || draftPO.status === 'RFQ') ? '#fff' : 'inherit', padding: '2px 10px', borderRadius: 12 }}>RFQ</div>
                    <div style={{ width: 16, height: 1, background: '#cbd5e1', margin: '0 2px' }} />
                    <div style={{ background: draftPO?.status === 'RFQ_TERKIRIM' ? 'var(--primary)' : '#f1f5f9', color: draftPO?.status === 'RFQ_TERKIRIM' ? '#fff' : 'inherit', padding: '2px 10px', borderRadius: 12 }}>RFQ Dikirim</div>
                    <div style={{ width: 16, height: 1, background: '#cbd5e1', margin: '0 2px' }} />
                    <div style={{ background: draftPO?.status === 'PURCHASE_ORDER' ? 'var(--primary)' : '#f1f5f9', color: draftPO?.status === 'PURCHASE_ORDER' ? '#fff' : 'inherit', padding: '2px 10px', borderRadius: 12 }}>Purchase Order</div>
                    <div style={{ width: 16, height: 1, background: '#cbd5e1', margin: '0 2px' }} />
                    <div style={{ background: (draftPO?.status === 'SELESAI' || draftPO?.status === 'DITERIMA_SEBAGIAN') ? 'var(--primary)' : '#f1f5f9', color: (draftPO?.status === 'SELESAI' || draftPO?.status === 'DITERIMA_SEBAGIAN') ? '#fff' : 'inherit', padding: '2px 10px', borderRadius: 12 }}>Selesai</div>
                  </>
                )}
              </div>
            </div>
          </div>

          <div style={{ padding: '24px 24px 0', display: 'flex', alignItems: 'center', gap: 16, background: '#fff' }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
            <h1 style={{ fontSize: 32, fontWeight: 800, color: 'var(--primary)', margin: 0, lineHeight: 1 }}>{draftPO ? draftPO.po_number : 'PO Baru'}</h1>
            <div style={{ flex: 1 }} />

          </div>
          <div className="card-body flush" style={{ padding: 24 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

              <fieldset disabled={draftPO ? draftPO.status !== 'RFQ' : false} style={{ border: 'none', padding: 0, margin: 0 }}>
                <div style={{ display: 'flex', gap: 48, flexWrap: 'wrap' }}>
                  {/* Left Column */}
                  <div style={{ flex: 1, minWidth: 300, display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div className="form-group">
                      <label className="req">Vendor</label>
                      <Select
                        value={form.vendor_id}
                        onChange={val => setForm(f => ({ ...f, vendor_id: String(val) }))}
                        options={[
                          { value: '', label: 'Pilih vendor...' },
                          ...vendors.map(v => ({ value: String(v.id), label: v.name }))
                        ]}
                        disabled={draftPO ? draftPO.status !== 'RFQ' : false}
                      />
                    </div>
                    <div className="form-group">
                      <label>Referensi Vendor</label>
                      <input className="input" value={form.vendor_reference} onChange={e => setForm(f => ({ ...f, vendor_reference: e.target.value }))} placeholder="misal: PO-REF-123" />
                    </div>
                  </div>

                  {/* Right Column */}
                  <div style={{ flex: 1, minWidth: 300, display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div className="form-group" style={{ position: 'relative' }}>
                      <label>Kirim Ke</label>
                      <input className="input" value={form.deliver_to} onFocus={(e) => { setDeliverToFocused(true); e.target.select(); }} onBlur={() => setTimeout(() => setDeliverToFocused(false), 200)} onChange={e => {
                        const val = e.target.value;
                        const matched = outlets.find(o => o.name === val);
                        setForm(f => ({ ...f, deliver_to: val, destination_outlet_id: matched ? String(matched.id) : '' }));
                      }} placeholder="Pilih atau ketik tujuan..." />

                      {deliverToFocused && (
                        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid var(--primary)', borderRadius: 4, maxHeight: 200, overflowY: 'auto', zIndex: 50, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', marginTop: 2 }}>
                          {[{ name: 'Gudang Cihapit', id: 'gudang' }, ...outlets].filter(o => o.name.toLowerCase().includes(form.deliver_to.toLowerCase())).map((o: any) => (
                            <div key={o.id} style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13, color: '#1e293b', borderBottom: '1px solid #f8fafc' }} onMouseDown={(e) => {
                              e.preventDefault();
                              setForm(f => ({ ...f, deliver_to: o.name, destination_outlet_id: o.id === 'gudang' ? '' : String(o.id) }));
                              setDeliverToFocused(false);
                            }} onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                              {o.name}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                      <div className="form-group">
                        <label>Tanggal Order</label>
                        <input className="input" type="date" min={new Date().toISOString().split('T')[0]} value={form.order_date} onChange={e => setForm(f => ({ ...f, order_date: e.target.value }))} onKeyDown={e => e.preventDefault()} onClick={e => (e.target as HTMLInputElement).showPicker && (e.target as HTMLInputElement).showPicker()} />
                      </div>
                      <div className="form-group">
                        <label>Batas Waktu Order</label>
                        <input className="input" type="date" min={new Date().toISOString().split('T')[0]} value={form.order_deadline} onChange={e => setForm(f => ({ ...f, order_deadline: e.target.value }))} onKeyDown={e => e.preventDefault()} onClick={e => (e.target as HTMLInputElement).showPicker && (e.target as HTMLInputElement).showPicker()} />
                      </div>
                    </div>
                    <div className="form-group">
                      <label>Ketentuan Pembayaran</label>
                      <input className="input" value={form.payment_terms} onChange={e => setForm(f => ({ ...f, payment_terms: e.target.value }))} placeholder="misal: 30 days, Cash" />
                    </div>
                  </div>
                </div>

                {/* Odoo Style Tabs */}
                <div style={{ marginTop: 20 }}>
                  <div style={{ display: 'flex', gap: 24, borderBottom: '1px solid var(--border)', paddingBottom: 0, marginBottom: 16 }}>
                    {['Bahan / Produk', 'Info Lainnya'].map(tab => (
                      <div key={tab}
                        onClick={() => setActiveTab(tab)}
                        style={{
                          padding: '8px 4px',
                          cursor: 'pointer',
                          color: activeTab === tab ? 'var(--primary)' : '#64748b',
                          fontWeight: activeTab === tab ? 600 : 500,
                          borderBottom: activeTab === tab ? '2px solid var(--primary)' : '2px solid transparent',
                          marginBottom: -1
                        }}>
                        {tab}
                      </div>
                    ))}
                  </div>

                  {activeTab === 'Bahan / Produk' && (
                    <div>
                      <fieldset disabled={draftPO ? draftPO.status !== 'RFQ' : false} style={{ border: 'none', padding: 0, margin: 0 }}>
                      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
                        <button className="btn btn-sm btn-outline" style={{ background: '#fff', color: 'var(--primary)', border: '1px solid var(--primary)', fontWeight: 600 }} onClick={addLine}>+ Produk</button>
                        <button type="button" className="btn btn-sm" style={{ color: 'var(--primary)', border: '1px solid var(--primary)', fontWeight: 600 }} onClick={() => autoFillLowStock()}>+ Isi Otomatis Stok</button>
                        <button className="btn btn-sm btn-outline" style={{ background: '#fff', color: 'var(--primary)', border: '1px solid var(--primary)', fontWeight: 600 }} onClick={addNote}>+ Catatan</button>

                        <div style={{ width: '1px', height: '24px', background: '#cbd5e1', margin: '0 8px' }}></div>

                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          <input
                            type="number"
                            className="input num"
                            style={{ width: '50px', padding: '4px 8px', borderRight: 'none', borderTopRightRadius: 0, borderBottomRightRadius: 0, fontSize: 13, height: '32px' }}
                            value={bulkAddQty}
                            onChange={(e) => setBulkAddQty(e.target.value)}
                            placeholder="Qty"
                          />
                          <button
                            type="button"
                            className="btn btn-sm"
                            style={{ borderRadius: 0, height: '32px', fontWeight: 600, background: '#fff', color: '#ef4444', border: '1px solid #ef4444', borderRight: 'none', padding: '0 16px' }}
                            onClick={() => {
                              const val = Number(bulkAddQty) || 0;
                              if (val === 0) return;
                              setLines(l => l.map(line => {
                                if (line.type === 'product' && line.item_id) {
                                  const currentQty = Number(line.qty) || 0;
                                  return { ...line, qty: String(Math.max(0, currentQty - val)) };
                                }
                                return line;
                              }));
                            }}
                          >
                            -
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm"
                            style={{ borderTopLeftRadius: 0, borderBottomLeftRadius: 0, height: '32px', fontWeight: 600, background: 'var(--primary)', color: '#fff', border: '1px solid var(--primary)', padding: '0 16px' }}
                            onClick={() => {
                              const val = Number(bulkAddQty) || 0;
                              if (val === 0) return;
                              setLines(l => l.map(line => {
                                if (line.type === 'product' && line.item_id) {
                                  const currentQty = Number(line.qty) || 0;
                                  return { ...line, qty: String(currentQty + val) };
                                }
                                return line;
                              }));
                            }}
                          >
                            +
                          </button>
                        </div>
                      </div>
                      <div className="table-responsive" style={{ overflow: 'visible' }}>
                        <table style={{ margin: 0, width: '100%' }}>
                          <thead>
                            <tr style={{ borderBottom: '1px solid #e2e8f0', color: '#64748b', fontSize: 11, textTransform: 'uppercase' }}>
                              <th style={{ padding: '12px 0', paddingRight: '8px', minWidth: 140, maxWidth: 200 }}>Bahan / Produk</th>
                              <th className="right" style={{ minWidth: 70 }}>Kuantitas</th>
                              <th className="center" style={{ minWidth: 120 }}>Satuan</th>
                              <th className="right" style={{ minWidth: 110 }}>Harga Satuan</th>
                              <th className="right" style={{ minWidth: 60 }}>Pajak %</th>
                              <th className="right" style={{ minWidth: 60 }}>Diskon %</th>
                              <th className="right" style={{ minWidth: 120 }}>Jumlah</th>
                              <th style={{ width: 30 }}></th>
                            </tr>
                          </thead>
                          <tbody style={{ background: '#fff' }}>
                            {lines.map((line, idx) => {
                              if (line.type === 'note') {
                                return (
                                  <tr key={`note-${idx}`} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                    <td style={{ padding: '8px 16px' }}>
                                      <textarea className="input" rows={2} style={{ width: '100%', resize: 'none', fontStyle: 'italic', fontSize: 13 }} placeholder="Ketik catatan..." value={line.description} onChange={e => updateLine(idx, 'description', e.target.value)} />
                                    </td>
                                    <td colSpan={6}></td>
                                    <td className="center" style={{ padding: '6px 4px' }}>
                                      <button onClick={() => removeLine(idx)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}>
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                                      </button>
                                    </td>
                                  </tr>
                                );
                              }
                              return (
                                <tr key={`line-${idx}`} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                  <td style={{ padding: '6px 8px', position: 'relative' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                      <Select
                                        value={String(line.parent_id || line.item_id || '')}
                                        onChange={(val) => {
                                          const found = items.find(i => String(i.id) === String(val));
                                          if (!found) return;
                                          if (found.has_children) {
                                            updateLine(idx, 'parent_id', String(found.id));
                                            updateLine(idx, 'item_id', '');
                                            updateLine(idx, 'description', found.name);
                                            updateLine(idx, 'unit_price', '');
                                          } else {
                                            updateLine(idx, 'parent_id', String(found.id));
                                            updateLine(idx, 'item_id', String(found.id));
                                            updateLine(idx, 'description', found.name);
                                            const price = Math.round((found.last_purchase_price || found.current_average_price || 0) * (found.conversion_ratio || 1));
                                            updateLine(idx, 'unit_price', String(price));
                                            updateLine(idx, 'purchase_unit', found.purchase_unit || '');
                                          }
                                        }}
                                        options={[
                                          { value: '', label: 'Pilih Bahan Utama...' },
                                          ...items.filter(i => !i.parent_id).map(i => ({ value: String(i.id), label: i.name }))
                                        ]}
                                        searchable
                                        disabled={draftPO ? draftPO.status !== 'RFQ' : false}
                                      />
                                      {line.parent_id && items.find(i => String(i.id) === String(line.parent_id))?.has_children && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, paddingLeft: 8 }}>
                                          <span style={{ color: '#94a3b8', fontSize: 16 }}>↳</span>
                                          <div style={{ flex: 1, border: !line.item_id ? '1px solid #ef4444' : 'none', borderRadius: 6 }}>
                                            <Select
                                              value={String(line.item_id || '')}
                                              onChange={(val) => {
                                                const foundBrand = items.find(i => String(i.id) === String(val));
                                                if (!foundBrand) return;
                                                updateLine(idx, 'item_id', String(foundBrand.id));
                                                updateLine(idx, 'description', foundBrand.name);
                                                const price = Math.round((foundBrand.last_purchase_price || foundBrand.current_average_price || 0) * (foundBrand.conversion_ratio || 1));
                                                updateLine(idx, 'unit_price', String(price));
                                                updateLine(idx, 'purchase_unit', foundBrand.purchase_unit || '');
                                              }}
                                              options={[
                                                { value: '', label: 'Pilih Brand (Wajib)...' },
                                                ...items.filter(i => String(i.parent_id) === String(line.parent_id)).map(i => ({ value: String(i.id), label: i.name }))
                                              ]}
                                              searchable
                                              disabled={draftPO ? draftPO.status !== 'RFQ' : false}
                                            />
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                  <td style={{ padding: '6px 8px' }}>
                                    <input type="text" className="po-table-input transparent-input right" value={line.qty === '0' ? '' : (line.qty ? Number(line.qty).toLocaleString('id-ID') : '')} onChange={e => { const raw = e.target.value.replace(/\./g, ''); if (/^\d*$/.test(raw)) updateLine(idx, 'qty', raw); }} onFocus={e => e.target.select()} placeholder="0" />
                                  </td>
                                  <td className="center" style={{ padding: '8px 8px' }}>
                                    <div style={{ color: '#334155', fontWeight: 600, fontSize: 14 }}>
                                      {line.item_id ? ((items.find((i: any) => String(i.id) === line.item_id) as any)?.purchase_unit || (line as any).purchase_unit || '-') : ((line as any).purchase_unit || '-')}
                                    </div>
                                    {line.item_id && items.find(i => String(i.id) === line.item_id) && Number(items.find(i => String(i.id) === line.item_id)?.conversion_ratio) > 1 && (
                                      <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                                        Isi {Math.round(Number(items.find(i => String(i.id) === line.item_id)?.conversion_ratio))} {items.find(i => String(i.id) === line.item_id)?.smallest_unit}
                                      </div>
                                    )}
                                  </td>
                                  <td style={{ padding: '6px 8px' }}>
                                    <input type="text" className="po-table-input transparent-input right" value={line.unit_price === '0' ? '' : (line.unit_price ? Number(line.unit_price).toLocaleString('id-ID') : '')} onChange={e => { const raw = e.target.value.replace(/\./g, ''); if (/^\d*$/.test(raw)) updateLine(idx, 'unit_price', raw); }} onFocus={e => e.target.select()} placeholder="0" />
                                  </td>
                                  <td style={{ padding: '6px 8px' }}>
                                    <input type="text" className="po-table-input transparent-input right" value={line.tax_percent === '0' ? '' : (line.tax_percent ? Number(line.tax_percent).toLocaleString('id-ID') : '')} onChange={e => { const raw = e.target.value.replace(/\./g, ''); if (/^\d*$/.test(raw)) updateLine(idx, 'tax_percent', raw); }} onFocus={e => e.target.select()} placeholder="0" />
                                  </td>
                                  <td style={{ padding: '6px 8px' }}>
                                    <input type="text" className="po-table-input transparent-input right" value={line.disc_percent === '0' ? '' : (line.disc_percent ? Number(line.disc_percent).toLocaleString('id-ID') : '')} onChange={e => { const raw = e.target.value.replace(/\./g, ''); if (/^\d*$/.test(raw)) updateLine(idx, 'disc_percent', raw); }} onFocus={e => e.target.select()} placeholder="0" />
                                  </td>
                                  <td style={{ padding: '6px 8px' }}>
                                    <input
                                      type="text"
                                      className="po-table-input transparent-input right font-bold"
                                      value={(() => {
                                        const amt = (Number(line.qty) || 0) * (Number(line.unit_price) || 0) * (1 - (Number(line.disc_percent) || 0) / 100);
                                        return amt ? Math.round(amt).toLocaleString('id-ID') : '';
                                      })()}
                                      onChange={e => {
                                        const raw = e.target.value.replace(/\./g, '');
                                        if (/^\d*$/.test(raw)) {
                                          const amount = Number(raw) || 0;
                                          const qty = Number(line.qty) || 1; // hindari bagi nol
                                          const d = Number(line.disc_percent) || 0;
                                          const factor = qty * (1 - d / 100);
                                          const newUnitPrice = Math.round(factor > 0 ? amount / factor : 0);
                                          updateLine(idx, 'unit_price', String(newUnitPrice));
                                        }
                                      }}
                                      onFocus={e => e.target.select()}
                                      placeholder="0"
                                    />
                                  </td>
                                  <td className="center" style={{ padding: '6px 4px' }}>
                                    <button onClick={() => removeLine(idx)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}>
                                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>



                      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'flex-start', marginTop: 32 }}>
                        <div style={{ minWidth: 300 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, color: '#64748b' }}>
                            <span>Jumlah Sebelum Pajak:</span>
                            <span className="num">{fmtCurrency(computedSubtotal).replace(',00', '')}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, color: '#64748b' }}>
                            <span>Pajak:</span>
                            <span className="num">{fmtCurrency(computedTax).replace(',00', '')}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 16, borderTop: '1px solid var(--border)', fontSize: 18 }}>
                            <span style={{ fontWeight: 700, color: 'var(--primary)' }}>Total:</span>
                            <span className="num font-bold text-dark">{fmtCurrency(computedTotal).replace(',00', '')}</span>
                          </div>
                        </div>
                      </div>
                      </fieldset>
                    </div>
                  )}

                  {activeTab === 'Info Lainnya' && (
                    <div className="form-grid" style={{ columnGap: 60 }}>
                      <fieldset disabled={draftPO ? draftPO.status !== 'RFQ' : false} style={{ border: 'none', padding: 0, margin: 0, display: 'contents' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          <div style={{ width: 140, fontWeight: 600, fontSize: 13, color: '#475569' }}>Admin Pembelian</div>
                          <input className="input" value="Admin Pusat" disabled style={{ flex: 1 }} />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          <div style={{ width: 140, fontWeight: 600, fontSize: 13, color: '#475569' }}>Perusahaan</div>
                          <input className="input" value="Sunrise Daily Pusat" disabled style={{ flex: 1 }} />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          <div style={{ width: 140, fontWeight: 600, fontSize: 13, color: '#475569' }}>Dokumen Sumber</div>
                          <input className="input" placeholder="misal: OP/0001" style={{ flex: 1 }} />
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          <div style={{ width: 140, fontWeight: 600, fontSize: 13, color: '#475569' }}>Perjanjian</div>
                          <input className="input" style={{ flex: 1 }} />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          <div style={{ width: 140, fontWeight: 600, fontSize: 13, color: '#475569' }}>Ketentuan Pembayaran</div>
                          <select className="input" style={{ flex: 1 }} value={form.payment_terms} onChange={e => setForm(f => ({ ...f, payment_terms: e.target.value }))}>
                            <option value="">Pembayaran Langsung</option>
                            <option value="15 Days">15 Hari</option>
                            <option value="30 Days">30 Hari</option>
                          </select>
                        </div>
                      </div>
                      </fieldset>
                    </div>
                  )}
                </div>
              </fieldset>
            </div>
          </div>
        </div>
      )}

      {/* Email Modal */}
      <Modal isOpen={showEmailModal} onClose={() => !sendingEmail && setShowEmailModal(false)} title={pdfPreviewUrl ? "Tulis Email & Pratinjau" : "Tulis Email"} maxWidth={pdfPreviewUrl ? 1100 : 700}>
        <div style={{ padding: '16px 24px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 12 }}>
            <button className="btn btn-outline" onClick={() => setShowEmailModal(false)} disabled={sendingEmail}>Batal</button>
            <button className="btn btn-primary" onClick={handleSendEmail} disabled={sendingEmail}>
              {sendingEmail ? 'Mengirim...' : 'Kirim Email'}
              {!sendingEmail && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginLeft: 8 }}><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>}
            </button>
          </div>
        </div>
        <div className="modal-body" style={{ padding: '24px' }}>


          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            {/* Left: Email Form */}
            <div style={{ flex: 1, minWidth: 350, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="form-group">
                <label className="req">Ke (Email Vendor)</label>
                <input className="input" type="email" placeholder="vendor@example.com" value={emailForm.to} onChange={e => setEmailForm(f => ({ ...f, to: e.target.value }))} disabled={sendingEmail} />
              </div>

              <div className="form-group">
                <label className="req">Subjek</label>
                <input className="input" value={emailForm.subject} onChange={e => setEmailForm(f => ({ ...f, subject: e.target.value }))} disabled={sendingEmail} />
              </div>

              <div className="form-group">
                <label>Isi Pesan</label>
                <textarea className="input" value={emailForm.message} onChange={e => setEmailForm(f => ({ ...f, message: e.target.value }))} disabled={sendingEmail} style={{ resize: 'none', minHeight: '320px', lineHeight: '1.5' }} />
              </div>

              <div
                onClick={() => setPdfPreviewUrl(generatePDFBase64())}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, cursor: 'pointer', transition: 'all 0.2s' }}
                onMouseEnter={e => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.borderColor = '#cbd5e1'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.borderColor = '#e2e8f0'; }}
              >
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>{draftPO?.order_date ? new Date(draftPO.order_date).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-') : 'Purchase_Order'}.pdf</div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>Dokumen Terlampir &bull; Klik untuk pratinjau</div>
                </div>
                {!pdfPreviewUrl && (
                  <button className="btn btn-sm btn-outline" style={{ padding: '4px 8px', fontSize: 11 }} onClick={(e) => { e.stopPropagation(); setPdfPreviewUrl(generatePDFBase64()); }}>
                    Pratinjau
                  </button>
                )}
              </div>
            </div>

            {/* Right: PDF Preview */}
            {pdfPreviewUrl && (
              <div style={{ flex: 1, minWidth: 400, display: 'flex', flexDirection: 'column', animation: 'fadeIn 0.3s ease' }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 8 }}>Pratinjau PDF</label>
                <iframe src={pdfPreviewUrl} style={{ width: '100%', height: '540px', border: '1px solid #e2e8f0', borderRadius: 8, background: '#f1f5f9' }}></iframe>
              </div>
            )}
          </div>
        </div>
      </Modal>
    </section>
  );
}
