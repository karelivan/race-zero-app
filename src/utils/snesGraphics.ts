// Pre-rendered 16-Bit SNES Pixel-Art Sprite & Mode-7 Tilemap Shader Generator
// Generates crisp, nearest-neighbor pixel-art hovercraft banking frames,
// 256x256 VRAM-style Mode 7 tilemaps, and per-scanline affine matrix perspective projection.

import { CraftSpec, TrackSpec } from '../types/game';

const spriteCache = new Map<string, HTMLCanvasElement>();
const tilemapCache = new Map<
  string,
  { canvas: HTMLCanvasElement; texels: Uint32Array; width: number; height: number }
>();

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const num = parseInt(clean, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function rgbToUint32(r: number, g: number, b: number, a = 255): number {
  // Little-endian ABGR for Uint32Array ImageData views
  return ((a & 255) << 24) | ((b & 255) << 16) | ((g & 255) << 8) | (r & 255);
}

function shadeColor(hex: string, factor: number): string {
  const [r, g, b] = hexToRgb(hex);
  // Quantize to 5-bit per channel (SNES 15-bit RGB555 color feel)
  const qr = Math.min(255, Math.max(0, Math.round((r * factor) / 8) * 8));
  const qg = Math.min(255, Math.max(0, Math.round((g * factor) / 8) * 8));
  const qb = Math.min(255, Math.max(0, Math.round((b * factor) / 8) * 8));
  return `rgb(${qr},${qg},${qb})`;
}

/**
 * Generates and caches a 256x256 16-bit SNES VRAM Tilemap for the Mode 7 ground shader.
 */
export function getMode7Tilemap(track: TrackSpec): {
  canvas: HTMLCanvasElement;
  texels: Uint32Array;
  width: number;
  height: number;
} {
  const cached = tilemapCache.get(track.id);
  if (cached) return cached;

  const size = 256; // 32x32 tiles of 8x8 pixels (authentic SNES Mode 7 tilemap dimensions)
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  const [gdR, gdG, gdB] = hexToRgb(track.palette.groundDark);
  const [glR, glG, glB] = hexToRgb(track.palette.groundLight);
  const [grR, grG, grB] = hexToRgb(track.palette.gridLine);
  const [acR, acG, acB] = hexToRgb(track.palette.sceneryAccent);
  const [hzR, hzG, hzB] = hexToRgb(track.palette.horizonGlow);

  const imgData = ctx.createImageData(size, size);
  const texels = new Uint32Array(imgData.data.buffer);

  const colDark = rgbToUint32(gdR, gdG, gdB);
  const colLight = rgbToUint32(glR, glG, glB);
  const colGrid = rgbToUint32(grR, grG, grB);
  const colAccent = rgbToUint32(acR, acG, acB);
  const colGlow = rgbToUint32(hzR, hzG, hzB);

  for (let y = 0; y < size; y++) {
    const tileY = y >> 4; // 16x16 macro-blocks
    const localY = y & 15;
    for (let x = 0; x < size; x++) {
      const tileX = x >> 4;
      const localX = x & 15;
      const idx = y * size + x;

      // Macro-checkerboard pattern with circuit-specific 16-bit architectural details
      const isChecker = ((tileX + tileY) & 1) === 0;

      // Outer 16x16 tile border grid lines (classic F-Zero Mode 7 metallic floor blocks)
      if (localX === 0 || localY === 0) {
        texels[idx] = colGrid;
        continue;
      }

      // Rivet / bevel highlights on tile corners
      if ((localX === 1 || localY === 1) && isChecker) {
        texels[idx] = colLight;
        continue;
      }

      // Sub-circuit conduits & glowing energy nodes inside specific tiles
      const tileHash = ((tileX * 73 + tileY * 37) & 15);
      if (tileHash === 0 && localX >= 5 && localX <= 10 && localY >= 5 && localY <= 10) {
        if (localX === 7 || localX === 8 || localY === 7 || localY === 8) {
          texels[idx] = colAccent;
        } else {
          texels[idx] = colGlow;
        }
        continue;
      }

      // Diagonal tech hatch or dithered texture inside alternating blocks
      if (tileHash === 3 && ((localX + localY) & 3) === 0) {
        texels[idx] = colGrid;
        continue;
      }

      // Base 16-bit dithered surface
      if (isChecker) {
        texels[idx] = (x + y) % 2 === 0 ? colLight : colDark;
      } else {
        texels[idx] = colDark;
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);
  const entry = { canvas, texels, width: size, height: size };
  tilemapCache.set(track.id, entry);
  return entry;
}

/**
 * Generates a crisp 64x38 16-bit pixel-art hovercraft sprite for a specific banking frame (-3 to +3)
 * and thruster animation phase (0 or 1).
 */
export function getSnesCraftSprite(
  hullStyle: CraftSpec['hullStyle'],
  primaryHex: string,
  secondaryHex: string,
  cockpitHex: string,
  thrusterHex: string,
  bankFrame: number, // -3..+3
  flamePhase: number, // 0 or 1
  isBoosting: boolean
): HTMLCanvasElement {
  const clampedBank = Math.max(-3, Math.min(3, Math.round(bankFrame)));
  const key = `${hullStyle}_${primaryHex}_${secondaryHex}_${cockpitHex}_${thrusterHex}_${clampedBank}_${flamePhase}_${isBoosting ? 1 : 0}`;
  const cached = spriteCache.get(key);
  if (cached) return cached;

  const w = 64;
  const h = 38;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  const cDark = shadeColor(primaryHex, 0.45);
  const cMid = shadeColor(primaryHex, 0.85);
  const cBright = shadeColor(primaryHex, 1.18);
  const cSpec = shadeColor(secondaryHex, 1.3);
  const cTrim = shadeColor(secondaryHex, 0.9);
  const cGlassDark = shadeColor(cockpitHex, 0.55);
  const cGlassMid = shadeColor(cockpitHex, 1.0);
  const cGlassHi = '#FFFFFF';

  const px = (x: number, y: number, pw: number, ph: number, col: string) => {
    ctx.fillStyle = col;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(pw), Math.round(ph));
  };

  // 1. SNES Checkerboard Dithered Hover Shadow on Road Surface
  ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
  for (let sy = 30; sy < 36; sy++) {
    const halfSpan = sy === 30 || sy === 35 ? 16 : 23;
    for (let sx = 32 - halfSpan; sx <= 32 + halfSpan; sx++) {
      if ((sx + sy) % 2 === 0) {
        ctx.fillRect(sx + clampedBank, sy, 1, 1);
      }
    }
  }

  const leftWingDrop = -clampedBank * 1.4;
  const rightWingDrop = clampedBank * 1.4;
  const leftSpan = Math.round(25 - clampedBank * 1.8);
  const rightSpan = Math.round(25 + clampedBank * 1.8);
  const centerShift = clampedBank * 1.2;
  const cx = Math.round(32 + centerShift);

  // 2. Draw Pixel-Art Hull Scanline by Scanline (rows y = 6 to 25)
  for (let y = 6; y <= 25; y++) {
    const t = (y - 6) / 19;
    let lSpan = Math.round(t * leftSpan);
    let rSpan = Math.round(t * rightSpan);

    if (hullStyle === 'HEAVY_TWIN' && t < 0.35) {
      lSpan = Math.round((0.28 + t * 0.8) * leftSpan);
      rSpan = Math.round((0.28 + t * 0.8) * rightSpan);
    } else if (hullStyle === 'NEEDLE') {
      lSpan = Math.round(Math.pow(t, 1.35) * leftSpan);
      rSpan = Math.round(Math.pow(t, 1.35) * rightSpan);
    }

    const rowLeftX = cx - lSpan;
    const rowRightX = cx + rSpan;

    for (let x = rowLeftX; x <= rowRightX; x++) {
      const relX = x - cx;
      const normSide = relX < 0 ? relX / Math.max(1, lSpan) : relX / Math.max(1, rSpan);
      const yOffset = Math.round(
        relX < 0 ? Math.abs(normSide) * leftWingDrop : Math.abs(normSide) * rightWingDrop
      );
      const py = y + yOffset;

      if (hullStyle === 'HEAVY_TWIN' && t < 0.28 && Math.abs(relX) < 3) {
        continue;
      }

      if (x === rowLeftX || x === rowRightX || y === 6 || y === 25) {
        px(x, py, 1, 1, '#090D16');
        continue;
      }

      if (Math.abs(normSide) > 0.76 && Math.abs(normSide) < 0.9) {
        px(x, py, 1, 1, cTrim);
        continue;
      }

      const lightBias = normSide + clampedBank * 0.12;
      if (lightBias < -0.35) {
        px(x, py, 1, 1, cDark);
      } else if (lightBias < 0.25) {
        px(x, py, 1, 1, cMid);
      } else if (lightBias < 0.62) {
        px(x, py, 1, 1, cBright);
      } else {
        px(x, py, 1, 1, (x + y) % 2 === 0 ? cSpec : cBright);
      }
    }
  }

  // 3. Draw 16-Bit Pixel Canopy & Specular Glass Highlight
  for (let y = 10; y <= 20; y++) {
    const ct = (y - 10) / 10;
    const halfCanopy = Math.max(2, Math.round(Math.sin(ct * Math.PI) * 6));
    for (let x = cx - halfCanopy; x <= cx + halfCanopy; x++) {
      const dx = x - cx;
      if (Math.abs(dx) === halfCanopy || y === 10 || y === 20) {
        px(x, y, 1, 1, '#0F172A');
      } else if (dx === -halfCanopy + 2 && y >= 12 && y <= 16) {
        px(x, y, 1, 1, cGlassHi);
      } else if (dx < 0) {
        px(x, y, 1, 1, cGlassMid);
      } else {
        px(x, y, 1, 1, cGlassDark);
      }
    }
  }

  // 4. Rear Engine Cowling & Metallic Grilles
  px(cx - 14, 23, 28, 4, '#0F172A');
  px(cx - 12, 24, 24, 2, '#334155');

  // 5. Dual / Quad Plasma Thruster Nozzles & Animated Afterburner Plumes
  const nozzleOffsets =
    hullStyle === 'HEAVY_TWIN'
      ? [-13, -5, 5, 13]
      : hullStyle === 'NEEDLE'
      ? [-6, 0, 6]
      : [-9, 9];

  const coreCol = isBoosting ? '#FFFFFF' : '#FEF08A';
  const midFlameCol = isBoosting ? '#F59E0B' : thrusterHex;
  const outerFlameCol = isBoosting ? '#EF4444' : shadeColor(thrusterHex, 0.7);
  const plumeLen = isBoosting ? (flamePhase === 0 ? 9 : 11) : flamePhase === 0 ? 4 : 6;

  nozzleOffsets.forEach((nx) => {
    const tx = cx + nx;
    const ty = 25 + Math.round((nx / 15) * rightWingDrop);

    px(tx - 3, ty - 1, 6, 3, '#1E293B');
    px(tx - 3, ty + 1, 6, plumeLen, outerFlameCol);
    px(tx - 2, ty + 1, 4, Math.max(2, plumeLen - 2), midFlameCol);
    px(tx - 1, ty + 1, 2, Math.max(1, plumeLen - 3), coreCol);
  });

  spriteCache.set(key, canvas);
  return canvas;
}
