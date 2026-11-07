import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Flame,
  Pause,
  Play,
  RotateCcw,
  Trophy,
  AlertTriangle,
  Zap,
  ChevronRight,
  Flag,
} from 'lucide-react';
import {
  CompetitorResult,
  CraftSpec,
  GameMode,
  GhostSample,
  SceneryType,
  TrackRecord,
  TrackSpec,
  UserSettings,
} from '../types/game';
import { AI_RIVALS, SEGMENT_LENGTH } from '../data/craftsAndTracks';
import { formatRaceTime } from '../utils/storage';
import { soundEngine } from '../audio/soundEngine';
import { getMode7Tilemap, getSnesCraftSprite } from '../utils/snesGraphics';

interface RaceCanvasProps {
  craft: CraftSpec;
  track: TrackSpec;
  mode: GameMode;
  settings: UserSettings;
  existingRecord?: TrackRecord;
  gpRoundIndex: number;
  gpTotalRounds: number;
  onFinishRace: (
    results: CompetitorResult[],
    playerBestLapMs: number,
    playerTotalMs: number,
    ghostSamples: GhostSample[],
    playerDestroyed: boolean
  ) => void;
  onExitToMenu: () => void;
}

interface AICompetitor {
  id: string;
  name: string;
  craftName: string;
  primaryColor: string;
  hullStyle: CraftSpec['hullStyle'];
  z: number;
  x: number;
  speed: number;
  baseMaxSpeed: number;
  lap: number;
  finished: boolean;
  totalTimeMs: number;
  bestLapMs: number;
  steer: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  life: number;
  maxLife: number;
}

interface InputState {
  left: boolean;
  right: boolean;
  accelerate: boolean;
  brake: boolean;
  strafeLeft: boolean;
  strafeRight: boolean;
  boost: boolean;
}

const HULL_TYPES: CraftSpec['hullStyle'][] = ['DELTA', 'HEAVY_TWIN', 'NEEDLE', 'SOLAR_WING'];

