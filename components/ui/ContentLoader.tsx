'use client';
import { useState, useEffect } from "react";

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

export function ContentLoader({ label = "Memuat data..." }: { label?: string }) {
  const [progress, setProgress] = useState(8);

  useEffect(() => {
    const t = setInterval(() => {
      setProgress((p) => {
        return p >= 92 ? 92 : p + Math.random() * 10;
      });
    }, 260);
    return () => clearInterval(t);
  }, []);

  return (
    <div
      className="flex flex-col items-center justify-center min-h-[70vh] rounded-xl"
      style={{ background: "transparent", fontFamily: "'Albert Sans', sans-serif" }}
    >
      <style>{`
        @keyframes sunSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .sun-spin { animation: sunSpin 2.2s linear infinite; }
      `}</style>

      <Sunburst size={48} spin />
      
      <div className="mt-4 text-[15px] font-bold tracking-tight" style={{ fontFamily: "'Cabin', sans-serif", color: "#12201a" }}>
        sunrise daily
      </div>
      <div className="mt-1 mb-6 text-[11px]" style={{ color: "#8a9990" }}>
        Procurement & Inventory
      </div>

      <div className="h-1 w-40 overflow-hidden rounded-full" style={{ background: "#e6ece9" }}>
        <div
          className="h-full rounded-full transition-all duration-300 ease-out"
          style={{ width: `${progress}%`, background: "#016e3f" }}
        />
      </div>
      <div className="mt-3 text-[11px] font-medium tracking-wide" style={{ color: "#65786f" }}>
        {label}
      </div>
    </div>
  );
}
