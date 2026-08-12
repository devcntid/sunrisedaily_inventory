import { useState, useEffect } from "react";

/* ============================================================
   Sunburst mark — small brand motif used by the loader
   ============================================================ */
function Sunburst({ size = 52, spin = false }: { size?: number, spin?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" className={spin ? "sun-spin" : ""}>
      {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
        <rect
          key={deg}
          x="18.5"
          y="1"
          width="3"
          height="9"
          rx="1.5"
          fill="#016e3f"
          transform={`rotate(${deg} 20 20)`}
          opacity={deg % 90 === 0 ? 1 : 0.55}
        />
      ))}
      <circle cx="20" cy="20" r="7" fill="#016e3f" />
    </svg>
  );
}

/* ============================================================
   FullScreenLoader — full-viewport "loading app data" state
   ============================================================ */

let globalProgress = 8;
let globalProgressLastUpdated = 0;

export function FullScreenLoader({ open, label = "Loading..." }: { open: boolean; label?: string }) {
  const [progress, setProgress] = useState(() => {
    if (Date.now() - globalProgressLastUpdated > 1000) {
      globalProgress = 8;
    }
    return globalProgress;
  });

  useEffect(() => {
    if (!open) {
      const reset = setTimeout(() => {
        setProgress(8);
        globalProgress = 8;
      }, 300);
      return () => clearTimeout(reset);
    }
    const t = setInterval(() => {
      setProgress((p) => {
        const next = p >= 92 ? 92 : p + Math.random() * 10;
        globalProgress = next;
        globalProgressLastUpdated = Date.now();
        return next;
      });
    }, 260);
    return () => clearInterval(t);
  }, [open]);

  if (!open) return null;

  return (
    <div
      style={{ 
        position: 'fixed',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: "#fbfdfc", 
        fontFamily: "'Albert Sans', sans-serif", 
        zIndex: 999999 
      }}
    >
      <style>{`
        @keyframes sunSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .sun-spin { animation: sunSpin 2.2s linear infinite; }
      `}</style>

      <Sunburst size={52} spin />
      <div style={{ marginTop: '20px', fontSize: '16px', fontWeight: 'bold', letterSpacing: '-0.025em', fontFamily: "'Cabin', sans-serif", color: "#12201a" }}>
        sunrise daily
      </div>
      <div style={{ marginTop: '4px', marginBottom: '32px', fontSize: '12px', color: "#8a9990" }}>
        Sistem Pengadaan &amp; Inventori Terpusat
      </div>

      <div style={{ height: '4px', width: '192px', overflow: 'hidden', borderRadius: '9999px', background: "#e6ece9" }}>
        <div
          style={{ height: '100%', borderRadius: '9999px', transition: 'all 0.3s ease-out', width: `${progress}%`, background: "#016e3f" }}
        />
      </div>
      <div style={{ marginTop: '12px', fontSize: '12px', fontWeight: 500, letterSpacing: '0.025em', color: "#65786f" }}>
        {label}
      </div>
    </div>
  );
}
