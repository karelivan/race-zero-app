import { CraftSpec, SceneryType, SurfaceType, TrackSegment, TrackSpec } from '../types/game';

export const CRAFTS: CraftSpec[] = [
  {
    id: 'valkyrie-v01',
    name: 'Valkyrie V-01',
    code: 'AX-01',
    team: 'Aegis Dynamics',
    pilot: 'Kaelen Voss',
    tagline: 'Equilibrio aerodinámico con turbinas vectoriales de respuesta inmediata.',
    primaryColor: '#3B82F6',
    secondaryColor: '#93C5FD',
    cockpitColor: '#F59E0B',
    thrusterColor: '#10B981',
    stats: {
      topSpeed: 84,
      acceleration: 86,
      grip: 88,
      shield: 80,
      boostPower: 85,
    },
    physics: {
      maxSpeedKmh: 1420,
      accelRate: 1.0,
      centrifugalResist: 1.0,
      strafeSpeed: 1.05,
      shieldArmor: 1.0,
      boostMultiplier: 1.32,
    },
    hullStyle: 'DELTA',
  },
  {
    id: 'titan-mk4',
    name: 'Titan Goliath',
    code: 'AX-04',
    team: 'Vulcan Heavy Foundry',
    pilot: 'Darius Kroll',
    tagline: 'Chasis acorazado de doble reactor con velocidad punta colosal en rectas.',
    primaryColor: '#F59E0B',
    secondaryColor: '#FDE68A',
    cockpitColor: '#38BDF8',
    thrusterColor: '#EF4444',
    stats: {
      topSpeed: 98,
      acceleration: 68,
      grip: 72,
      shield: 96,
      boostPower: 92,
    },
    physics: {
      maxSpeedKmh: 1540,
      accelRate: 0.78,
      centrifugalResist: 0.84,
      strafeSpeed: 0.92,
      shieldArmor: 1.35,
      boostMultiplier: 1.36,
    },
    hullStyle: 'HEAVY_TWIN',
  },
  {
    id: 'spectre-zero',
    name: 'Spectre Phantom',
    code: 'AX-07',
    team: 'Kuroshio Cybernetics',
    pilot: 'Nyx Takahashi',
    tagline: 'Ultraligera de tracción magnética extrema; domina curvas cerradas sin derrapar.',
    primaryColor: '#10B981',
    secondaryColor: '#A7F3D0',
    cockpitColor: '#F43F5E',
    thrusterColor: '#38BDF8',
    stats: {
      topSpeed: 79,
      acceleration: 96,
      grip: 98,
      shield: 66,
      boostPower: 88,
    },
    physics: {
      maxSpeedKmh: 1380,
      accelRate: 1.24,
      centrifugalResist: 1.28,
      strafeSpeed: 1.22,
      shieldArmor: 0.78,
      boostMultiplier: 1.33,
    },
    hullStyle: 'NEEDLE',
  },
  {
    id: 'solaris-apex',
    name: 'Solaris Apex',
    code: 'AX-12',
    team: 'Helios Orbital Lab',
    pilot: 'Elena Vance',
    tagline: 'Prototipo experimental con postquemador de plasma de altísimo rendimiento.',
    primaryColor: '#EC4899',
    secondaryColor: '#FBCFE8',
    cockpitColor: '#FACC15',
    thrusterColor: '#F59E0B',
    stats: {
      topSpeed: 92,
      acceleration: 82,
      grip: 80,
      shield: 74,
      boostPower: 99,
    },
    physics: {
      maxSpeedKmh: 1490,
      accelRate: 0.96,
      centrifugalResist: 0.94,
      strafeSpeed: 1.08,
      shieldArmor: 0.88,
      boostMultiplier: 1.44,
    },
    hullStyle: 'SOLAR_WING',
  },
];

