// Flat drawings of each cracker kind, in the page's inks. They stand in for product photos.
const S = "#c8241b", M = "#f29f05", T = "#f5c518", G = "#1d6b40", P = "#f4eee2", K = "#17120e";

const rays = (cx: number, cy: number, n: number, r0: number, r1: number, color: string, w = 4) =>
  Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return (
      <line key={i} x1={cx + Math.cos(a) * r0} y1={cy + Math.sin(a) * r0} x2={cx + Math.cos(a) * r1} y2={cy + Math.sin(a) * r1}
        stroke={color} strokeWidth={w} strokeLinecap="round" />
    );
  });

const art: Record<string, React.ReactNode> = {
  Sparklers: (
    <>
      <line x1="58" y1="170" x2="118" y2="74" stroke="#8a8178" strokeWidth="5" strokeLinecap="round" />
      <line x1="96" y1="110" x2="124" y2="64" stroke="#5b534c" strokeWidth="10" strokeLinecap="round" />
      {rays(128, 58, 14, 10, 44, T)}
      {rays(128, 58, 7, 16, 30, M, 3)}
      <circle cx="128" cy="58" r="8" fill={P} />
    </>
  ),
  "Flower Pots": (
    <>
      <path d="M70 178 L130 178 L114 104 L86 104 Z" fill={S} />
      <rect x="76" y="140" width="48" height="12" fill={P} />
      <rect x="92" y="96" width="16" height="10" fill={K} />
      {[-36, -22, -10, 0, 10, 22, 36].map((dx, i) => (
        <path key={i} d={`M100 94 Q${100 + dx * 0.6} ${40 - Math.abs(dx) * 0.4} ${100 + dx * 1.6} ${70 + Math.abs(dx)}`}
          fill="none" stroke={i % 2 ? T : P} strokeWidth="4" strokeLinecap="round" />
      ))}
    </>
  ),
  Chakras: (
    <>
      {rays(100, 110, 18, 46, 74, T)}
      <circle cx="100" cy="110" r="42" fill={M} />
      <circle cx="100" cy="110" r="30" fill={S} />
      <circle cx="100" cy="110" r="18" fill={G} />
      <circle cx="100" cy="110" r="6" fill={P} />
    </>
  ),
  Rockets: (
    <>
      <line x1="100" y1="96" x2="100" y2="184" stroke="#8a8178" strokeWidth="4" />
      <rect x="86" y="50" width="28" height="56" fill={S} />
      <rect x="86" y="70" width="28" height="8" fill={P} />
      <path d="M86 50 L100 22 L114 50 Z" fill={G} />
      {[-14, 0, 14].map((dx) => (
        <line key={dx} x1={100 + dx * 0.4} y1="112" x2={100 + dx} y2="146" stroke={T} strokeWidth="4" strokeLinecap="round" />
      ))}
    </>
  ),
  Bombs: (
    <>
      <circle cx="94" cy="122" r="46" fill={G} />
      <rect x="48" y="114" width="92" height="14" fill={P} />
      <path d="M118 84 Q134 62 150 66" fill="none" stroke="#8a8178" strokeWidth="4" />
      {rays(152, 62, 10, 6, 22, T, 3)}
    </>
  ),
  "Sky Shots": (
    <>
      <rect x="54" y="128" width="92" height="52" fill={S} />
      <rect x="54" y="146" width="92" height="10" fill={P} />
      {[66, 88, 110, 132].map((x) => <rect key={x} x={x - 6} y="118" width="12" height="12" fill={K} />)}
      {rays(70, 56, 10, 4, 24, T, 3)}
      {rays(132, 44, 10, 4, 22, M, 3)}
      {rays(104, 82, 8, 4, 16, P, 3)}
    </>
  ),
  Combos: (
    <>
      <rect x="44" y="92" width="112" height="86" fill={S} />
      <rect x="38" y="76" width="124" height="22" fill={M} />
      <rect x="92" y="76" width="16" height="102" fill={T} />
      <path d="M100 76 C78 46 58 60 74 76 Z M100 76 C122 46 142 60 126 76 Z" fill={T} />
    </>
  ),
};

export function Drawing({ category, className }: { category: string; className?: string }) {
  return (
    <svg viewBox="0 0 200 200" className={className} role="img" aria-label={`Drawing of ${category.toLowerCase()}`}>
      {art[category] ?? art.Combos}
    </svg>
  );
}
