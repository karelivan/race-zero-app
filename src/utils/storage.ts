import { TrackRecord, UserSettings } from '../types/game';

const RECORDS_KEY = 'aerox99_track_records_v1';
const SETTINGS_KEY = 'aerox99_user_settings_v1';
const GP_CUPS_KEY = 'aerox99_gp_trophies_v1';

const DEFAULT_RECORDS: Record<string, TrackRecord> = {
  'neo-veridia': {
    trackId: 'neo-veridia',
    bestTotalMs: 98420,
    bestLapMs: 31850,
    craftId: 'valkyrie-v01',
    pilotName: 'Kaelen Voss',
    dateStr: '2199.04.12',
  },
  'helios-canyon': {
    trackId: 'helios-canyon',
    bestTotalMs: 106940,
    bestLapMs: 34210,
    craftId: 'titan-mk4',
    pilotName: 'Darius Kroll',
    dateStr: '2199.05.08',
  },
  'cryo-sector-zero': {
    trackId: 'cryo-sector-zero',
    bestTotalMs: 112680,
    bestLapMs: 36120,
    craftId: 'solaris-apex',
    pilotName: 'Elena Vance',
    dateStr: '2199.06.19',
  },
};

export const DEFAULT_SETTINGS: UserSettings = {
  soundEnabled: true,
  musicVolume: 0.45,
  sfxVolume: 0.65,
  showTouchControls: 'AUTO',
  cameraShake: true,
};

export function loadTrackRecords(): Record<string, TrackRecord> {
  try {
    const raw = localStorage.getItem(RECORDS_KEY);
    if (!raw) return { ...DEFAULT_RECORDS };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_RECORDS, ...parsed };
  } catch {
    return { ...DEFAULT_RECORDS };
  }
}

export function saveTrackRecord(record: TrackRecord): {
  isNewBestTotal: boolean;
  isNewBestLap: boolean;
  updatedRecord: TrackRecord;
} {
  const all = loadTrackRecords();
  const existing = all[record.trackId];

  const isNewBestTotal = !existing || record.bestTotalMs < existing.bestTotalMs;
  const isNewBestLap = !existing || record.bestLapMs < existing.bestLapMs;

  const updated: TrackRecord = {
    trackId: record.trackId,
    bestTotalMs: isNewBestTotal ? record.bestTotalMs : existing.bestTotalMs,
    bestLapMs: isNewBestLap ? record.bestLapMs : existing.bestLapMs,
    craftId: isNewBestTotal ? record.craftId : existing.craftId,
    pilotName: isNewBestTotal ? record.pilotName : existing.pilotName,
    dateStr: isNewBestTotal ? record.dateStr : existing.dateStr,
    ghostSamples:
      isNewBestTotal && record.ghostSamples && record.ghostSamples.length > 0
        ? record.ghostSamples
        : existing?.ghostSamples,
  };

  all[record.trackId] = updated;
  try {
    localStorage.setItem(RECORDS_KEY, JSON.stringify(all));
  } catch {
    // Ignore quota errors
  }

  return { isNewBestTotal, isNewBestLap, updatedRecord: updated };
}

export function resetAllRecords(): Record<string, TrackRecord> {
  try {
    localStorage.removeItem(RECORDS_KEY);
    localStorage.removeItem(GP_CUPS_KEY);
  } catch {
    // Ignore storage errors
  }
  return { ...DEFAULT_RECORDS };
}

export function loadUserSettings(): UserSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveUserSettings(settings: UserSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Ignore
  }
}

export interface GrandPrixTrophy {
  dateStr: string;
  craftId: string;
  craftName: string;
  totalPoints: number;
  rank: number;
}

export function loadGrandPrixTrophies(): GrandPrixTrophy[] {
  try {
    const raw = localStorage.getItem(GP_CUPS_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveGrandPrixTrophy(trophy: GrandPrixTrophy): GrandPrixTrophy[] {
  const existing = loadGrandPrixTrophies();
  const updated = [trophy, ...existing].slice(0, 10);
  try {
    localStorage.setItem(GP_CUPS_KEY, JSON.stringify(updated));
  } catch {
    // Ignore
  }
  return updated;
}

export function formatRaceTime(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '00:00.000';
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const millis = Math.floor(ms % 1000);

  const minStr = String(minutes).padStart(2, '0');
  const secStr = String(seconds).padStart(2, '0');
  const msStr = String(millis).padStart(3, '0');
  return `${minStr}:${secStr}.${msStr}`;
}