export const AI_RIVALS = [
  { id: 'ai-1', name: 'Vex Mercer', craftName: 'Ion Striker', primaryColor: '#6366F1' },
  { id: 'ai-2', name: 'Sora Lindqvist', craftName: 'Cobalt Dart', primaryColor: '#06B6D4' },
  { id: 'ai-3', name: 'Marcus Thorne', craftName: 'Iron Behemoth', primaryColor: '#D97706' },
  { id: 'ai-4', name: 'Lyra Chen', craftName: 'Nova Interceptor', primaryColor: '#EC4899' },
  { id: 'ai-5', name: 'Zane Kovacs', craftName: 'Crimson Viper', primaryColor: '#EF4444' },
  { id: 'ai-6', name: 'Talia Orlov', craftName: 'Emerald Falcon', primaryColor: '#10B981' },
  { id: 'ai-7', name: 'Orion Sterling', craftName: 'Zenith Vector', primaryColor: '#A855F7' },
];

export const SEGMENT_LENGTH = 200;

interface TrackBlockDef {
  length: number;
  curve?: number;
  pitch?: number;
  surface?: SurfaceType;
  sceneryEvery?: number;
  sceneryType?: SceneryType;
}

function buildTrackSegments(blocks: TrackBlockDef[]): {
  segments: TrackSegment[];
  minimapPath: { x: number; y: number }[];
} {
  const segments: TrackSegment[] = [];
  let currentY = 0;

  for (const block of blocks) {
    const curve = block.curve ?? 0;
    const pitch = block.pitch ?? 0;
    const surface = block.surface ?? 'NORMAL';

    for (let i = 0; i < block.length; i++) {
      const idx = segments.length;
      // Smooth sinusoid transitions for elevation
      const progress = i / block.length;
      const deltaY = Math.sin(progress * Math.PI) * pitch;
      currentY = Math.max(-600, Math.min(1800, currentY + deltaY));

      let sceneryLeft: SceneryType = 'NONE';
      let sceneryRight: SceneryType = 'NONE';

      if (idx === 4) {
        sceneryLeft = 'START_BANNER';
        sceneryRight = 'START_BANNER';
      } else if (block.sceneryEvery && block.sceneryType && i % block.sceneryEvery === 0) {
        sceneryLeft = block.sceneryType;
        sceneryRight = block.sceneryType;
      } else if (Math.abs(curve) >= 2.2 && i % 10 === 0) {
        sceneryLeft = curve > 0 ? 'CHEVRON_SIGN' : 'NONE';
        sceneryRight = curve < 0 ? 'CHEVRON_SIGN' : 'NONE';
      }

      segments.push({
        index: idx,
        z: idx * SEGMENT_LENGTH,
        curve,
        y: currentY,
        surface,
        sceneryLeft,
        sceneryRight,
      });
    }
  }

  // Generate closed loop 2D minimap coordinates
  const minimapPath: { x: number; y: number }[] = [];
  let angle = -Math.PI / 2;
  let px = 0;
  let py = 0;
  const totalSegs = segments.length;
  // Integrate heading to build recognizable track loop
  const totalCurve = segments.reduce((acc, s) => acc + s.curve, 0);
  const baseTurnPerSeg = (Math.PI * 2) / totalSegs;
  const curveScale = totalCurve !== 0 ? (Math.PI * 2) / Math.max(Math.abs(totalCurve), 120) : 0.015;

  for (let i = 0; i < totalSegs; i += 4) {
    const seg = segments[i];
    angle += baseTurnPerSeg * 2.2 + seg.curve * curveScale * 0.65;
    px += Math.cos(angle) * 4;
    py += Math.sin(angle) * 4;
    minimapPath.push({ x: px, y: py });
  }

  // Normalize minimap path to [0.1 .. 0.9]
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const pt of minimapPath) {
    if (pt.x < minX) minX = pt.x;
    if (pt.x > maxX) maxX = pt.x;
    if (pt.y < minY) minY = pt.y;
    if (pt.y > maxY) maxY = pt.y;
  }
  const spanX = Math.max(1, maxX - minX);
  const spanY = Math.max(1, maxY - minY);

  const normalizedMinimap = minimapPath.map((pt) => ({
    x: 0.12 + ((pt.x - minX) / spanX) * 0.76,
    y: 0.12 + ((pt.y - minY) / spanY) * 0.76,
  }));

  return { segments, minimapPath: normalizedMinimap };
}

