import confetti from "canvas-confetti";

const COLORS = ["#ffd34d", "#ff9933", "#ff4d6d", "#ffffff", "#c77dff", "#7cf3ff"];

export const reducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Small spark burst at a screen point (px). */
export function burst(x: number, y: number, count = 22) {
  if (reducedMotion()) return;
  confetti({
    particleCount: count,
    spread: 360,
    startVelocity: 16,
    gravity: 0.7,
    decay: 0.9,
    ticks: 60,
    scalar: 0.55,
    shapes: ["star", "circle"],
    colors: COLORS,
    origin: { x: x / window.innerWidth, y: y / window.innerHeight },
    zIndex: 80,
  });
}

/** Burst from the centre of an element (buttons). */
export const burstFrom = (el: Element | null, count?: number) => {
  if (!el) return;
  const r = el.getBoundingClientRect();
  burst(r.left + r.width / 2, r.top + r.height / 2, count);
};

/** Big multi-shell finale for placing an order (~1.6s). */
export function finale() {
  if (reducedMotion()) return;
  const shell = (x: number, y: number) =>
    confetti({
      particleCount: 90,
      spread: 360,
      startVelocity: 32,
      gravity: 0.8,
      ticks: 110,
      scalar: 0.8,
      shapes: ["star", "circle"],
      colors: COLORS,
      origin: { x, y },
      zIndex: 80,
    });
  [[0.5, 0.35], [0.25, 0.3], [0.75, 0.3], [0.4, 0.2], [0.6, 0.25]].forEach(([x, y], i) =>
    setTimeout(() => shell(x, y), i * 280),
  );
}
