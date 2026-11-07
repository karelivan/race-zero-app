import React, { useEffect, useRef } from 'react';
import { CraftSpec } from '../types/game';
import { getSnesCraftSprite } from '../utils/snesGraphics';

interface CraftPreviewSvgProps {
  craft: CraftSpec;
  className?: string;
}

export const CraftPreviewSvg: React.FC<CraftPreviewSvgProps> = ({
  craft,
  className = 'w-full h-36',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let animId: number;
    const render = (now: number) => {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.imageSmoothingEnabled = false;
          const w = canvas.width;
          const h = canvas.height;

          // SNES Mode-7 Hangar Floor Background
          ctx.fillStyle = '#070B14';
          ctx.fillRect(0, 0, w, h);

          // Banded 16-bit horizon gradient
          const bands = ['#090E1A', '#0F172A', '#1E293B', '#334155'];
          bands.forEach((col, i) => {
            ctx.fillStyle = col;
            ctx.fillRect(0, i * 10, w, 10);
          });

          // Perspective Mode-7 Hangar Grid Lines
          ctx.fillStyle = '#0B1324';
          ctx.fillRect(0, 40, w, h - 40);

          ctx.strokeStyle = '#1E293B';
          ctx.lineWidth = 1;
          for (let y = 42; y < h; y += Math.max(2, Math.floor((y - 38) * 0.28))) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
            ctx.stroke();
          }
          for (let x = -60; x <= w + 60; x += 24) {
            ctx.beginPath();
            ctx.moveTo(w / 2 + (x - w / 2) * 0.25, 40);
            ctx.lineTo(x, h);
            ctx.stroke();
          }

          // Smoothly cycle through banking frames (-2 to +2) and thruster phase
          const bankFrame = Math.round(Math.sin(now * 0.0022) * 2.3);
          const flamePhase = Math.floor(now / 70) % 2;
          const hoverY = Math.round(Math.sin(now * 0.006) * 2);

          const sprite = getSnesCraftSprite(
            craft.hullStyle,
            craft.primaryColor,
            craft.secondaryColor,
            craft.cockpitColor,
            craft.thrusterColor,
            bankFrame,
            flamePhase,
            false
          );

          const scale = 2.2;
          const sw = Math.round(sprite.width * scale);
          const sh = Math.round(sprite.height * scale);
          ctx.drawImage(
            sprite,
            Math.round((w - sw) / 2),
            Math.round((h - sh) / 2 + 8 + hoverY),
            sw,
            sh
          );
        }
      }
      animId = requestAnimationFrame(render);
    };
    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [craft]);

  return (
    <canvas
      ref={canvasRef}
      width={200}
      height={110}
      style={{ imageRendering: 'pixelated' }}
      className={`${className} rounded-lg border border-slate-800`}
      aria-label={`Sprite 16-bit de ${craft.name}`}
    />
  );
};