const neoVeridiaData = buildTrackSegments([
  { length: 45, curve: 0, surface: 'RECHARGE_PIT', sceneryEvery: 8, sceneryType: 'GRANDSTAND' },
  { length: 35, curve: 0, surface: 'NORMAL', sceneryEvery: 12, sceneryType: 'NEON_PILLAR' },
  { length: 45, curve: 1.8, pitch: 8, surface: 'NORMAL', sceneryEvery: 10, sceneryType: 'NEON_PILLAR' },
  { length: 25, curve: 0, pitch: -8, surface: 'BOOST_PAD' },
  { length: 50, curve: -2.2, surface: 'NORMAL', sceneryEvery: 12, sceneryType: 'NEON_PILLAR' },
  { length: 20, curve: 0, pitch: 12, surface: 'JUMP_PAD' },
  { length: 35, curve: 0, pitch: -12, surface: 'NORMAL' },
  { length: 55, curve: 2.6, surface: 'NORMAL', sceneryEvery: 10, sceneryType: 'NEON_PILLAR' },
  { length: 30, curve: -1.4, surface: 'BOOST_PAD' },
  { length: 45, curve: 1.5, surface: 'NORMAL', sceneryEvery: 12, sceneryType: 'GRANDSTAND' },
  { length: 35, curve: 0, surface: 'RECHARGE_PIT', sceneryEvery: 8, sceneryType: 'GRANDSTAND' },
]);

const heliosCanyonData = buildTrackSegments([
  { length: 40, curve: 0, surface: 'RECHARGE_PIT', sceneryEvery: 8, sceneryType: 'SOLAR_TOWER' },
  { length: 45, curve: -2.8, pitch: 14, surface: 'NORMAL', sceneryEvery: 10, sceneryType: 'SOLAR_TOWER' },
  { length: 22, curve: 0, pitch: 10, surface: 'JUMP_PAD' },
  { length: 38, curve: 1.8, pitch: -18, surface: 'NORMAL' },
  { length: 55, curve: 3.3, surface: 'NORMAL', sceneryEvery: 10, sceneryType: 'SOLAR_TOWER' },
  { length: 25, curve: 0, surface: 'BOOST_PAD' },
  { length: 48, curve: -3.1, pitch: 10, surface: 'NORMAL', sceneryEvery: 12, sceneryType: 'SOLAR_TOWER' },
  { length: 20, curve: 0, pitch: -10, surface: 'JUMP_PAD' },
  { length: 42, curve: 2.4, surface: 'NORMAL' },
  { length: 30, curve: 0, surface: 'BOOST_PAD', sceneryEvery: 8, sceneryType: 'GRANDSTAND' },
  { length: 35, curve: 0, surface: 'RECHARGE_PIT', sceneryEvery: 8, sceneryType: 'SOLAR_TOWER' },
]);

