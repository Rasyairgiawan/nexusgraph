'use client';

import React, { useEffect, useRef } from 'react';

interface GalaxyParticle {
  arm: number;
  baseRadiusRatio: number;
  angleOffset: number;
  angularSpeed: number;
  size: number;
  baseAlpha: number;
  twinkleSpeed: number;
  twinklePhase: number;
  colorRgb: string;
  hasGlow: boolean;
  isStarCross: boolean;
}

const COSMIC_PALETTE_RGB = [
  '255, 255, 255', // Pure Starlight White
  '147, 197, 253', // Luminous Sky Blue
  '96, 165, 250',  // Nexus Electric Blue
  '165, 180, 252', // Cosmic Indigo
  '192, 132, 252', // Nebula Violet
  '56, 189, 248',  // Cyan Dust
];

function seededRandom(index: number): number {
  const x = Math.sin(index * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function createGalaxyParticles(count = 270): GalaxyParticle[] {
  const particles: GalaxyParticle[] = [];
  for (let i = 0; i < count; i++) {
    const r1 = seededRandom(i * 7 + 1);
    const r2 = seededRandom(i * 7 + 2);
    const r3 = seededRandom(i * 7 + 3);
    const r4 = seededRandom(i * 7 + 4);
    const r5 = seededRandom(i * 7 + 5);

    const isSpiralArm = i < Math.floor(count * 0.72);
    const arm = i % 2;
    const radiusRatio = 0.04 + Math.pow(r1, 0.82) * 0.68;

    const spiralTwist = radiusRatio * 4.8;
    const armBaseAngle = arm * Math.PI + spiralTwist;
    const scatter = isSpiralArm ? (r2 - 0.5) * 0.82 : r2 * Math.PI * 2;

    const angularSpeed = (0.032 + (1 - radiusRatio) * 0.068) * (0.78 + r3 * 0.45);
    const size = 0.9 + Math.pow(r4, 2.0) * 2.9;
    const baseAlpha = 0.45 + r5 * 0.52;
    const colorRgb = COSMIC_PALETTE_RGB[i % COSMIC_PALETTE_RGB.length];

    particles.push({
      arm,
      baseRadiusRatio: radiusRatio,
      angleOffset: armBaseAngle + scatter,
      angularSpeed,
      size,
      baseAlpha,
      twinkleSpeed: 1.0 + r3 * 1.8,
      twinklePhase: r4 * Math.PI * 2,
      colorRgb,
      hasGlow: size > 1.85,
      isStarCross: size > 2.5 && i % 6 === 0,
    });
  }
  return particles;
}

const GALAXY_PARTICLES = createGalaxyParticles(270);

export function GalaxyBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    let width = 0;
    let height = 0;
    let dpr = 1;
    let rafId = 0;

    const syncSize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      width = parent.clientWidth;
      height = parent.clientHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    syncSize();
    const ro = new ResizeObserver(syncSize);
    if (canvas.parentElement) {
      ro.observe(canvas.parentElement);
    }

    const startTime = performance.now();

    const drawFrame = (now: number) => {
      const elapsedSec = (now - startTime) / 1000;
      const cx = width / 2;
      const cy = height / 2;
      const maxRadius = Math.hypot(cx, cy);

      ctx.clearRect(0, 0, width, height);

      // Deep midnight space background gradient
      const bgGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(maxRadius, 1));
      bgGrad.addColorStop(0, '#0E1C47');
      bgGrad.addColorStop(0.45, '#08112D');
      bgGrad.addColorStop(1, '#040816');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // Galactic core bloom around center hub
      const coreGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxRadius * 0.34);
      coreGlow.addColorStop(0, 'rgba(59, 130, 246, 0.28)');
      coreGlow.addColorStop(0.5, 'rgba(99, 102, 241, 0.14)');
      coreGlow.addColorStop(1, 'rgba(15, 23, 42, 0)');
      ctx.fillStyle = coreGlow;
      ctx.fillRect(0, 0, width, height);

      // Swirling translucent nebula clouds
      const orb1X = cx + Math.cos(elapsedSec * 0.08) * (width * 0.18);
      const orb1Y = cy + Math.sin(elapsedSec * 0.065) * (height * 0.16);
      const nebula1 = ctx.createRadialGradient(orb1X, orb1Y, 0, orb1X, orb1Y, maxRadius * 0.44);
      nebula1.addColorStop(0, 'rgba(56, 189, 248, 0.15)');
      nebula1.addColorStop(0.55, 'rgba(37, 99, 235, 0.07)');
      nebula1.addColorStop(1, 'rgba(4, 8, 22, 0)');
      ctx.fillStyle = nebula1;
      ctx.fillRect(0, 0, width, height);

      const orb2X = cx - Math.cos(elapsedSec * 0.06) * (width * 0.2);
      const orb2Y = cy - Math.sin(elapsedSec * 0.075) * (height * 0.18);
      const nebula2 = ctx.createRadialGradient(orb2X, orb2Y, 0, orb2X, orb2Y, maxRadius * 0.42);
      nebula2.addColorStop(0, 'rgba(167, 139, 250, 0.16)');
      nebula2.addColorStop(0.55, 'rgba(99, 102, 241, 0.07)');
      nebula2.addColorStop(1, 'rgba(4, 8, 22, 0)');
      ctx.fillStyle = nebula2;
      ctx.fillRect(0, 0, width, height);

      // Orbiting galaxy particles & glowing starlight
      const coords: Array<{ x: number; y: number; alpha: number }> = [];

      for (let i = 0; i < GALAXY_PARTICLES.length; i++) {
        const p = GALAXY_PARTICLES[i];
        const angle = p.angleOffset + elapsedSec * p.angularSpeed;
        const rx = maxRadius * p.baseRadiusRatio * 1.1;
        const ry = maxRadius * p.baseRadiusRatio * 0.86;
        const x = cx + Math.cos(angle) * rx;
        const y = cy + Math.sin(angle) * ry;

        const twinkle = 0.65 + 0.35 * Math.sin(elapsedSec * p.twinkleSpeed + p.twinklePhase);
        const alpha = p.baseAlpha * twinkle;
        coords.push({ x, y, alpha });

        if (p.hasGlow) {
          ctx.fillStyle = `rgba(${p.colorRgb}, ${(alpha * 0.22).toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(x, y, p.size * 2.8, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.fillStyle = `rgba(${p.colorRgb}, ${alpha.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(x, y, p.size, 0, Math.PI * 2);
        ctx.fill();

        if (p.isStarCross) {
          ctx.strokeStyle = `rgba(${p.colorRgb}, ${(alpha * 0.72).toFixed(3)})`;
          ctx.lineWidth = 0.9;
          const armLen = p.size * 2.8;
          ctx.beginPath();
          ctx.moveTo(x - armLen, y);
          ctx.lineTo(x + armLen, y);
          ctx.moveTo(x, y - armLen);
          ctx.lineTo(x, y + armLen);
          ctx.stroke();
        }
      }

      // Subtle glowing filaments between close spiral stars
      ctx.lineWidth = 0.75;
      const maxLinkDist = 92;
      for (let i = 0; i < coords.length; i += 2) {
        const a = coords[i];
        for (let j = i + 1; j < Math.min(i + 14, coords.length); j++) {
          const b = coords[j];
          const d = Math.hypot(b.x - a.x, b.y - a.y);
          if (d < maxLinkDist) {
            const lineAlpha = (1 - d / maxLinkDist) * 0.2;
            ctx.strokeStyle = `rgba(147, 197, 253, ${lineAlpha.toFixed(3)})`;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }

      if (!reducedMotion) {
        rafId = requestAnimationFrame(drawFrame);
      }
    };

    rafId = requestAnimationFrame(drawFrame);

    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-0 h-full w-full select-none"
    />
  );
}
