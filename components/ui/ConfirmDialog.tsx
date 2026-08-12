import { useState, useEffect } from "react";
import { AlertTriangle } from "lucide-react";

/* ============================================================
   ConfirmDialog — modern Yes/No confirmation
   ============================================================ */
interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmText = "Yes",
  cancelText = "Cancel",
  danger = false,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (open) requestAnimationFrame(() => setShow(true));
    else setShow(false);
  }, [open]);

  if (!open) return null;

  const accent = danger ? "#c0392b" : "#016e3f";
  const accentSoft = danger ? "#fdeceb" : "#e6f3ec";

  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-4 transition-opacity duration-200"
      style={{ background: "rgba(12,20,16,0.55)", backdropFilter: "blur(3px)", opacity: show ? 1 : 0, zIndex: 99999 }}
      onClick={() => !loading && onCancel()}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[360px] rounded-2xl bg-white p-7 text-center transition-all duration-200 ease-out"
        style={{
          fontFamily: "'Albert Sans', sans-serif",
          boxShadow: "0 24px 60px -12px rgba(12,20,16,0.35)",
          transform: show ? "scale(1) translateY(0)" : "scale(0.94) translateY(6px)",
          opacity: show ? 1 : 0,
        }}
      >
        <style>{`
          @keyframes spin { 100% { transform: rotate(360deg); } }
        `}</style>
        <div
          className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full"
          style={{ background: accentSoft, boxShadow: `0 0 0 8px ${accentSoft}66` }}
        >
          <AlertTriangle size={24} style={{ color: accent }} strokeWidth={2.25} />
        </div>

        <h3 className="mb-2 text-[17px] font-bold" style={{ fontFamily: "'Cabin', sans-serif", color: "#12201a" }}>
          {title}
        </h3>
        <p className="mb-7 text-[13px] leading-relaxed" style={{ color: "#65786f", whiteSpace: "pre-line" }}>
          {message}
        </p>

        <div className="flex gap-2.5">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 rounded-xl px-4 py-2.5 text-[14px] font-semibold transition-all duration-200"
            style={{
              background: "#f1f5f9",
              color: "#334155",
              opacity: loading ? 0.6 : 1,
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 rounded-xl px-4 py-2.5 text-[14px] font-semibold text-white transition-all duration-200 hover:brightness-110 active:scale-95"
            style={{
              background: accent,
              boxShadow: `0 4px 12px ${accent}40`,
              opacity: loading ? 0.7 : 1,
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8
            }}
          >
            {loading && (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}>
                <line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
              </svg>
            )}
            {loading ? 'Memproses...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