const cryoSectorData = buildTrackSegments([
  { length: 40, curve: 0, surface: 'RECHARGE_PIT', sceneryEvery: 8, sceneryType: 'CRYO_CRYSTAL' },
  { length: 30, curve: 2.5, surface: 'BOOST_PAD', sceneryEvery: 10, sceneryType: 'CRYO_CRYSTAL' },
  { length: 50, curve: -3.6, pitch: 12, surface: 'NORMAL' },
  { length: 24, curve: 0, pitch: 14, surface: 'JUMP_PAD' },
  { length: 40, curve: 3.4, pitch: -20, surface: 'NORMAL', sceneryEvery: 10, sceneryType: 'CRYO_CRYSTAL' },
  { length: 45, curve: -3.2, surface: 'NORMAL' },
  { length: 25, curve: 0, surface: 'BOOST_PAD', sceneryEvery: 8, sceneryType: 'CRYO_CRYSTAL' },
  { length: 22, curve: 1.6, pitch: 12, surface: 'JUMP_PAD' },
  { length: 55, curve: 3.8, pitch: -12, surface: 'NORMAL', sceneryEvery: 10, sceneryType: 'CRYO_CRYSTAL' },
  { length: 35, curve: -2.0, surface: 'BOOST_PAD' },
  { length: 34, curve: 0, surface: 'RECHARGE_PIT', sceneryEvery: 8, sceneryType: 'GRANDSTAND' },
]);

export const TRACKS: TrackSpec[] = [
  {
    id: 'neo-veridia',
    name: 'Neo-Veridia Loop',
    sector: 'Sector 01 · Megalópolis Orbital',
    planet: 'Veridia Prime',
    difficulty: 'Estándar',
    lengthKm: 4.8,
    laps: 3,
    description:
      'Autopista magnética suspendida sobre rascacielos industriales. Amplias zonas de recarga, rampas de salto limpio y curvas de alta velocidad ideales para exprimir el Hyper-Boost.',
    musicTheme: 0,
    palette: {
      skyTop: '#060913',
      skyBottom: '#172554',
      horizonGlow: '#38BDF8',
      groundDark: '#090D16',
      groundLight: '#0F172A',
      gridLine: '#1E293B',
      roadDark: '#1E293B',
      roadLight: '#263349',
      curbPrimary: '#F59E0B',
      curbSecondary: '#F8FAFC',
      sceneryAccent: '#38BDF8',
    },
    segments: neoVeridiaData.segments,
    minimapPath: neoVeridiaData.minimapPath,
  },
  {
    id: 'helios-canyon',
    name: 'Helios Canyon',
    sector: 'Sector 02 · Desierto Termosolar',
    planet: 'Helios IV',
    difficulty: 'Técnico',
    lengthKm: 5.4,
    laps: 3,
    description:
      'Trazado sinuoso entre torres colectoras solares y desniveles pronunciados. Exige dominar los propulsores laterales (Strafe Q/E) para no impactar contra las barreras térmicas.',
    musicTheme: 1,
    palette: {
      skyTop: '#18070B',
      skyBottom: '#451A03',
      horizonGlow: '#F59E0B',
      groundDark: '#1C1008',
      groundLight: '#27170C',
      gridLine: '#451A03',
      roadDark: '#292524',
      roadLight: '#332E2A',
      curbPrimary: '#EF4444',
      curbSecondary: '#FDE68A',
      sceneryAccent: '#F59E0B',
    },
    segments: heliosCanyonData.segments,
    minimapPath: heliosCanyonData.minimapPath,
  },
  {
    id: 'cryo-sector-zero',
    name: 'Cryo-Sector Zero',
    sector: 'Sector 03 · Glaciar de Metano',
    planet: 'Aethelgard IX',
    difficulty: 'Extremo',
    lengthKm: 6.1,
    laps: 3,
    description:
      'El desafío definitivo del campeonato AERO-X 99. Chicanes de radio ultra cerrado, dobles saltos sobre abismos criogénicos y bandas de aceleración sucesivas a más de 1,500 km/h.',
    musicTheme: 2,
    palette: {
      skyTop: '#020617',
      skyBottom: '#0F2942',
      horizonGlow: '#10B981',
      groundDark: '#061320',
      groundLight: '#0B1E30',
      gridLine: '#13334C',
      roadDark: '#17253B',
      roadLight: '#1E304B',
      curbPrimary: '#10B981',
      curbSecondary: '#E2E8F0',
      sceneryAccent: '#10B981',
    },
    segments: cryoSectorData.segments,
    minimapPath: cryoSectorData.minimapPath,
  },
];
