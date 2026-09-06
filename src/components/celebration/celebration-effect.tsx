"use client";

/**
 * Age-band celebration overlay effects.
 *
 * Rendered on top of the study-session completion overlay. The `style` prop
 * maps directly from AgeBandUIConfig.celebrationStyle — components never
 * check the age band directly.
 *
 * confetti — canvas-based particle burst (junior)
 * sparkle  — CSS radial particles (intermediate)
 * pulse    — no extra element; CSS handles the icon animation (senior)
 * subtle   — no extra element; CSS fade-in (university)
 * none     — nothing rendered (adult)
 *
 * All canvas operations respect prefers-reduced-motion and bail out early.
 */

import { useEffect, useRef } from "react";

export type CelebrationStyle = "confetti" | "sparkle" | "pulse" | "subtle" | "none";

// ---------------------------------------------------------------------------
// Confetti (junior)
// ---------------------------------------------------------------------------

const CONFETTI_COLORS = [
  "#7c3aed", "#c4b5fd",  // violet
  "#0e7490", "#67e8f9",  // teal
  "#c2410c", "#fbbf24",  // orange / amber
  "#16a34a", "#a3e635",  // green
];

interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  color: string;
  w: number; h: number;
  rot: number; rotV: number;
  grav: number;
}

function spawnParticles(cx: number, cy: number, count: number): Particle[] {
  return Array.from({ length: count }, () => {
    const angle = -Math.PI * 0.5 + (Math.random() - 0.5) * Math.PI * 1.7;
    const speed = 5 + Math.random() * 10;
    return {
      x: cx, y: cy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      w: 7 + Math.random() * 8,
      h: 3 + Math.random() * 5,
      rot: Math.random() * 360,
      rotV: (Math.random() - 0.5) * 15,
      grav: 0.18 + Math.random() * 0.15,
    };
  });
}

function ConfettiBurst() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.clientWidth || 600;
    const H = canvas.clientHeight || 500;
    canvas.width = W;
    canvas.height = H;

    const particles = spawnParticles(W * 0.5, H * 0.38, 60);

    let rafId: number;
    const TOTAL = 115;
    let frame = 0;

    function tick() {
      ctx!.clearRect(0, 0, W, H);
      for (const p of particles) {
        ctx!.save();
        ctx!.globalAlpha = Math.max(0, 1 - frame / TOTAL);
        ctx!.translate(p.x, p.y);
        ctx!.rotate((p.rot * Math.PI) / 180);
        ctx!.fillStyle = p.color;
        ctx!.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx!.restore();
        p.x += p.vx;
        p.y += p.vy;
        p.vy += p.grav;
        p.vx *= 0.985;
        p.rot += p.rotV;
      }
      frame++;
      if (frame < TOTAL + 12) rafId = requestAnimationFrame(tick);
    }

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 w-full h-full"
      aria-hidden="true"
    />
  );
}

// ---------------------------------------------------------------------------
// Sparkle (intermediate)
// ---------------------------------------------------------------------------

const SPARKLE_COUNT = 12;

function SparkleBurst() {
  return (
    <div
      className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden"
      aria-hidden="true"
    >
      {Array.from({ length: SPARKLE_COUNT }, (_, i) => (
        <div
          key={i}
          className="pace-sparkle-particle absolute w-2.5 h-2.5 rounded-full bg-primary"
          style={{
            "--sparkle-angle": `${i * (360 / SPARKLE_COUNT)}deg`,
            "--sparkle-delay": `${(i * 0.04).toFixed(2)}s`,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Public component
// ---------------------------------------------------------------------------

export function CelebrationEffect({ style }: { style: CelebrationStyle }) {
  if (style === "confetti") return <ConfettiBurst />;
  if (style === "sparkle") return <SparkleBurst />;
  return null;
}
