"use client";

import { useEffect, useRef } from "react";
import { motion, useMotionValue, useSpring } from "motion/react";
import { burst, reducedMotion } from "@/lib/fx";

type Spark = { x: number; y: number; vx: number; vy: number; life: number; hue: number };

/** Global Diwali layer: background fireworks, diya cursor + spark trail, click bursts. */
export default function Effects() {
  const sky = useRef<HTMLCanvasElement>(null);
  const trail = useRef<HTMLCanvasElement>(null);
  const cursor = useRef<HTMLDivElement>(null);
  const mx = useMotionValue(-100);
  const my = useMotionValue(-100);
  const x = useSpring(mx, { stiffness: 900, damping: 50 });
  const y = useSpring(my, { stiffness: 900, damping: 50 });

  // Background fireworks (lazy-loaded, gentle rate, fewer on mobile).
  useEffect(() => {
    if (reducedMotion() || !sky.current) return;
    let stop = () => {};
    const mobile = window.innerWidth < 768;
    const start = () =>
      import("@tsparticles/fireworks").then(async ({ fireworks }) => {
        const inst = await fireworks.create(sky.current, {
          background: "transparent",
          rate: mobile ? 0.25 : 0.5,
          speed: { min: 6, max: 12 },
          splitCount: mobile ? { min: 40, max: 60 } : { min: 60, max: 90 },
          colors: ["#ffd34d", "#ff9933", "#ff4d6d", "#c77dff", "#7cf3ff"],
          brightness: { min: 60, max: 80 },
          minHeight: { min: 10, max: 40 },
          sounds: false,
        });
        stop = () => inst?.destroy();
      });
    const id = "requestIdleCallback" in window ? requestIdleCallback(start) : setTimeout(start, 1500);
    return () => {
      if ("cancelIdleCallback" in window) cancelIdleCallback(id as number);
      stop();
    };
  }, []);

  // Cursor + trail + click bursts.
  useEffect(() => {
    if (reducedMotion()) return;
    const fine = window.matchMedia("(pointer: fine)").matches;
    const c = trail.current!;
    const ctx = c.getContext("2d")!;
    const sparks: Spark[] = [];
    let raf = 0;

    const resize = () => {
      c.width = window.innerWidth * devicePixelRatio;
      c.height = window.innerHeight * devicePixelRatio;
      ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    };
    resize();

    const tick = () => {
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.globalCompositeOperation = "lighter";
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.x += s.vx;
        s.y += s.vy;
        s.vy += 0.05;
        s.life -= 0.035;
        if (s.life <= 0) { sparks.splice(i, 1); continue; }
        ctx.fillStyle = `hsla(${s.hue}, 100%, 65%, ${s.life})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, 2.2 * s.life, 0, Math.PI * 2);
        ctx.fill();
      }
      raf = sparks.length ? requestAnimationFrame(tick) : 0;
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      mx.set(e.clientX);
      my.set(e.clientY);
      for (let i = 0; i < 2; i++)
        sparks.push({
          x: e.clientX, y: e.clientY,
          vx: (Math.random() - 0.5) * 1.6, vy: (Math.random() - 0.5) * 1.6 - 0.4,
          life: 1, hue: 30 + Math.random() * 30,
        });
      if (sparks.length > 160) sparks.splice(0, sparks.length - 160);
      if (!raf) raf = requestAnimationFrame(tick);
    };
    const onDown = (e: PointerEvent) => {
      // Buttons fire their own bigger bursts.
      if ((e.target as Element).closest("button, a, input, label, [role=dialog]")) return;
      burst(e.clientX, e.clientY, 16);
    };

    if (fine) document.body.classList.add("diya-cursor");
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onDown, { passive: true });
    window.addEventListener("resize", resize);
    return () => {
      document.body.classList.remove("diya-cursor");
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(raf);
    };
  }, [mx, my]);

  return (
    <>
      <canvas ref={sky} aria-hidden className="pointer-events-none fixed inset-0 -z-10 h-full w-full opacity-70" />
      <canvas ref={trail} aria-hidden className="pointer-events-none fixed inset-0 z-[90] h-full w-full" />
      <motion.div
        ref={cursor}
        aria-hidden
        style={{ x, y }}
        className="pointer-events-none fixed left-0 top-0 z-[91] hidden -translate-x-1/2 -translate-y-[85%] [@media(pointer:fine)]:block"
      >
        <div className="flame scale-75" />
      </motion.div>
    </>
  );
}
