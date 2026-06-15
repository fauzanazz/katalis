function SvgButterfly({
  className,
  wingColor,
  accentColor,
}: {
  className?: string;
  wingColor: string;
  accentColor: string;
}) {
  return (
    <svg
      viewBox="0 0 60 50"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Left wings */}
      <ellipse cx="18" cy="16" rx="16" ry="12" fill={wingColor} opacity="0.92" />
      <ellipse cx="13" cy="32" rx="11" ry="9" fill={accentColor} opacity="0.88" />
      {/* Right wings */}
      <ellipse cx="42" cy="16" rx="16" ry="12" fill={wingColor} opacity="0.92" />
      <ellipse cx="47" cy="32" rx="11" ry="9" fill={accentColor} opacity="0.88" />
      {/* Body */}
      <ellipse cx="30" cy="24" rx="3" ry="12" fill="#5a3060" />
      {/* Antennae */}
      <line x1="29" y1="12" x2="22" y2="3" stroke="#5a3060" strokeWidth="1.4" strokeLinecap="round" />
      <line x1="31" y1="12" x2="38" y2="3" stroke="#5a3060" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="22" cy="3" r="2" fill="#5a3060" />
      <circle cx="38" cy="3" r="2" fill="#5a3060" />
    </svg>
  );
}

export function DiscoverIdleScene() {
  return (
    <div className="relative overflow-hidden rounded-3xl shadow-sm">
      <img
        src="/images/discover/garden-scene.webp"
        alt=""
        className="w-full object-cover"
        aria-hidden="true"
      />

      {/* Animated SVG butterflies overlay */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <style>{`
          @keyframes dg-flutter-a {
            0%, 100% { transform: translate(0, 0) rotate(-6deg); }
            35% { transform: translate(14px, -20px) rotate(5deg); }
            65% { transform: translate(-8px, -30px) rotate(9deg); }
          }
          @keyframes dg-flutter-b {
            0%, 100% { transform: translate(0, 0) rotate(7deg); }
            40% { transform: translate(-16px, -24px) rotate(-4deg); }
            70% { transform: translate(10px, -16px) rotate(14deg); }
          }
          @keyframes dg-flutter-c {
            0%, 100% { transform: translate(0, 0) rotate(-3deg) scale(1); }
            50% { transform: translate(6px, -14px) rotate(8deg) scale(0.95); }
          }
          .dg-b1 { animation: dg-flutter-a 4.8s ease-in-out infinite; }
          .dg-b2 { animation: dg-flutter-b 6.2s ease-in-out infinite 1.3s; }
          .dg-b3 { animation: dg-flutter-c 3.9s ease-in-out infinite 0.7s; }
        `}</style>

        <SvgButterfly
          wingColor="#e3a8d2"
          accentColor="#f3d5e9"
          className="dg-b1 absolute left-[10%] top-[6%] size-12 drop-shadow-sm"
        />
        <SvgButterfly
          wingColor="#f7ce4f"
          accentColor="#f3b835"
          className="dg-b2 absolute right-[16%] top-[4%] size-9 drop-shadow-sm"
        />
        <SvgButterfly
          wingColor="#91c2b3"
          accentColor="#70a5f5"
          className="dg-b3 absolute right-[38%] top-[10%] size-7 drop-shadow-sm"
        />
      </div>
    </div>
  );
}
