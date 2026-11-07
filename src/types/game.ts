export type GameView = 'GARAGE_MENU' | 'RACING' | 'RECORDS' | 'CONTROLS';

export type GameMode = 'GRAND_PRIX' | 'TIME_TRIAL' | 'QUICK_RACE';

export type SurfaceType =
  | 'NORMAL'
  | 'RECHARGE_PIT'
  | 'BOOST_PAD'
  | 'JUMP_PAD'
  | 'DIRT_SHOULDER';

export type SceneryType =
  | 'NONE'
  | 'NEON_PILLAR'
  | 'START_BANNER'
  | 'SOLAR_TOWER'
  | 'CRYO_CRYSTAL'
  | 'GRANDSTAND'
  | 'CHEVRON_SIGN';

export interface CraftSpec {
  id: string;
  name: string;
  code: string;
  team: string;
  pilot: string;
  tagline: string;
  primaryColor: string;
  secondaryColor: string;
  cockpitColor: string;
  thrusterColor: string;
  // Normalized display stats (1 - 100)
  stats: {
    topSpeed: number;
    acceleration: number;
    grip: number;
    shield: number;
    boostPower: number;
  };
  // Physics tuning
  physics: {
    maxSpeedKmh: number;
    accelRate: number;
    centrifugalResist: number;
    strafeSpeed: number;
    shieldArmor: number;
    boostMultiplier: number;
  };
  hullStyle: 'DELTA' | 'HEAVY_TWIN' | 'NEEDLE' | 'SOLAR_WING';
}

export interface TrackSegment {
  index: number;
  z: number;
  curve: number; // -4 (sharp left) to +4 (sharp right)
  y: number; // elevation height
  surface: SurfaceType;
  sceneryLeft: SceneryType;
  sceneryRight: SceneryType;
}

export interface TrackSpec {
  id: string;
  name: string;
  sector: string;
  planet: string;
  difficulty: 'Estándar' | 'Técnico' | 'Extremo';
  lengthKm: number;
  laps: number;
  description: string;
  musicTheme: 0 | 1 | 2;
  palette: {
    skyTop: string;
    skyBottom: string;
    horizonGlow: string;
    groundDark: string;
    groundLight: string;
    gridLine: string;
    roadDark: string;
    roadLight: string;
    curbPrimary: string;
    curbSecondary: string;
    sceneryAccent: string;
  };
  segments: TrackSegment[];
  minimapPath: { x: number; y: number }[];
}

export interface GhostSample {
  timeMs: number;
  trackZ: number;
  playerX: number;
  jumpY: number;
  steer: number;
}

export interface TrackRecord {
  trackId: string;
  bestTotalMs: number;
  bestLapMs: number;
  craftId: string;
  pilotName: string;
  dateStr: string;
  ghostSamples?: GhostSample[];
}

export interface CompetitorResult {
  id: string;
  name: string;
  craftName: string;
  craftId: string;
  primaryColor: string;
  isPlayer: boolean;
  totalTimeMs: number;
  bestLapMs: number;
  points: number;
  status: 'FINISHED' | 'DESTROYED';
}

export interface GrandPrixStanding {
  id: string;
  name: string;
  craftName: string;
  primaryColor: string;
  isPlayer: boolean;
  points: number;
}

export interface UserSettings {
  soundEnabled: boolean;
  musicVolume: number;
  sfxVolume: number;
  showTouchControls: 'AUTO' | 'ALWAYS' | 'OFF';
  cameraShake: boolean;
}