export const RaceCanvas: React.FC<RaceCanvasProps> = ({
  craft,
  track,
  mode,
  settings,
  existingRecord,
  gpRoundIndex,
  gpTotalRounds,
  onFinishRace,
  onExitToMenu,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const minimapRef = useRef<HTMLCanvasElement | null>(null);

  const [hudState, setHudState] = useState({
    speedKmh: 0,
    energy: 100,
    lap: 1,
    totalLaps: track.laps,
    rank: 1,
    totalRacers: mode === 'TIME_TRIAL' ? 1 : 8,
    currentLapMs: 0,
    bestLapMs: 0,
    totalRaceMs: 0,
    countdown: 3,
    isBoosting: false,
    isRecharging: false,
    isAirborne: false,
    boostUnlocked: false,
    statusBanner: '' as string,
  });

  const [isPaused, setIsPaused] = useState(false);
  const [racePhase, setRacePhase] = useState<'COUNTDOWN' | 'RACING' | 'FINISHED' | 'DESTROYED'>('COUNTDOWN');
  const [finalResults, setFinalResults] = useState<CompetitorResult[] | null>(null);
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  const inputRef = useRef<InputState>({
    left: false,
    right: false,
    accelerate: false,
    brake: false,
    strafeLeft: false,
    strafeRight: false,
    boost: false,
  });

  const simRef = useRef({
    z: 0,
    playerX: 0,
    speed: 0,
    energy: 100,
    lap: 1,
    lapStartTimeMs: 0,
    elapsedRaceMs: 0,
    bestLapMs: Infinity,
    lapTimes: [] as number[],
    boostTimerMs: 0,
    jumpY: 0,
    jumpVy: 0,
    steerAngle: 0,
    headingAngle: 0,
    strafeVel: 0,
    skyOffset: 0,
    shakeIntensity: 0,
    countdownTimerMs: 3200,
    lastCountdownInt: 4,
    rechargeTickCooldown: 0,
    collisionCooldown: 0,
    ghostRecording: [] as GhostSample[],
    lastGhostSampleMs: 0,
    particles: [] as Particle[],
    rivals: [] as AICompetitor[],
  });

  useEffect(() => {
    const hasTouch =
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0 ||
      window.matchMedia('(pointer: coarse)').matches;
    setIsTouchDevice(hasTouch);
  }, []);

  const initSimulation = useCallback(() => {
    const totalTrackLength = track.segments.length * SEGMENT_LENGTH;
    const rivals: AICompetitor[] = [];

    if (mode !== 'TIME_TRIAL') {
      AI_RIVALS.forEach((rival, idx) => {
        const startOffsetZ = ((idx + 1) * 260) % totalTrackLength;
        const laneX = idx % 2 === 0 ? -0.42 : 0.42;
        const skillFactor = 0.87 + idx * 0.021;
        rivals.push({
          id: rival.id,
          name: rival.name,
          craftName: rival.craftName,
          primaryColor: rival.primaryColor,
          hullStyle: HULL_TYPES[idx % HULL_TYPES.length],
          z: startOffsetZ,
          x: laneX,
          speed: 0,
          baseMaxSpeed: 1350 * skillFactor,
          lap: 1,
          finished: false,
          totalTimeMs: 0,
          bestLapMs: Math.round(33500 / skillFactor),
          steer: 0,
        });
      });
    }

    simRef.current = {
      z: 0,
      playerX: 0,
      speed: 0,
      energy: 100,
      lap: 1,
      lapStartTimeMs: 0,
      elapsedRaceMs: 0,
      bestLapMs: Infinity,
      lapTimes: [],
      boostTimerMs: 0,
      jumpY: 0,
      jumpVy: 0,
      steerAngle: 0,
      headingAngle: 0,
      strafeVel: 0,
      skyOffset: 0,
      shakeIntensity: 0,
      countdownTimerMs: 3200,
      lastCountdownInt: 4,
      rechargeTickCooldown: 0,
      collisionCooldown: 0,
      ghostRecording: [],
      lastGhostSampleMs: 0,
      particles: [],
      rivals,
    };

    setRacePhase('COUNTDOWN');
    setFinalResults(null);
    setIsPaused(false);
    setHudState({
      speedKmh: 0,
      energy: 100,
      lap: 1,
      totalLaps: track.laps,
      rank: mode === 'TIME_TRIAL' ? 1 : 8,
      totalRacers: mode === 'TIME_TRIAL' ? 1 : 8,
      currentLapMs: 0,
      bestLapMs: 0,
      totalRaceMs: 0,
      countdown: 3,
      isBoosting: false,
      isRecharging: false,
      isAirborne: false,
      boostUnlocked: false,
      statusBanner: 'SISTEMA MODE-7 16-BIT LISTO',
    });

    soundEngine.configure(settings.soundEnabled, settings.musicVolume, settings.sfxVolume);
    soundEngine.startEngine();
  }, [track, mode, settings]);

  useEffect(() => {
    initSimulation();
    return () => {
      soundEngine.stopEngine();
      soundEngine.stopMusic();
    };
  }, [initSimulation]);

  // Keyboard Listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
        setIsPaused((prev) => {
          if (racePhase === 'RACING' || racePhase === 'COUNTDOWN') {
            return !prev;
          }
          return prev;
        });
        return;
      }

      switch (e.code) {
        case 'ArrowLeft':
        case 'KeyA':
          inputRef.current.left = true;
          break;
        case 'ArrowRight':
        case 'KeyD':
          inputRef.current.right = true;
          break;
        case 'ArrowUp':
        case 'KeyW':
          e.preventDefault();
          inputRef.current.accelerate = true;
          break;
        case 'ArrowDown':
        case 'KeyS':
          e.preventDefault();
          inputRef.current.brake = true;
          break;
        case 'KeyQ':
        case 'KeyZ':
          inputRef.current.strafeLeft = true;
          break;
        case 'KeyE':
        case 'KeyC':
          inputRef.current.strafeRight = true;
          break;
        case 'Space':
        case 'ShiftLeft':
        case 'ShiftRight':
        case 'KeyX':
          e.preventDefault();
          inputRef.current.boost = true;
          break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'ArrowLeft':
        case 'KeyA':
          inputRef.current.left = false;
          break;
        case 'ArrowRight':
        case 'KeyD':
          inputRef.current.right = false;
          break;
        case 'ArrowUp':
        case 'KeyW':
          inputRef.current.accelerate = false;
          break;
        case 'ArrowDown':
        case 'KeyS':
          inputRef.current.brake = false;
          break;
        case 'KeyQ':
        case 'KeyZ':
          inputRef.current.strafeLeft = false;
          break;
        case 'KeyE':
        case 'KeyC':
          inputRef.current.strafeRight = false;
          break;
        case 'Space':
        case 'ShiftLeft':
        case 'ShiftRight':
        case 'KeyX':
          inputRef.current.boost = false;
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [racePhase]);

  const spawnParticles = (x: number, y: number, color: string, count: number, spread = 3) => {
    const s = simRef.current;
    for (let i = 0; i < count; i++) {
      s.particles.push({
        x: Math.round(x),
        y: Math.round(y),
        vx: (Math.random() - 0.5) * spread * 2.2,
        vy: (Math.random() - 0.35) * spread * 1.8,
        color,
        size: 2 + Math.floor(Math.random() * 2),
        life: 0,
        maxLife: 12 + Math.random() * 12,
      });
    }
  };

  const concludeRace = useCallback(
    (destroyed: boolean) => {
      soundEngine.stopEngine();
      soundEngine.stopMusic();
      const s = simRef.current;
      const totalTrackLength = track.segments.length * SEGMENT_LENGTH;

      const pointsTable = [25, 18, 15, 12, 10, 8, 6, 4];
      const allCompetitors: CompetitorResult[] = [];

      allCompetitors.push({
        id: 'player',
        name: craft.pilot,
        craftName: craft.name,
        craftId: craft.id,
        primaryColor: craft.primaryColor,
        isPlayer: true,
        totalTimeMs: destroyed ? 999999 : Math.round(s.elapsedRaceMs),
        bestLapMs: Number.isFinite(s.bestLapMs)
          ? Math.round(s.bestLapMs)
          : Math.round(s.elapsedRaceMs / track.laps),
        points: 0,
        status: destroyed ? 'DESTROYED' : 'FINISHED',
      });

      s.rivals.forEach((rival) => {
        const progressZ = (rival.lap - 1) * totalTrackLength + rival.z;
        const targetZ = track.laps * totalTrackLength;
        const remainingZ = Math.max(0, targetZ - progressZ);
        const estimatedMs = rival.finished
          ? rival.totalTimeMs
          : Math.round(s.elapsedRaceMs + (remainingZ / Math.max(600, rival.baseMaxSpeed)) * 1000);

        allCompetitors.push({
          id: rival.id,
          name: rival.name,
          craftName: rival.craftName,
          craftId: rival.id,
          primaryColor: rival.primaryColor,
          isPlayer: false,
          totalTimeMs: estimatedMs,
          bestLapMs: rival.bestLapMs,
          points: 0,
          status: 'FINISHED',
        });
      });

      allCompetitors.sort((a, b) => {
        if (a.status !== b.status) return a.status === 'FINISHED' ? -1 : 1;
        return a.totalTimeMs - b.totalTimeMs;
      });

      allCompetitors.forEach((comp, idx) => {
        comp.points = comp.status === 'FINISHED' ? pointsTable[idx] ?? 2 : 0;
      });

      setFinalResults(allCompetitors);
      setRacePhase(destroyed ? 'DESTROYED' : 'FINISHED');
      onFinishRace(
        allCompetitors,
        Number.isFinite(s.bestLapMs) ? Math.round(s.bestLapMs) : Math.round(s.elapsedRaceMs),
        Math.round(s.elapsedRaceMs),
        s.ghostRecording,
        destroyed
      );
    },
    [craft, track, onFinishRace]
  );

  // =========================================================================
  // MAIN 60 FPS SIMULATION & ADVANCED SNES MODE-7 PIXEL RENDERING LOOP
  // =========================================================================
  useEffect(() => {
    let animationFrameId: number;
    let lastTime = performance.now();
    let hudUpdateCounter = 0;

    const totalSegments = track.segments.length;
    const totalTrackLength = totalSegments * SEGMENT_LENGTH;

    // Pre-allocate SNES Mode 7 Scanline Perspective Distortion Shader Buffers (426x240)
    const mode7Tilemap = getMode7Tilemap(track);
    const mode7Offscreen = document.createElement('canvas');
    mode7Offscreen.width = 426;
    mode7Offscreen.height = 240;
    const mode7Ctx = mode7Offscreen.getContext('2d')!;
    mode7Ctx.imageSmoothingEnabled = false;
    const mode7ImgData = mode7Ctx.createImageData(426, 240);
    const mode7Pixels = new Uint32Array(mode7ImgData.data.buffer);

    /**
     * SNES PPU Mode 7 Scanline Perspective Distortion Shader
     * Computes per-scanline 2x2 affine transformation matrix registers [M7A, M7B, M7C, M7D]
     * and applies a custom Canvas 2D transformation matrix to the track background layer.
     */
    const renderMode7GroundShader = (
      ctx: CanvasRenderingContext2D,
      width: number,
      height: number,
      horizonY: number,
      camX: number,
      camZ: number,
      camAltitude: number,
      headingRad: number,
      bankAngle: number,
      isBoosting: boolean
    ) => {
      const clampedHorizon = Math.max(0, Math.min(height - 2, horizonY));
      const cosTheta = Math.cos(headingRad);
      const sinTheta = Math.sin(headingRad);
      const texels = mode7Tilemap.texels;
      const halfW = width * 0.5;
      const focalScale = camAltitude * 0.36;

      // Per-scanline HDMA updates to SNES Mode 7 registers (M7A, M7B, M7C, M7D)
      for (let y = clampedHorizon; y < height; y++) {
        const scanlineDist = Math.max(2, y - clampedHorizon + 4);
        const lambda = focalScale / scanlineDist; // 1 / Z perspective scaling factor

        // 2x2 Affine Transformation Matrix coefficients for scanline y
        const m7A = lambda * cosTheta;
        const m7B = lambda * sinTheta;
        const m7C = -lambda * sinTheta;
        const m7D = lambda * cosTheta;

        // Project scanline center point in world-space tilemap coordinates
        const forwardDist = lambda * 145;
        const baseU = camX + forwardDist * sinTheta - halfW * m7A;
        const baseV = camZ + forwardDist * cosTheta - halfW * m7C;

        let u = baseU;
        let v = baseV;
        const rowOffset = y * width;

        for (let x = 0; x < width; x++) {
          const tu = u & 255;
          const tv = v & 255;
          mode7Pixels[rowOffset + x] = texels[(tv << 8) + tu];
          u += m7A;
          v += m7C;
        }
      }

      mode7Ctx.putImageData(
        mode7ImgData,
        0,
        0,
        0,
        clampedHorizon,
        width,
        height - clampedHorizon
      );

      // Apply custom 2D Affine Transformation Matrix to the track background layer
      // Simulates hardware Mode 7 horizon banking, lateral shear, and Hyper-Boost radial zoom
      ctx.save();
      const pivotX = width * 0.5;
      const pivotY = clampedHorizon;
      const rollRad = -bankAngle * 0.045;
      const cosR = Math.cos(rollRad);
      const sinR = Math.sin(rollRad);
      const scaleX = isBoosting ? 1.045 : 1.015;
      const scaleY = isBoosting ? 1.035 : 1.0;
      const shearX = -bankAngle * 0.06;

      // Custom matrix [a, b, c, d, e, f] centered at the horizon vanishing point
      const ma = cosR * scaleX;
      const mb = sinR * scaleY;
      const mc = -sinR * scaleX + shearX;
      const md = cosR * scaleY;
      const me = pivotX - ma * pivotX - mc * pivotY;
      const mf = pivotY - mb * pivotX - md * pivotY;

      ctx.transform(ma, mb, mc, md, me, mf);
      ctx.drawImage(
        mode7Offscreen,
        0,
        clampedHorizon,
        width,
        height - clampedHorizon,
        0,
        clampedHorizon,
        width,
        height - clampedHorizon
      );
      ctx.restore();
    };

    const readGamepad = () => {
      if (typeof navigator === 'undefined' || !navigator.getGamepads) return null;
      const pads = navigator.getGamepads();
      for (const pad of pads) {
        if (pad && pad.connected) {
          const axisX = pad.axes[0] ?? 0;
          const dpadLeft = pad.buttons[14]?.pressed ?? false;
          const dpadRight = pad.buttons[15]?.pressed ?? false;
          const accelBtn = (pad.buttons[0]?.pressed || pad.buttons[7]?.pressed) ?? false;
          const brakeBtn = (pad.buttons[1]?.pressed || pad.buttons[6]?.pressed) ?? false;
          const boostBtn = (pad.buttons[2]?.pressed || pad.buttons[3]?.pressed) ?? false;
          const strafeL = pad.buttons[4]?.pressed ?? false;
          const strafeR = pad.buttons[5]?.pressed ?? false;
          return {
            steer: Math.abs(axisX) > 0.15 ? axisX : dpadLeft ? -1 : dpadRight ? 1 : 0,
            accelerate: accelBtn,
            brake: brakeBtn,
            boost: boostBtn,
            strafeLeft: strafeL,
            strafeRight: strafeR,
          };
        }
      }
      return null;
    };

    const drawPixelCraft = (
      ctx: CanvasRenderingContext2D,
      cx: number,
      cy: number,
      scale: number,
      hullStyle: CraftSpec['hullStyle'],
      primary: string,
      secondary: string,
      cockpit: string,
      thruster: string,
      bankAngle: number,
      flamePhase: number,
      isBoosting: boolean,
      isGhost = false
    ) => {
      const bankFrame = Math.max(-3, Math.min(3, Math.round(bankAngle * 3)));
      const sprite = getSnesCraftSprite(
        hullStyle,
        primary,
        secondary,
        cockpit,
        thruster,
        bankFrame,
        flamePhase,
        isBoosting
      );

      const drawW = Math.max(8, Math.round(sprite.width * scale));
      const drawH = Math.max(5, Math.round(sprite.height * scale));
      const dx = Math.round(cx - drawW / 2);
      const dy = Math.round(cy - drawH * 0.72);

      if (isGhost) {
        ctx.save();
        ctx.globalAlpha = 0.52;
        ctx.drawImage(sprite, dx, dy, drawW, drawH);
        ctx.restore();
      } else {
        ctx.drawImage(sprite, dx, dy, drawW, drawH);
      }
    };

    const draw16BitScenery = (
      ctx: CanvasRenderingContext2D,
      type: SceneryType,
      sx: number,
      sy: number,
      scale: number,
      accentColor: string,
      side: 'LEFT' | 'RIGHT',
      roadHalfWidth: number,
      animTick: number
    ) => {
      if (type === 'NONE') return;
      const rx = Math.round(sx);
      const ry = Math.round(sy);

      if (type === 'START_BANNER' && side === 'LEFT') {
        const pillarH = Math.max(8, Math.round(105 * scale));
        const pillarW = Math.max(2, Math.round(10 * scale));
        const leftX = rx;
        const rightX = Math.round(rx + roadHalfWidth * 2.3);

        // 16-bit Metallic Gantry Towers
        ctx.fillStyle = '#475569';
        ctx.fillRect(leftX - pillarW, ry - pillarH, pillarW, pillarH);
        ctx.fillRect(rightX, ry - pillarH, pillarW, pillarH);
        ctx.fillStyle = '#E2E8F0';
        ctx.fillRect(leftX - Math.ceil(pillarW * 0.6), ry - pillarH, Math.ceil(pillarW * 0.3), pillarH);
        ctx.fillRect(rightX + Math.floor(pillarW * 0.2), ry - pillarH, Math.ceil(pillarW * 0.3), pillarH);

        // Overhead Checkered Archway with Flashing SNES Lights
        const bannerH = Math.max(4, Math.round(18 * scale));
        const totalSpan = rightX - leftX + pillarW * 2;
        ctx.fillStyle = '#0F172A';
        ctx.fillRect(leftX - pillarW, ry - pillarH, totalSpan, bannerH);

        // Pixel Checkers on Banner
        const numBlocks = 10;
        const blockW = Math.max(2, Math.floor(totalSpan / numBlocks));
        for (let b = 0; b < numBlocks; b++) {
          ctx.fillStyle = (b + animTick) % 2 === 0 ? '#F59E0B' : '#F8FAFC';
          ctx.fillRect(
            leftX - pillarW + b * blockW,
            ry - pillarH + 2,
            blockW - 1,
            Math.max(2, bannerH - 4)
          );
        }
      } else if (type === 'NEON_PILLAR' || type === 'SOLAR_TOWER') {
        const w = Math.max(2, Math.round(14 * scale));
        const h = Math.max(6, Math.round(92 * scale));
        ctx.fillStyle = '#0F172A';
        ctx.fillRect(rx - Math.floor(w / 2) - 1, ry - h - 1, w + 2, h + 1);
        ctx.fillStyle = '#334155';
        ctx.fillRect(rx - Math.floor(w / 2), ry - h, w, h);
        // Animated Neon Core Strip
        ctx.fillStyle = animTick % 2 === 0 ? accentColor : '#F8FAFC';
        ctx.fillRect(
          rx - Math.max(1, Math.floor(w * 0.2)),
          ry - Math.floor(h * 0.9),
          Math.max(1, Math.floor(w * 0.4)),
          Math.floor(h * 0.75)
        );
      } else if (type === 'CRYO_CRYSTAL') {
        const w = Math.max(3, Math.round(24 * scale));
        const h = Math.max(6, Math.round(80 * scale));
        // Stepped 16-bit crystal obelisk
        ctx.fillStyle = accentColor;
        ctx.fillRect(rx - Math.floor(w * 0.4), ry - Math.floor(h * 0.6), Math.floor(w * 0.8), Math.floor(h * 0.6));
        ctx.fillStyle = '#E0F2FE';
        ctx.fillRect(rx - Math.floor(w * 0.2), ry - h, Math.floor(w * 0.4), h);
      } else if (type === 'GRANDSTAND') {
        const w = Math.max(6, Math.round(48 * scale));
        const h = Math.max(5, Math.round(52 * scale));
        ctx.fillStyle = '#1E293B';
        ctx.fillRect(rx - Math.floor(w / 2), ry - h, w, h);
        ctx.fillStyle = '#F59E0B';
        ctx.fillRect(rx - Math.floor(w * 0.45), ry - Math.floor(h * 0.82), Math.floor(w * 0.9), Math.max(2, Math.floor(h * 0.2)));
      } else if (type === 'CHEVRON_SIGN') {
        const size = Math.max(4, Math.round(22 * scale));
        ctx.fillStyle = '#090D16';
        ctx.fillRect(rx - Math.floor(size / 2), ry - Math.floor(size * 1.4), size, size);
        ctx.fillStyle = animTick % 2 === 0 ? '#F59E0B' : '#EF4444';
        ctx.fillRect(
          rx - Math.floor(size * 0.35),
          ry - Math.floor(size * 1.25),
          Math.floor(size * 0.7),
          Math.floor(size * 0.7)
        );
      }
    };

    const renderMinimap = () => {
      const mCanvas = minimapRef.current;
      if (!mCanvas) return;
      const mCtx = mCanvas.getContext('2d');
      if (!mCtx) return;

      mCtx.imageSmoothingEnabled = false;
      const mw = mCanvas.width;
      const mh = mCanvas.height;
      mCtx.clearRect(0, 0, mw, mh);

      const path = track.minimapPath;
      if (path.length < 2) return;

      mCtx.strokeStyle = '#334155';
      mCtx.lineWidth = 5;
      mCtx.lineCap = 'square';
      mCtx.lineJoin = 'miter';
      mCtx.beginPath();
      path.forEach((pt, idx) => {
        if (idx === 0) mCtx.moveTo(pt.x * mw, pt.y * mh);
        else mCtx.lineTo(pt.x * mw, pt.y * mh);
      });
      mCtx.closePath();
      mCtx.stroke();

      mCtx.strokeStyle = '#94A3B8';
      mCtx.lineWidth = 1.5;
      mCtx.stroke();

      const startPt = path[0];
      mCtx.fillStyle = '#F8FAFC';
      mCtx.fillRect(Math.round(startPt.x * mw - 3), Math.round(startPt.y * mh - 3), 6, 6);

      const s = simRef.current;
      s.rivals.forEach((rival) => {
        const normProgress =
          (((rival.z % totalTrackLength) + totalTrackLength) % totalTrackLength) / totalTrackLength;
        const idx = Math.floor(normProgress * path.length) % path.length;
        const pt = path[idx];
        mCtx.fillStyle = rival.primaryColor;
        mCtx.fillRect(Math.round(pt.x * mw - 2), Math.round(pt.y * mh - 2), 5, 5);
      });

      const playerNorm =
        (((s.z % totalTrackLength) + totalTrackLength) % totalTrackLength) / totalTrackLength;
      const pIdx = Math.floor(playerNorm * path.length) % path.length;
      const pPt = path[pIdx];
      mCtx.fillStyle = '#F59E0B';
      mCtx.fillRect(Math.round(pPt.x * mw - 3), Math.round(pPt.y * mh - 3), 7, 7);
      mCtx.strokeStyle = '#FFFFFF';
      mCtx.strokeRect(Math.round(pPt.x * mw - 3), Math.round(pPt.y * mh - 3), 7, 7);
    };

    const step = (now: number) => {
      const dtMs = Math.min(40, Math.max(4, now - lastTime));
      const dt = dtMs / 1000;
      lastTime = now;

      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.imageSmoothingEnabled = false;
          const width = canvas.width; // 426 (Authentic 16-bit Widescreen Pixel Resolution)
          const height = canvas.height; // 240 (Authentic SNES 240p Scanline Resolution)
          const s = simRef.current;
          const animTick = Math.floor(now / 90);
          const flamePhase = Math.floor(now / 55) % 2;

          if (!isPaused && (racePhase === 'COUNTDOWN' || racePhase === 'RACING')) {
            if (racePhase === 'COUNTDOWN') {
              s.countdownTimerMs -= dtMs;
              const secLeft = Math.ceil(s.countdownTimerMs / 1000);
              if (secLeft !== s.lastCountdownInt && secLeft >= 0 && secLeft <= 3) {
                s.lastCountdownInt = secLeft;
                soundEngine.playCountdownTone(secLeft === 0);
              }
              if (s.countdownTimerMs <= 0) {
                setRacePhase('RACING');
                soundEngine.startMusic(track.musicTheme);
              }
            } else if (racePhase === 'RACING') {
              const gp = readGamepad();
              const inp = inputRef.current;

              const steerDir =
                gp && Math.abs(gp.steer) > 0.1
                  ? gp.steer
                  : (inp.left ? -1 : 0) + (inp.right ? 1 : 0);
              const wantAccel = inp.accelerate || (gp?.accelerate ?? false);
              const wantBrake = inp.brake || (gp?.brake ?? false);
              const wantStrafeL = inp.strafeLeft || (gp?.strafeLeft ?? false);
              const wantStrafeR = inp.strafeRight || (gp?.strafeRight ?? false);
              const wantBoost = inp.boost || (gp?.boost ?? false);

              s.elapsedRaceMs += dtMs;
              const currentSegIdx =
                Math.floor(
                  (((s.z % totalTrackLength) + totalTrackLength) % totalTrackLength) / SEGMENT_LENGTH
                ) % totalSegments;
              const currentSeg = track.segments[currentSegIdx];

              // Trigger Hyper-Boost
              if (wantBoost && s.boostTimerMs <= 0 && s.energy > 20) {
                s.boostTimerMs = 1550;
                s.energy = Math.max(5, s.energy - 16);
                s.shakeIntensity = 4;
                soundEngine.playBoostIgnite();
                spawnParticles(width / 2, height * 0.82, '#F59E0B', 16, 4);
              }

              if (s.boostTimerMs > 0) {
                s.boostTimerMs = Math.max(0, s.boostTimerMs - dtMs);
              }

              // Track Surface Interactions
              let isRechargingNow = false;
              if (s.jumpY <= 2) {
                if (currentSeg.surface === 'RECHARGE_PIT' && Math.abs(s.playerX) < 0.92) {
                  isRechargingNow = true;
                  s.energy = Math.min(100, s.energy + 28 * dt);
                  s.rechargeTickCooldown -= dtMs;
                  if (s.rechargeTickCooldown <= 0) {
                    soundEngine.playRechargeTick(s.energy);
                    s.rechargeTickCooldown = 115;
                  }
                } else if (currentSeg.surface === 'BOOST_PAD' && Math.abs(s.playerX) < 0.85) {
                  if (s.boostTimerMs < 600) {
                    s.boostTimerMs = 900;
                    soundEngine.playBoostIgnite();
                  }
                } else if (currentSeg.surface === 'JUMP_PAD' && s.jumpVy <= 0 && s.speed > 450) {
                  s.jumpVy = 540 + (s.speed / 1500) * 280;
                  soundEngine.playJumpLaunch();
                }
              }

              // Jump Physics
              if (s.jumpY > 0 || s.jumpVy > 0) {
                s.jumpY += s.jumpVy * dt;
                s.jumpVy -= 1180 * dt;
                if (s.jumpY <= 0) {
                  s.jumpY = 0;
                  s.jumpVy = 0;
                  s.shakeIntensity = 3;
                  spawnParticles(width / 2, height * 0.82, '#38BDF8', 10, 3);
                }
              }

              // Longitudinal Speed Physics
              const isBoosting = s.boostTimerMs > 0;
              const targetMaxSpeed =
                craft.physics.maxSpeedKmh * (isBoosting ? craft.physics.boostMultiplier : 1.0);

              if (wantAccel || isBoosting) {
                const accel = (isBoosting ? 1150 : 620) * craft.physics.accelRate;
                s.speed = Math.min(targetMaxSpeed, s.speed + accel * dt);
              } else if (wantBrake) {
                s.speed = Math.max(0, s.speed - 980 * dt);
              } else {
                s.speed = Math.max(0, s.speed - 290 * dt);
              }

              if (!isBoosting && s.speed > craft.physics.maxSpeedKmh) {
                s.speed = Math.max(craft.physics.maxSpeedKmh, s.speed - 540 * dt);
              }

              // Steering, Strafe & Centrifugal Force
              const speedRatio = s.speed / craft.physics.maxSpeedKmh;
              const steerStrength =
                1.95 * craft.physics.strafeSpeed * Math.min(1, 0.35 + speedRatio * 0.85);
              const strafeDelta =
                ((wantStrafeL ? -1 : 0) + (wantStrafeR ? 1 : 0)) * 1.15 * craft.physics.strafeSpeed;

              s.steerAngle +=
                (steerDir + (wantStrafeR ? 0.5 : wantStrafeL ? -0.5 : 0) - s.steerAngle) * 10 * dt;

              const centrifugalPull =
                (currentSeg.curve * speedRatio * speedRatio * 0.44) /
                craft.physics.centrifugalResist;

              s.playerX += (steerDir * steerStrength + strafeDelta - centrifugalPull) * dt;
              s.headingAngle =
                (s.headingAngle + (currentSeg.curve * 0.48 + steerDir * 0.22) * speedRatio * dt) %
                (Math.PI * 2);
              s.skyOffset = (s.skyOffset + currentSeg.curve * speedRatio * 36 * dt) % width;

              // Guardrail Collision
              if (Math.abs(s.playerX) > 1.02 && s.jumpY < 25) {
                const sign = Math.sign(s.playerX);
                s.playerX = sign * 0.98;
                s.speed *= 0.82;
                const dmg = (14 * dt * 60 * 0.18) / craft.physics.shieldArmor;
                s.energy = Math.max(0, s.energy - dmg);
                s.shakeIntensity = 5;

                s.collisionCooldown -= dtMs;
                if (s.collisionCooldown <= 0) {
                  soundEngine.playCollisionImpact();
                  spawnParticles(width / 2 + sign * 28, height * 0.8, '#FACC15', 14, 4);
                  s.collisionCooldown = 150;
                }
              }

              // Advance Z
              const prevZ = s.z;
              const zAdvance = s.speed * 5.2 * dt;
              s.z += zAdvance;

              // Check Lap Completion
              const prevLapIndex = Math.floor(prevZ / totalTrackLength);
              const newLapIndex = Math.floor(s.z / totalTrackLength);
              if (newLapIndex > prevLapIndex) {
                const completedLapMs = s.elapsedRaceMs - s.lapStartTimeMs;
                s.lapTimes.push(completedLapMs);
                if (completedLapMs < s.bestLapMs) {
                  s.bestLapMs = completedLapMs;
                }
                s.lapStartTimeMs = s.elapsedRaceMs;

                if (newLapIndex >= track.laps) {
                  soundEngine.playLapFanfare(true);
                  concludeRace(false);
                  return;
                } else {
                  s.lap = newLapIndex + 1;
                  soundEngine.playLapFanfare(false);
                }
              }

              // Record Ghost Sample
              if (s.elapsedRaceMs - s.lastGhostSampleMs >= 120 && s.ghostRecording.length < 2500) {
                s.ghostRecording.push({
                  timeMs: Math.round(s.elapsedRaceMs),
                  trackZ: Math.round(s.z),
                  playerX: Number(s.playerX.toFixed(3)),
                  jumpY: Math.round(s.jumpY),
                  steer: Number(s.steerAngle.toFixed(2)),
                });
                s.lastGhostSampleMs = s.elapsedRaceMs;
              }

              // Update AI Rivals
              s.rivals.forEach((rival, idx) => {
                if (rival.finished) return;
                const distBehindPlayer = s.z - ((rival.lap - 1) * totalTrackLength + rival.z);
                const rubberBand =
                  distBehindPlayer > 3500 ? 1.09 : distBehindPlayer < -3500 ? 0.93 : 1.0;

                const targetAiSpeed = rival.baseMaxSpeed * rubberBand;
                rival.speed += (targetAiSpeed - rival.speed) * 2.2 * dt;

                const aiAdvance = rival.speed * 5.2 * dt;
                const oldRivalZ = rival.z;
                rival.z = (rival.z + aiAdvance) % totalTrackLength;
                if (rival.z < oldRivalZ) {
                  rival.lap += 1;
                  if (rival.lap > track.laps) {
                    rival.finished = true;
                    rival.totalTimeMs = Math.round(s.elapsedRaceMs);
                  }
                }

                const targetLane = Math.sin(s.elapsedRaceMs * 0.0012 + idx * 1.7) * 0.58;
                const laneDiff = targetLane - rival.x;
                rival.x += laneDiff * 1.8 * dt;
                rival.steer = Math.max(-1, Math.min(1, laneDiff * 2.5));

                const playerModZ = ((s.z % totalTrackLength) + totalTrackLength) % totalTrackLength;
                const dz = Math.abs(playerModZ - rival.z);
                const dx = Math.abs(s.playerX - rival.x);
                if (dz < 170 && dx < 0.28 && s.jumpY < 30) {
                  const pushDir = s.playerX >= rival.x ? 1 : -1;
                  s.playerX += pushDir * 0.14;
                  rival.x -= pushDir * 0.14;
                  s.speed *= 0.93;
                  s.energy = Math.max(0, s.energy - 3.5 / craft.physics.shieldArmor);
                  s.shakeIntensity = 4;
                  soundEngine.playCollisionImpact();
                  spawnParticles(width / 2, height * 0.78, '#F59E0B', 10, 3);
                }
              });

              if (s.energy <= 0) {
                soundEngine.playExplosion();
                spawnParticles(width / 2, height * 0.78, '#EF4444', 38, 6);
                spawnParticles(width / 2, height * 0.78, '#F59E0B', 30, 5);
                concludeRace(true);
                return;
              }

              soundEngine.updateEngine(
                s.speed,
                craft.physics.maxSpeedKmh,
                isBoosting,
                s.jumpY > 5,
                s.energy
              );

              hudUpdateCounter++;
              if (hudUpdateCounter % 4 === 0) {
                let rank = 1;
                s.rivals.forEach((rival) => {
                  const rivalTotalZ = (rival.lap - 1) * totalTrackLength + rival.z;
                  if (rivalTotalZ > s.z) rank++;
                });

                let banner = '';
                if (s.energy < 22) banner = '¡ALERTA! ESCUDO CRÍTICO · ENTRA AL PIT LANE';
                else if (isRechargingNow) banner = 'RECARGANDO ENERGÍA DE PLASMA';
                else if (isBoosting) banner = 'HYPER-BOOST 16-BIT ACTIVO';

                setHudState({
                  speedKmh: Math.round(s.speed),
                  energy: Math.round(s.energy),
                  lap: Math.min(track.laps, s.lap),
                  totalLaps: track.laps,
                  rank,
                  totalRacers: mode === 'TIME_TRIAL' ? 1 : 8,
                  currentLapMs: Math.round(s.elapsedRaceMs - s.lapStartTimeMs),
                  bestLapMs: Number.isFinite(s.bestLapMs) ? Math.round(s.bestLapMs) : 0,
                  totalRaceMs: Math.round(s.elapsedRaceMs),
                  countdown: -1,
                  isBoosting,
                  isRecharging: isRechargingNow,
                  isAirborne: s.jumpY > 8,
                  boostUnlocked: s.energy > 20,
                  statusBanner: banner,
                });
              }
            } else {
              const secLeft = Math.max(0, Math.ceil(s.countdownTimerMs / 1000));
              if (secLeft !== hudState.countdown) {
                setHudState((prev) => ({
                  ...prev,
                  countdown: secLeft,
                  statusBanner: secLeft > 0 ? `SALIDA EN ${secLeft}...` : '¡PROPULSORES AL MÁXIMO!',
                }));
              }
            }
          }

          // =========================================================================
          // 16-BIT SNES HDMA SKY, PARALLAX CITYSCAPE & MODE-7 SCANLINE RENDERER
          // =========================================================================
          ctx.save();
          if (settings.cameraShake && s.shakeIntensity > 0.2) {
            const ox = Math.round((Math.random() - 0.5) * s.shakeIntensity);
            const oy = Math.round((Math.random() - 0.5) * s.shakeIntensity);
            ctx.translate(ox, oy);
            s.shakeIntensity *= 0.85;
          }

          const horizonY = Math.floor(height * 0.43 - s.jumpY * 0.11);

          // 1. SNES HDMA Stepped 15-bit Sky Bands (8 discrete color bands)
          const skyBands = 10;
          const bandH = Math.ceil(Math.max(10, horizonY) / skyBands);
          for (let b = 0; b < skyBands; b++) {
            const ratio = b / (skyBands - 1);
            ctx.fillStyle = ratio < 0.45 ? track.palette.skyTop : ratio < 0.85 ? track.palette.skyBottom : track.palette.horizonGlow;
            ctx.fillRect(0, b * bandH, width, bandH + 1);
          }

          // Dithered transition strips between HDMA sky bands
          ctx.fillStyle = track.palette.skyBottom;
          for (let x = 0; x < width; x += 2) {
            ctx.fillRect(x, Math.floor(horizonY * 0.44), 1, 2);
          }
          ctx.fillStyle = track.palette.horizonGlow;
          for (let x = 0; x < width; x += 2) {
            ctx.fillRect(x, Math.floor(horizonY * 0.84), 1, 2);
          }

          // 2. Parallax Layer 1: 16-bit Pixel Planet / Ringed Gas Giant in Sky
          const planetX = Math.round(((width * 0.72 - s.skyOffset * 0.25) % width + width) % width);
          const planetY = Math.max(18, Math.floor(horizonY * 0.42));
          ctx.fillStyle = track.palette.sceneryAccent;
          ctx.fillRect(planetX - 14, planetY - 14, 28, 28);
          ctx.fillStyle = track.palette.skyTop;
          ctx.fillRect(planetX - 10, planetY - 10, 14, 20);
          // Saturn-style pixel ring
          ctx.fillStyle = '#F8FAFC';
          ctx.fillRect(planetX - 24, planetY - 1, 48, 2);

          // 3. Parallax Layer 2: 16-Bit Far Megacity / Canyon Horizon Silhouette
          const bldgCount = 24;
          const bldgW = Math.ceil(width / bldgCount);
          const shift1 = Math.floor(((s.skyOffset % bldgW) + bldgW) % bldgW);
          for (let i = -2; i <= bldgCount + 2; i++) {
            const bx = i * bldgW - shift1;
            const worldIdx = i + Math.floor(s.skyOffset / bldgW);
            const seed = Math.abs(Math.sin(worldIdx * 2.31));
            const bh = Math.floor(8 + seed * 28);

            ctx.fillStyle = track.palette.groundLight;
            ctx.fillRect(bx, horizonY - bh, bldgW - 1, bh);

            // Illuminated 16-bit pixel windows on tall buildings
            if (bh > 16) {
              ctx.fillStyle = track.palette.horizonGlow;
              for (let wy = horizonY - bh + 3; wy < horizonY - 3; wy += 4) {
                ctx.fillRect(bx + 3, wy, 2, 2);
                if (bldgW > 10) ctx.fillRect(bx + 8, wy, 2, 2);
              }
            }
          }

          // 4. Execute SNES Mode 7 Perspective Distortion Shader on Track Background Layer
          renderMode7GroundShader(
            ctx,
            width,
            height,
            horizonY,
            s.playerX * 64,
            s.z * 0.08,
            110 + s.jumpY * 0.45,
            s.headingAngle,
            s.steerAngle,
            s.boostTimerMs > 0
          );

          // Subtle HDMA Horizon Haze Strip blending the Mode 7 floor into the skyline
          ctx.fillStyle = track.palette.horizonGlow;
          ctx.fillRect(0, horizonY, width, 2);

          // 5. Project 3D Road Segments (Back-to-Front Painter's Algorithm at 240p Pixel Precision)
          const drawDistance = 90;
          const baseIndex = Math.floor(
            (((s.z % totalTrackLength) + totalTrackLength) % totalTrackLength) / SEGMENT_LENGTH
          );
          const basePercent =
            (((s.z % totalTrackLength) + totalTrackLength) % SEGMENT_LENGTH) / SEGMENT_LENGTH;

          const cameraHeight = 1050 + s.jumpY * 2.2;
          const fovDepth = 0.82;
          const roadWidthWorld = 2150;

          const projectedSegs: {
            seg: typeof track.segments[0];
            screenX: number;
            screenY: number;
            screenW: number;
            scale: number;
          }[] = [];

          let dx = -basePercent * track.segments[baseIndex % totalSegments].curve;
          let xCurveOffset = 0;
          const baseElevation = track.segments[baseIndex % totalSegments].y;

          for (let n = 0; n < drawDistance; n++) {
            const segIdx = (baseIndex + n) % totalSegments;
            const seg = track.segments[segIdx];

            const worldZ = (n + 1 - basePercent) * SEGMENT_LENGTH;
            const scale = fovDepth / Math.max(40, worldZ);

            const worldX = s.playerX * roadWidthWorld - xCurveOffset;
            const worldY = cameraHeight + (baseElevation - seg.y);

            const screenX = Math.round(width / 2 - scale * worldX * (width / 2));
            const screenY = Math.round(horizonY + scale * worldY * (height / 2));
            const screenW = Math.round(scale * roadWidthWorld * (width / 2));

            projectedSegs.push({
              seg,
              screenX,
              screenY,
              screenW,
              scale,
            });

            xCurveOffset += dx;
            dx += seg.curve;
          }

          for (let n = projectedSegs.length - 1; n > 0; n--) {
            const far = projectedSegs[n];
            const near = projectedSegs[n - 1];

            if (near.screenY <= horizonY && far.screenY <= horizonY) continue;

            const isAlt = Math.floor(far.seg.index / 2) % 2 === 0;

            // Elevated Viaduct Under-Shadow Wall (gives the SNES floating F-Zero highway look)
            const wallDrop = Math.max(2, Math.round(far.screenW * 0.09));
            ctx.fillStyle = '#050811';
            ctx.beginPath();
            ctx.moveTo(far.screenX - far.screenW * 1.18, far.screenY);
            ctx.lineTo(far.screenX + far.screenW * 1.18, far.screenY);
            ctx.lineTo(near.screenX + near.screenW * 1.18, near.screenY + wallDrop);
            ctx.lineTo(near.screenX - near.screenW * 1.18, near.screenY + wallDrop);
            ctx.closePath();
            ctx.fill();

            // SNES 3D Guardrail Beam (Alternating Red/Yellow/White or Emerald/White curbs)
            const curbFactor = 1.16;
            ctx.fillStyle = isAlt ? track.palette.curbPrimary : track.palette.curbSecondary;
            ctx.beginPath();
            ctx.moveTo(far.screenX - far.screenW * curbFactor, far.screenY);
            ctx.lineTo(far.screenX + far.screenW * curbFactor, far.screenY);
            ctx.lineTo(near.screenX + near.screenW * curbFactor, near.screenY);
            ctx.lineTo(near.screenX - near.screenW * curbFactor, near.screenY);
            ctx.closePath();
            ctx.fill();

            // Main Magnetic Road Surface
            let roadFill = isAlt ? track.palette.roadDark : track.palette.roadLight;
            if (far.seg.surface === 'JUMP_PAD') {
              roadFill = (far.seg.index + animTick) % 2 === 0 ? '#0284C7' : '#FACC15';
            }
            ctx.fillStyle = roadFill;
            ctx.beginPath();
            ctx.moveTo(far.screenX - far.screenW, far.screenY);
            ctx.lineTo(far.screenX + far.screenW, far.screenY);
            ctx.lineTo(near.screenX + near.screenW, near.screenY);
            ctx.lineTo(near.screenX - near.screenW, near.screenY);
            ctx.closePath();
            ctx.fill();

            // Outer Metallic Shoulder Line
            ctx.fillStyle = '#64748B';
            ctx.beginPath();
            ctx.moveTo(far.screenX - far.screenW * 0.94, far.screenY);
            ctx.lineTo(far.screenX - far.screenW * 0.91, far.screenY);
            ctx.lineTo(near.screenX - near.screenW * 0.91, near.screenY);
            ctx.lineTo(near.screenX - near.screenW * 0.94, near.screenY);
            ctx.closePath();
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(far.screenX + far.screenW * 0.91, far.screenY);
            ctx.lineTo(far.screenX + far.screenW * 0.94, far.screenY);
            ctx.lineTo(near.screenX + near.screenW * 0.94, near.screenY);
            ctx.lineTo(near.screenX + near.screenW * 0.91, near.screenY);
            ctx.closePath();
            ctx.fill();

            // Special Track Surface Overlays
            if (far.seg.index === 2 || far.seg.index === 3) {
              // Start / Finish Checkered Line
              ctx.fillStyle = far.seg.index === 2 ? '#FFFFFF' : '#090D16';
              ctx.beginPath();
              ctx.moveTo(far.screenX - far.screenW, far.screenY);
              ctx.lineTo(far.screenX + far.screenW, far.screenY);
              ctx.lineTo(near.screenX + near.screenW, near.screenY);
              ctx.lineTo(near.screenX - near.screenW, near.screenY);
              ctx.closePath();
              ctx.fill();
            } else if (far.seg.surface === 'RECHARGE_PIT') {
              // Classic SNES Animated Pink/Emerald Energy Pit Field
              const pulseOn = (far.seg.index + animTick) % 2 === 0;
              ctx.fillStyle = pulseOn ? '#10B981' : '#EC4899';
              ctx.beginPath();
              ctx.moveTo(far.screenX - far.screenW * 0.68, far.screenY);
              ctx.lineTo(far.screenX + far.screenW * 0.68, far.screenY);
              ctx.lineTo(near.screenX + near.screenW * 0.68, near.screenY);
              ctx.lineTo(near.screenX - near.screenW * 0.68, near.screenY);
              ctx.closePath();
              ctx.fill();
            } else if (far.seg.surface === 'BOOST_PAD') {
              // SNES Zipper Multicolor Flashing Boost Arrow
              const zipperColors = ['#F59E0B', '#EF4444', '#38BDF8', '#FEF08A'];
              ctx.fillStyle = zipperColors[(far.seg.index + animTick) % zipperColors.length];
              ctx.beginPath();
              ctx.moveTo(far.screenX - far.screenW * 0.15, far.screenY);
              ctx.lineTo(far.screenX + far.screenW * 0.15, far.screenY);
              ctx.lineTo(near.screenX + near.screenW * 0.42, near.screenY);
              ctx.lineTo(near.screenX - near.screenW * 0.42, near.screenY);
              ctx.closePath();
              ctx.fill();
            } else if (isAlt) {
              // Center Dual Dashed Lane Striping
              ctx.fillStyle = '#94A3B8';
              ctx.beginPath();
              ctx.moveTo(far.screenX - far.screenW * 0.03, far.screenY);
              ctx.lineTo(far.screenX + far.screenW * 0.03, far.screenY);
              ctx.lineTo(near.screenX + near.screenW * 0.03, near.screenY);
              ctx.lineTo(near.screenX - near.screenW * 0.03, near.screenY);
              ctx.closePath();
              ctx.fill();
            }

            // Roadside 16-bit Scenery Objects
            if (far.seg.sceneryLeft !== 'NONE') {
              draw16BitScenery(
                ctx,
                far.seg.sceneryLeft,
                far.screenX - far.screenW * 1.26,
                far.screenY,
                far.scale * 880,
                track.palette.sceneryAccent,
                'LEFT',
                far.screenW,
                animTick
              );
            }
            if (far.seg.sceneryRight !== 'NONE' && far.seg.sceneryRight !== 'START_BANNER') {
              draw16BitScenery(
                ctx,
                far.seg.sceneryRight,
                far.screenX + far.screenW * 1.26,
                far.screenY,
                far.scale * 880,
                track.palette.sceneryAccent,
                'RIGHT',
                far.screenW,
                animTick
              );
            }

            // Render AI Competitors with 16-Bit Pixel-Art Sprites
            s.rivals.forEach((rival) => {
              const rivalSegIdx = Math.floor(rival.z / SEGMENT_LENGTH) % totalSegments;
              if (rivalSegIdx === far.seg.index) {
                const rivalScreenX = far.screenX + rival.x * far.screenW;
                const rivalScale = Math.min(1.4, far.scale * 720);
                if (rivalScale > 0.08) {
                  drawPixelCraft(
                    ctx,
                    rivalScreenX,
                    far.screenY,
                    rivalScale,
                    rival.hullStyle,
                    rival.primaryColor,
                    '#E2E8F0',
                    '#38BDF8',
                    '#F59E0B',
                    rival.steer,
                    flamePhase,
                    false,
                    false
                  );
                }
              }
            });
          }

          // 6. Render Time Trial Ghost with 16-Bit Pixel Sprite
          if (
            mode === 'TIME_TRIAL' &&
            existingRecord?.ghostSamples &&
            existingRecord.ghostSamples.length > 1 &&
            racePhase === 'RACING'
          ) {
            const ghostIdx = Math.min(
              existingRecord.ghostSamples.length - 1,
              Math.floor(s.elapsedRaceMs / 120)
            );
            const gSample = existingRecord.ghostSamples[ghostIdx];
            if (gSample) {
              const gRelZ = gSample.trackZ - s.z;
              if (gRelZ > 60 && gRelZ < drawDistance * SEGMENT_LENGTH) {
                const segOffset = Math.min(
                  projectedSegs.length - 1,
                  Math.max(0, Math.floor(gRelZ / SEGMENT_LENGTH))
                );
                const proj = projectedSegs[segOffset];
                if (proj) {
                  const gx = proj.screenX + gSample.playerX * proj.screenW;
                  const gScale = Math.min(1.3, proj.scale * 720);
                  drawPixelCraft(
                    ctx,
                    gx,
                    proj.screenY - gSample.jumpY * gScale * 0.25,
                    gScale,
                    craft.hullStyle,
                    '#38BDF8',
                    '#E0F2FE',
                    '#FFFFFF',
                    '#38BDF8',
                    gSample.steer,
                    flamePhase,
                    false,
                    true
                  );
                }
              }
            }
          }

          // 7. Render Player 16-Bit Pixel-Art Hovercraft in Foreground
          if (racePhase !== 'DESTROYED') {
            const hoverBob = Math.round(Math.sin(now * 0.014) * 1.5);
            const playerScreenY = Math.round(
              height * 0.84 - Math.min(68, s.jumpY * 0.22) + hoverBob
            );
            drawPixelCraft(
              ctx,
              Math.round(width / 2 + s.steerAngle * 9),
              playerScreenY,
              1.35,
              craft.hullStyle,
              craft.primaryColor,
              craft.secondaryColor,
              craft.cockpitColor,
              craft.thrusterColor,
              s.steerAngle,
              flamePhase,
              s.boostTimerMs > 0,
              false
            );
          }

          // 8. Pixel Particles (Sparks, Boost Plasma, Explosion Debris)
          for (let i = s.particles.length - 1; i >= 0; i--) {
            const p = s.particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.life++;
            if (p.life >= p.maxLife) {
              s.particles.splice(i, 1);
              continue;
            }
            ctx.fillStyle = p.color;
            ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
          }

          ctx.restore();
          renderMinimap();
        }
      }

      animationFrameId = requestAnimationFrame(step);
    };

    animationFrameId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animationFrameId);
  }, [
    craft,
    track,
    mode,
    settings,
    existingRecord,
    isPaused,
    racePhase,
    hudState.countdown,
    concludeRace,
  ]);

  const showTouchUi =
    settings.showTouchControls === 'ALWAYS' ||
    (settings.showTouchControls === 'AUTO' && isTouchDevice);

  // SNES Segmented Power Meter (20 discrete blocks)
  const totalEnergyBlocks = 20;
  const filledEnergyBlocks = Math.ceil((hudState.energy / 100) * totalEnergyBlocks);

  return (
    <div className="relative w-full h-[calc(100vh-65px)] min-h-[540px] bg-[#0B0F19] overflow-hidden select-none flex flex-col justify-between">
      {/* Authentic 426x240 16-Bit Mode-7 Pixel Canvas with Nearest-Neighbor Scaling */}
      <canvas
        ref={canvasRef}
        width={426}
        height={240}
        style={{ imageRendering: 'pixelated' }}
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* Subtle SNES CRT Scanline Overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-20"
        style={{
          backgroundImage:
            'repeating-linear-gradient(to bottom, transparent 0px, transparent 2px, rgba(0,0,0,0.85) 2px, rgba(0,0,0,0.85) 4px)',
        }}
      />

      {/* TOP 16-BIT ARCADE COCKPIT HUD */}
      <div className="relative z-10 w-full max-w-7xl mx-auto px-4 pt-3 flex flex-wrap items-start justify-between gap-4 pointer-events-none">
        {/* Left Cluster: Position, Lap & Timer */}
        <div className="flex items-center gap-4 bg-slate-950/90 border-2 border-slate-700 rounded-lg px-4 py-2 shadow-lg">
          {mode !== 'TIME_TRIAL' && (
            <div className="pr-4 border-r border-slate-800">
              <div className="text-[11px] font-semibold text-slate-400">Posición</div>
              <div className="text-2xl font-bold font-display text-amber-400 font-mono-tabular leading-none mt-0.5">
                {hudState.rank}º{' '}
                <span className="text-sm text-slate-400 font-normal">/ {hudState.totalRacers}</span>
              </div>
            </div>
          )}
          <div className="pr-4 border-r border-slate-800">
            <div className="text-[11px] font-semibold text-slate-400">Vuelta</div>
            <div className="text-2xl font-bold font-display text-slate-100 font-mono-tabular leading-none mt-0.5">
              {hudState.lap}{' '}
              <span className="text-sm text-slate-400 font-normal">/ {hudState.totalLaps}</span>
            </div>
          </div>
          <div>
            <div className="text-[11px] font-semibold text-slate-400">Tiempo</div>
            <div className="text-lg font-bold text-emerald-400 font-mono-tabular leading-none mt-1">
              {formatRaceTime(hudState.currentLapMs)}
            </div>
          </div>
        </div>

        {/* Center SNES Segmented Power / Shield Meter */}
        <div className="flex-1 max-w-md min-w-[240px] bg-slate-950/90 border-2 border-slate-700 rounded-lg px-4 py-2 shadow-lg">
          <div className="flex items-center justify-between text-xs font-bold mb-1.5">
            <span className="text-amber-400 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5" />
              POWER / ESCUDO
            </span>
            <span
              className={`font-mono-tabular ${
                hudState.energy <= 22 ? 'text-red-400 animate-pulse' : 'text-slate-100'
              }`}
            >
              {hudState.energy}% · {hudState.energy <= 22 ? 'PELIGRO' : 'NOMINAL'}
            </span>
          </div>

          {/* 20 Discrete 16-Bit Power Segments */}
          <div className="grid grid-cols-20 gap-0.5 bg-slate-900 p-1 rounded border border-slate-800">
            {Array.from({ length: totalEnergyBlocks }).map((_, i) => {
              const active = i < filledEnergyBlocks;
              let segColor = 'bg-slate-800';
              if (active) {
                if (hudState.energy <= 22) segColor = 'bg-red-500';
                else if (hudState.isRecharging) segColor = 'bg-emerald-400';
                else if (i < 5) segColor = 'bg-red-500';
                else if (i < 11) segColor = 'bg-amber-400';
                else segColor = 'bg-emerald-400';
              }
              return <div key={i} className={`h-3 rounded-[1px] ${segColor}`} />;
            })}
          </div>

          {hudState.statusBanner && (
            <div className="mt-1.5 text-[11px] font-bold tracking-wide text-center text-amber-300 truncate">
              {hudState.statusBanner}
            </div>
          )}
        </div>

        {/* Right Cluster: Digital Speedometer + Pixel Radar + Pause */}
        <div className="flex items-start gap-3">
          <div className="bg-slate-950/90 border-2 border-slate-700 rounded-lg px-4 py-2 text-right min-w-[138px] shadow-lg">
            <div className="text-[11px] font-semibold text-slate-400">Velocímetro</div>
            <div className="text-3xl font-bold font-display text-amber-400 font-mono-tabular leading-none mt-0.5">
              {hudState.speedKmh}
              <span className="text-xs font-sans font-semibold text-slate-300 ml-1">km/h</span>
            </div>
          </div>

          <div className="hidden sm:flex flex-col items-center bg-slate-950/90 border-2 border-slate-700 rounded-lg p-1.5 shadow-lg">
            <canvas
              ref={minimapRef}
              width={78}
              height={78}
              style={{ imageRendering: 'pixelated' }}
              className="w-[78px] h-[78px]"
            />
          </div>

          <button
            type="button"
            onClick={() => setIsPaused((p) => !p)}
            className="pointer-events-auto min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg bg-slate-950/90 hover:bg-slate-800 border-2 border-slate-700 text-slate-100 transition-colors cursor-pointer"
            aria-label="Pausar carrera"
          >
            <Pause className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* CENTER COUNTDOWN SEMAPHORE OVERLAY */}
      {racePhase === 'COUNTDOWN' && (
        <div className="relative z-10 flex flex-col items-center justify-center pointer-events-none my-auto">
          <div className="bg-slate-950/95 border-2 border-slate-600 rounded-xl px-8 py-6 text-center shadow-2xl">
            <div className="text-xs font-bold text-amber-400 mb-2">
              {track.name} · {track.sector}
            </div>
            <div className="flex items-center justify-center gap-4 my-3">
              <div
                className={`w-7 h-7 rounded-sm border-2 ${
                  hudState.countdown <= 3 && hudState.countdown > 0
                    ? 'bg-red-500 border-red-200'
                    : 'bg-slate-900 border-slate-700'
                }`}
              />
              <div
                className={`w-7 h-7 rounded-sm border-2 ${
                  hudState.countdown <= 2 && hudState.countdown > 0
                    ? 'bg-amber-400 border-amber-100'
                    : 'bg-slate-900 border-slate-700'
                }`}
              />
              <div
                className={`w-7 h-7 rounded-sm border-2 ${
                  hudState.countdown === 0
                    ? 'bg-emerald-400 border-emerald-100'
                    : 'bg-slate-900 border-slate-700'
                }`}
              />
            </div>
            <div className="text-5xl font-bold font-display text-slate-100 font-mono-tabular">
              {hudState.countdown > 0 ? hudState.countdown : '¡GO!'}
            </div>
          </div>
        </div>
      )}

      {/* BOTTOM DESKTOP KEYBOARD BAR OR MOBILE TOUCH CONTROLS */}
      <div className="relative z-10 w-full max-w-7xl mx-auto px-4 pb-4">
        {showTouchUi ? (
          <div className="flex items-end justify-between gap-4 w-full">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onPointerDown={() => {
                    inputRef.current.strafeLeft = true;
                  }}
                  onPointerUp={() => {
                    inputRef.current.strafeLeft = false;
                  }}
                  onPointerLeave={() => {
                    inputRef.current.strafeLeft = false;
                  }}
                  className="min-h-[48px] px-4 rounded-xl bg-slate-950/90 active:bg-amber-500 active:text-slate-950 border-2 border-slate-700 text-xs font-bold text-slate-200 whitespace-nowrap"
                >
                  L-Strafe (Q)
                </button>
                <button
                  type="button"
                  onPointerDown={() => {
                    inputRef.current.strafeRight = true;
                  }}
                  onPointerUp={() => {
                    inputRef.current.strafeRight = false;
                  }}
                  onPointerLeave={() => {
                    inputRef.current.strafeRight = false;
                  }}
                  className="min-h-[48px] px-4 rounded-xl bg-slate-950/90 active:bg-amber-500 active:text-slate-950 border-2 border-slate-700 text-xs font-bold text-slate-200 whitespace-nowrap"
                >
                  R-Strafe (E)
                </button>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onPointerDown={() => {
                    inputRef.current.left = true;
                  }}
                  onPointerUp={() => {
                    inputRef.current.left = false;
                  }}
                  onPointerLeave={() => {
                    inputRef.current.left = false;
                  }}
                  className="min-h-[64px] min-w-[76px] flex items-center justify-center rounded-2xl bg-slate-950/90 active:bg-amber-500 active:text-slate-950 border-2 border-slate-700 text-slate-100"
                  aria-label="Girar a la izquierda"
                >
                  <ArrowLeft className="w-7 h-7" />
                </button>
                <button
                  type="button"
                  onPointerDown={() => {
                    inputRef.current.right = true;
                  }}
                  onPointerUp={() => {
                    inputRef.current.right = false;
                  }}
                  onPointerLeave={() => {
                    inputRef.current.right = false;
                  }}
                  className="min-h-[64px] min-w-[76px] flex items-center justify-center rounded-2xl bg-slate-950/90 active:bg-amber-500 active:text-slate-950 border-2 border-slate-700 text-slate-100"
                  aria-label="Girar a la derecha"
                >
                  <ArrowRight className="w-7 h-7" />
                </button>
              </div>
            </div>

            <div className="flex items-end gap-2.5">
              <button
                type="button"
                onPointerDown={() => {
                  inputRef.current.brake = true;
                }}
                onPointerUp={() => {
                  inputRef.current.brake = false;
                }}
                onPointerLeave={() => {
                  inputRef.current.brake = false;
                }}
                className="min-h-[56px] px-4 rounded-2xl bg-slate-950/90 active:bg-red-500 border-2 border-slate-700 text-xs font-bold text-slate-200 whitespace-nowrap"
              >
                Freno (B)
              </button>
              <button
                type="button"
                onPointerDown={() => {
                  inputRef.current.boost = true;
                }}
                onPointerUp={() => {
                  inputRef.current.boost = false;
                }}
                onPointerLeave={() => {
                  inputRef.current.boost = false;
                }}
                className="min-h-[64px] px-5 flex items-center gap-1.5 rounded-2xl bg-amber-500 active:bg-amber-400 text-slate-950 font-bold text-sm shadow-lg whitespace-nowrap"
              >
                <Flame className="w-5 h-5" />
                Turbo (A)
              </button>
              <button
                type="button"
                onPointerDown={() => {
                  inputRef.current.accelerate = true;
                }}
                onPointerUp={() => {
                  inputRef.current.accelerate = false;
                }}
                onPointerLeave={() => {
                  inputRef.current.accelerate = false;
                }}
                className="min-h-[76px] px-6 rounded-2xl bg-emerald-500 active:bg-emerald-400 text-slate-950 font-bold text-sm shadow-lg whitespace-nowrap"
              >
                Acelerar (Y)
              </button>
            </div>
          </div>
        ) : (
          <div className="hidden md:flex items-center justify-between bg-slate-950/85 border border-slate-700 rounded-lg px-4 py-2 text-xs text-slate-300">
            <div className="flex items-center gap-4">
              <span>
                <strong className="text-slate-100">W / ↑</strong> Acelerar
              </span>
              <span>·</span>
              <span>
                <strong className="text-slate-100">A D / ← →</strong> Dirección
              </span>
              <span>·</span>
              <span>
                <strong className="text-slate-100">Q / E</strong> Propulsores L/R (Strafe)
              </span>
              <span>·</span>
              <span>
                <strong className="text-amber-400">Espacio / Shift</strong> Hyper-Boost
              </span>
            </div>
            <div className="text-slate-400 font-mono-tabular">
              Récord Pista: {existingRecord ? formatRaceTime(existingRecord.bestLapMs) : '--:--.---'}
            </div>
          </div>
        )}
      </div>

      {/* PAUSE MODAL */}
      {isPaused && (racePhase === 'RACING' || racePhase === 'COUNTDOWN') && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl">
            <h2 className="text-2xl font-bold font-display text-slate-100">Carrera en Pausa</h2>
            <p className="text-sm text-slate-400 mt-1">
              {track.name} · {craft.name}
            </p>

            <div className="mt-6 flex flex-col gap-3">
              <button
                type="button"
                onClick={() => setIsPaused(false)}
                className="w-full min-h-[44px] flex items-center justify-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-sm transition-colors cursor-pointer whitespace-nowrap"
              >
                <Play className="w-4 h-4" />
                Reanudar Carrera
              </button>
              <button
                type="button"
                onClick={initSimulation}
                className="w-full min-h-[44px] flex items-center justify-center gap-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 font-semibold text-sm transition-colors cursor-pointer whitespace-nowrap"
              >
                <RotateCcw className="w-4 h-4" />
                Reiniciar Circuito
              </button>
              <button
                type="button"
                onClick={onExitToMenu}
                className="w-full min-h-[44px] flex items-center justify-center gap-2 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 font-medium text-sm transition-colors cursor-pointer whitespace-nowrap"
              >
                Volver al Hangar Principal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RACE SUMMARY / GAME OVER MODAL */}
      {(racePhase === 'FINISHED' || racePhase === 'DESTROYED') && finalResults && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto">
          <div className="w-full max-w-2xl rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl my-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div>
                <div className="text-xs font-semibold text-amber-400">
                  {mode === 'GRAND_PRIX'
                    ? `Copa Grand Prix · Circuito ${gpRoundIndex + 1} de ${gpTotalRounds}`
                    : mode === 'TIME_TRIAL'
                    ? 'Contrarreloj Oficial'
                    : 'Carrera Rápida'}
                </div>
                <h2 className="text-3xl font-bold font-display text-slate-100 mt-0.5 flex items-center gap-2.5">
                  {racePhase === 'DESTROYED' ? (
                    <>
                      <AlertTriangle className="w-7 h-7 text-red-500 shrink-0" />
                      Nave Destruida · Escudo Agotado
                    </>
                  ) : (
                    <>
                      <Flag className="w-7 h-7 text-amber-400 shrink-0" />
                      Circuito Completado · {track.name}
                    </>
                  )}
                </h2>
              </div>
              <div className="text-right font-mono-tabular">
                <div className="text-xs text-slate-400">Mejor Vuelta</div>
                <div className="text-lg font-bold text-emerald-400">
                  {hudState.bestLapMs > 0 ? formatRaceTime(hudState.bestLapMs) : '--:--.---'}
                </div>
              </div>
            </div>

            <div className="mt-4 max-h-64 overflow-y-auto divide-y divide-slate-800/80 border border-slate-800 rounded-xl">
              {finalResults.map((res, idx) => (
                <div
                  key={res.id}
                  className={`flex items-center justify-between px-4 py-2.5 text-sm ${
                    res.isPlayer ? 'bg-amber-500/15 text-amber-200 font-semibold' : 'text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-6 font-mono-tabular text-slate-400">{idx + 1}.</span>
                    <span
                      className="w-3 h-3 rounded-sm shrink-0"
                      style={{ backgroundColor: res.primaryColor }}
                    />
                    <span className="truncate">{res.name}</span>
                    <span className="text-xs text-slate-400 hidden sm:inline">· {res.craftName}</span>
                  </div>
                  <div className="flex items-center gap-4 font-mono-tabular shrink-0">
                    <span>
                      {res.status === 'DESTROYED' ? 'DESTRUIDO' : formatRaceTime(res.totalTimeMs)}
                    </span>
                    {mode === 'GRAND_PRIX' && (
                      <span className="text-xs font-bold text-amber-400 w-14 text-right">
                        +{res.points} pts
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
              <button
                type="button"
                onClick={initSimulation}
                className="min-h-[44px] px-5 py-2.5 flex items-center gap-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
              >
                <RotateCcw className="w-4 h-4" />
                Reintentar Pista
              </button>
              <button
                type="button"
                onClick={onExitToMenu}
                className="min-h-[44px] px-6 py-2.5 flex items-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-colors cursor-pointer whitespace-nowrap"
              >
                {mode === 'GRAND_PRIX' &&
                gpRoundIndex + 1 < gpTotalRounds &&
                racePhase !== 'DESTROYED' ? (
                  <>
                    Siguiente Circuito de la Copa
                    <ChevronRight className="w-4 h-4" />
                  </>
                ) : (
                  <>
                    <Trophy className="w-4 h-4" />
                    Continuar al Hangar
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
