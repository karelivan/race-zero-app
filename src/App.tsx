import React, { useState, useEffect } from 'react';
import {
  Play,
  Trophy,
  Volume2,
  VolumeX,
  Gamepad2,
  RotateCcw,
  Award,
  Sliders,
  CheckCircle2,
  Zap,
} from 'lucide-react';
import {
  CompetitorResult,
  GameMode,
  GameView,
  GhostSample,
  GrandPrixStanding,
  TrackRecord,
  UserSettings,
} from './types/game';
import { CRAFTS, TRACKS } from './data/craftsAndTracks';
import {
  formatRaceTime,
  GrandPrixTrophy,
  loadGrandPrixTrophies,
  loadTrackRecords,
  loadUserSettings,
  resetAllRecords,
  saveGrandPrixTrophy,
  saveTrackRecord,
  saveUserSettings,
} from './utils/storage';
import { PWAInstallButton } from './components/PWAInstallButton';
import { OfflineIndicator } from './components/OfflineIndicator';
import { CraftPreviewSvg } from './components/CraftPreviewSvg';
import { RaceCanvas } from './components/RaceCanvas';
import { soundEngine } from './audio/soundEngine';

export default function App() {
  const [activeView, setActiveView] = useState<GameView>('GARAGE_MENU');
  const [selectedMode, setSelectedMode] = useState<GameMode>('GRAND_PRIX');
  const [selectedCraftId, setSelectedCraftId] = useState<string>(CRAFTS[0].id);
  const [selectedTrackId, setSelectedTrackId] = useState<string>(TRACKS[0].id);

  // Records & Settings State
  const [records, setRecords] = useState<Record<string, TrackRecord>>(() => loadTrackRecords());
  const [gpTrophies, setGpTrophies] = useState<GrandPrixTrophy[]>(() => loadGrandPrixTrophies());
  const [settings, setSettings] = useState<UserSettings>(() => loadUserSettings());

  // Grand Prix Multi-Round Championship State
  const [gpRoundIndex, setGpRoundIndex] = useState<number>(0);
  const [gpStandings, setGpStandings] = useState<GrandPrixStanding[]>([]);
  const [gpCompleteModal, setGpCompleteModal] = useState<{
    standings: GrandPrixStanding[];
    playerRank: number;
    playerPoints: number;
  } | null>(null);
  const [recordBanner, setRecordBanner] = useState<string | null>(null);

  const selectedCraft = CRAFTS.find((c) => c.id === selectedCraftId) ?? CRAFTS[0];
  const activeTrack =
    selectedMode === 'GRAND_PRIX' && activeView === 'RACING'
      ? TRACKS[gpRoundIndex % TRACKS.length]
      : TRACKS.find((t) => t.id === selectedTrackId) ?? TRACKS[0];

  useEffect(() => {
    saveUserSettings(settings);
    soundEngine.configure(settings.soundEnabled, settings.musicVolume, settings.sfxVolume);
  }, [settings]);

  const handleStartRace = () => {
    setRecordBanner(null);
    if (selectedMode === 'GRAND_PRIX') {
      setGpRoundIndex(0);
      setGpStandings([]);
      setSelectedTrackId(TRACKS[0].id);
    }
    setActiveView('RACING');
  };

  const handleFinishRace = (
    results: CompetitorResult[],
    playerBestLapMs: number,
    playerTotalMs: number,
    ghostSamples: GhostSample[],
    playerDestroyed: boolean
  ) => {
    // 1. Save new track record if player finished
    if (!playerDestroyed) {
      const saveOutcome = saveTrackRecord({
        trackId: activeTrack.id,
        bestTotalMs: playerTotalMs,
        bestLapMs: playerBestLapMs,
        craftId: selectedCraft.id,
        pilotName: selectedCraft.pilot,
        dateStr: new Date().toISOString().slice(0, 10).replace(/-/g, '.'),
        ghostSamples,
      });
      setRecords(loadTrackRecords());

      if (saveOutcome.isNewBestLap || saveOutcome.isNewBestTotal) {
        setRecordBanner(
          `Nuevo récord en ${activeTrack.name}: ${formatRaceTime(
            saveOutcome.updatedRecord.bestLapMs
          )} (Mejor Vuelta)`
        );
      }
    }

    // 2. Accumulate Grand Prix Championship points
    if (selectedMode === 'GRAND_PRIX') {
      setGpStandings((prev) => {
        const map = new Map<string, GrandPrixStanding>();
        prev.forEach((item) => map.set(item.id, { ...item }));

        results.forEach((r) => {
          const existing = map.get(r.id);
          if (existing) {
            existing.points += r.points;
          } else {
            map.set(r.id, {
              id: r.id,
              name: r.name,
              craftName: r.craftName,
              primaryColor: r.primaryColor,
              isPlayer: r.isPlayer,
              points: r.points,
            });
          }
        });

        const updated = Array.from(map.values()).sort((a, b) => b.points - a.points);
        return updated;
      });
    }
  };

  const handleExitFromRaceCanvas = () => {
    soundEngine.stopEngine();
    soundEngine.stopMusic();

    if (selectedMode === 'GRAND_PRIX') {
      const nextRound = gpRoundIndex + 1;
      if (nextRound < TRACKS.length && gpStandings.length > 0) {
        setGpRoundIndex(nextRound);
        setSelectedTrackId(TRACKS[nextRound].id);
        // Stay in RACING view and RaceCanvas will re-initialize for the next track
        return;
      } else if (gpStandings.length > 0) {
        // Grand Prix Cup Completed!
        const sorted = [...gpStandings].sort((a, b) => b.points - a.points);
        const playerIndex = sorted.findIndex((s) => s.isPlayer);
        const playerRank = playerIndex >= 0 ? playerIndex + 1 : sorted.length;
        const playerPoints = playerIndex >= 0 ? sorted[playerIndex].points : 0;

        const updatedTrophies = saveGrandPrixTrophy({
          dateStr: new Date().toISOString().slice(0, 10).replace(/-/g, '.'),
          craftId: selectedCraft.id,
          craftName: selectedCraft.name,
          totalPoints: playerPoints,
          rank: playerRank,
        });
        setGpTrophies(updatedTrophies);
        setGpCompleteModal({
          standings: sorted,
          playerRank,
          playerPoints,
        });
      }
    }

    setActiveView('GARAGE_MENU');
  };

  const handleTrackMinimapPreview = (track: typeof TRACKS[0]) => {
    const points = track.minimapPath.map((p) => `${p.x * 160},${p.y * 100}`).join(' ');
    return (
      <svg viewBox="0 0 160 100" className="w-28 h-20 shrink-0" aria-label={`Mapa de ${track.name}`}>
        <polyline
          fill="none"
          stroke="#334155"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={`${points} ${track.minimapPath[0].x * 160},${track.minimapPath[0].y * 100}`}
        />
        <polyline
          fill="none"
          stroke={track.palette.sceneryAccent}
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={`${points} ${track.minimapPath[0].x * 160},${track.minimapPath[0].y * 100}`}
        />
        <circle
          cx={track.minimapPath[0].x * 160}
          cy={track.minimapPath[0].y * 100}
          r="4"
          fill="#F59E0B"
        />
      </svg>
    );
  };

  return (
    <div className="min-h-screen bg-[#0B0F19] text-[#F8FAFC] flex flex-col">
      {/* STRICT 3-ZONE TOP BAR CONTRACT */}
      <header className="flex items-center justify-between gap-8 px-6 py-3.5 border-b border-slate-800 bg-[#0B0F19]/95 backdrop-blur-md sticky top-0 z-30">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#hangar"
          onClick={(e) => {
            e.preventDefault();
            soundEngine.stopEngine();
            soundEngine.stopMusic();
            setActiveView('GARAGE_MENU');
          }}
          className="text-2xl font-bold font-display tracking-wider text-slate-100 whitespace-nowrap shrink-0"
        >
          AERO-X 99
        </a>

        {/* Zone 2: 4 concise single-line text navigation links */}
        <nav className="flex items-center gap-6 text-sm font-medium text-slate-300 overflow-x-auto">
          <button
            type="button"
            onClick={() => {
              soundEngine.stopEngine();
              soundEngine.stopMusic();
              setActiveView('GARAGE_MENU');
            }}
            className={`hover:text-amber-400 transition-colors whitespace-nowrap shrink-0 cursor-pointer py-1 ${
              activeView === 'GARAGE_MENU'
                ? 'text-amber-400 underline underline-offset-8 decoration-2'
                : ''
            }`}
          >
            Hangar & Copa
          </button>
          <button
            type="button"
            onClick={handleStartRace}
            className={`hover:text-amber-400 transition-colors whitespace-nowrap shrink-0 cursor-pointer py-1 ${
              activeView === 'RACING'
                ? 'text-amber-400 underline underline-offset-8 decoration-2'
                : ''
            }`}
          >
            Pista en Vivo
          </button>
          <button
            type="button"
            onClick={() => {
              soundEngine.stopEngine();
              soundEngine.stopMusic();
              setActiveView('RECORDS');
            }}
            className={`hover:text-amber-400 transition-colors whitespace-nowrap shrink-0 cursor-pointer py-1 ${
              activeView === 'RECORDS'
                ? 'text-amber-400 underline underline-offset-8 decoration-2'
                : ''
            }`}
          >
            Récords
          </button>
          <button
            type="button"
            onClick={() => {
              soundEngine.stopEngine();
              soundEngine.stopMusic();
              setActiveView('CONTROLS');
            }}
            className={`hover:text-amber-400 transition-colors whitespace-nowrap shrink-0 cursor-pointer py-1 ${
              activeView === 'CONTROLS'
                ? 'text-amber-400 underline underline-offset-8 decoration-2'
                : ''
            }`}
          >
            Controles & Audio
          </button>
        </nav>

        {/* Zone 3: 1 primary action (PWA Install Button) */}
        <div className="flex items-center shrink-0">
          <PWAInstallButton />
        </div>
      </header>

      {/* ACTIVE RACE VIEWPORT */}
      {activeView === 'RACING' && (
        <RaceCanvas
          key={`${activeTrack.id}-${gpRoundIndex}-${selectedMode}`}
          craft={selectedCraft}
          track={activeTrack}
          mode={selectedMode}
          settings={settings}
          existingRecord={records[activeTrack.id]}
          gpRoundIndex={gpRoundIndex}
          gpTotalRounds={TRACKS.length}
          onFinishRace={handleFinishRace}
          onExitToMenu={handleExitFromRaceCanvas}
        />
      )}

      {/* HANGAR & GRAND PRIX SETUP VIEW */}
      {activeView === 'GARAGE_MENU' && (
        <main className="flex-1 w-full max-w-7xl mx-auto px-6 py-8 space-y-8">
          {recordBanner && (
            <div className="flex items-center justify-between gap-4 rounded-xl bg-emerald-950/60 border border-emerald-700/60 px-4 py-3 text-sm text-emerald-200">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{recordBanner}</span>
              </div>
              <button
                type="button"
                onClick={() => setRecordBanner(null)}
                className="text-xs text-emerald-300 hover:text-white underline whitespace-nowrap"
              >
                Cerrar
              </button>
            </div>
          )}

          {/* Hero Banner + Mode Selector Bar */}
          <section className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-6 border-b border-slate-800">
            <div className="max-w-2xl">
              <div className="text-xs font-medium text-amber-400">
                Liga Interplanetaria 2199 · Motor Pseudo-3D Mode 7 · Audio Chiptune Sintetizado
              </div>
              <h1
                className="text-4xl sm:text-5xl font-bold font-display text-slate-100 mt-1"
                style={{ textWrap: 'balance' }}
              >
                Velocidad Antigravedad a 1,500 km/h Sin Tiempos de Carga
              </h1>
              <p className="text-sm sm:text-base text-slate-300 mt-2 leading-relaxed">
                Gestiona tu reactor dual: cada impulso de <strong className="text-amber-400">Hyper-Boost</strong> consume energía de tu escudo magnético. Aprovecha los carriles esmeralda de recarga, las rampas de salto y los propulsores laterales para dominar la pista.
              </p>
            </div>

            {/* Interactive Mode Filter Controls + Audio Quick Toggle */}
            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <div className="flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-xl">
                {(
                  [
                    { id: 'GRAND_PRIX', label: 'Copa Grand Prix' },
                    { id: 'TIME_TRIAL', label: 'Contrarreloj' },
                    { id: 'QUICK_RACE', label: 'Carrera Rápida' },
                  ] as const
                ).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setSelectedMode(m.id)}
                    className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 min-h-[40px] ${
                      selectedMode === m.id
                        ? 'bg-amber-500 text-slate-950 shadow-sm'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() =>
                  setSettings((prev) => ({ ...prev, soundEnabled: !prev.soundEnabled }))
                }
                className="min-h-[42px] px-3.5 py-2 flex items-center gap-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-medium text-slate-200 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                aria-label="Alternar sonido"
              >
                {settings.soundEnabled ? (
                  <>
                    <Volume2 className="w-4 h-4 text-emerald-400" />
                    Audio ON
                  </>
                ) : (
                  <>
                    <VolumeX className="w-4 h-4 text-slate-400" />
                    Audio OFF
                  </>
                )}
              </button>
            </div>
          </section>

          {/* Main 2-Column Hangar Split: Left = Craft Selection, Right = Circuit & Launch */}
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
            {/* LEFT 7 COLUMNS: 4 Original Antigravity Machines */}
            <div className="lg:col-span-7 flex flex-col justify-between bg-slate-900/70 border border-slate-800 rounded-2xl p-6">
              <div>
                <div className="flex items-center justify-between gap-4 mb-4">
                  <div>
                    <h2 className="text-2xl font-bold font-display text-slate-100">
                      01. Selección de Nave Antigravedad
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      4 chasis originales con física de tracción, blindaje y postcombustión diferenciada
                    </p>
                  </div>
                  <div className="text-xs text-slate-400 font-mono-tabular">
                    Código: {selectedCraft.code}
                  </div>
                </div>

                {/* 4 Craft Selector Buttons */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {CRAFTS.map((craft) => {
                    const isSelected = craft.id === selectedCraft.id;
                    return (
                      <button
                        key={craft.id}
                        type="button"
                        onClick={() => setSelectedCraftId(craft.id)}
                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between min-h-[84px] ${
                          isSelected
                            ? 'bg-slate-800/95 border-amber-500 shadow-md'
                            : 'bg-slate-950/60 border-slate-800/90 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-mono-tabular text-slate-400">
                            {craft.code}
                          </span>
                          <span
                            className="w-3 h-3 rounded-sm shrink-0"
                            style={{ backgroundColor: craft.primaryColor }}
                          />
                        </div>
                        <div className="mt-2">
                          <div className="text-sm font-bold text-slate-100 truncate">
                            {craft.name}
                          </div>
                          <div className="text-[11px] text-slate-400 truncate">{craft.pilot}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Selected Craft Blueprint & Telemetry Bars */}
                <div className="mt-6 grid grid-cols-1 sm:grid-cols-12 gap-6 items-center pt-6 border-t border-slate-800/80">
                  <div className="sm:col-span-5 flex flex-col items-center justify-center bg-slate-950/70 border border-slate-800/80 rounded-xl p-4">
                    <CraftPreviewSvg craft={selectedCraft} className="w-full h-36" />
                    <div className="mt-2 text-center">
                      <div className="text-base font-bold text-slate-100">{selectedCraft.name}</div>
                      <div className="text-xs text-slate-400">
                        {selectedCraft.team} · Piloto: {selectedCraft.pilot}
                      </div>
                    </div>
                  </div>

                  <div className="sm:col-span-7 space-y-3">
                    <p className="text-xs text-slate-300 leading-relaxed">
                      {selectedCraft.tagline}
                    </p>

                    {(
                      [
                        {
                          label: 'Velocidad Punta',
                          val: selectedCraft.stats.topSpeed,
                          display: `${selectedCraft.physics.maxSpeedKmh} km/h`,
                        },
                        {
                          label: 'Aceleración Ion',
                          val: selectedCraft.stats.acceleration,
                          display: `${selectedCraft.stats.acceleration}/100`,
                        },
                        {
                          label: 'Agarre Magnético',
                          val: selectedCraft.stats.grip,
                          display: `${selectedCraft.stats.grip}/100`,
                        },
                        {
                          label: 'Blindaje de Escudo',
                          val: selectedCraft.stats.shield,
                          display: `${selectedCraft.stats.shield}/100`,
                        },
                        {
                          label: 'Potencia Hyper-Boost',
                          val: selectedCraft.stats.boostPower,
                          display: `${selectedCraft.stats.boostPower}/100`,
                        },
                      ] as const
                    ).map((stat) => (
                      <div key={stat.label}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-slate-300 font-medium">{stat.label}</span>
                          <span className="font-mono-tabular text-slate-200 font-semibold">
                            {stat.display}
                          </span>
                        </div>
                        <div className="w-full h-2 bg-slate-950 rounded-sm overflow-hidden">
                          <div
                            className="h-full rounded-sm transition-all duration-200"
                            style={{
                              width: `${stat.val}%`,
                              backgroundColor: selectedCraft.primaryColor,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                <span>Propulsión: Doble Turbina Vectorial</span>
                <span>·</span>
                <span>Recarga: Bandas Esmeralda en Pit Lane</span>
                <span>·</span>
                <span>Inclinación Lateral: Q / E o Táctil</span>
              </div>
            </div>

            {/* RIGHT 5 COLUMNS: Circuit Selection & Start Race CTA */}
            <div className="lg:col-span-5 flex flex-col justify-between bg-slate-900/70 border border-slate-800 rounded-2xl p-6">
              <div>
                <div className="flex items-center justify-between gap-4 mb-4">
                  <div>
                    <h2 className="text-2xl font-bold font-display text-slate-100">
                      02. Circuito & Lanzamiento
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {selectedMode === 'GRAND_PRIX'
                        ? 'La Copa Grand Prix recorre los 3 sectores en orden consecutivo'
                        : 'Selecciona el trazado para tu sesión individual'}
                    </p>
                  </div>
                </div>

                {/* Track Cards List */}
                <div className="space-y-3">
                  {TRACKS.map((track, idx) => {
                    const isSelected =
                      selectedMode === 'GRAND_PRIX' ? true : track.id === selectedTrackId;
                    const rec = records[track.id];
                    return (
                      <div
                        key={track.id}
                        onClick={() => {
                          if (selectedMode !== 'GRAND_PRIX') {
                            setSelectedTrackId(track.id);
                          }
                        }}
                        className={`p-3.5 rounded-xl border transition-all flex items-center justify-between gap-4 ${
                          selectedMode !== 'GRAND_PRIX' ? 'cursor-pointer' : ''
                        } ${
                          track.id === selectedTrackId || selectedMode === 'GRAND_PRIX'
                            ? 'bg-slate-800/90 border-slate-700'
                            : 'bg-slate-950/50 border-slate-800/80 hover:border-slate-700 opacity-75'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-[11px] text-slate-400">
                            Ronda 0{idx + 1} · {track.planet} · Dificultad {track.difficulty}
                          </div>
                          <div className="text-base font-bold text-slate-100 truncate mt-0.5">
                            {track.name}
                          </div>
                          <div className="text-xs text-slate-300 mt-1 line-clamp-2">
                            {track.description}
                          </div>
                          <div className="mt-2 flex items-center gap-3 text-xs text-slate-400 font-mono-tabular">
                            <span>{track.lengthKm} km</span>
                            <span>·</span>
                            <span>{track.laps} vueltas</span>
                            <span>·</span>
                            <span className="text-amber-400">
                              Mejor Vuelta: {rec ? formatRaceTime(rec.bestLapMs) : '--:--.---'}
                            </span>
                          </div>
                        </div>
                        {handleTrackMinimapPreview(track)}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Primary Launch CTA */}
              <div className="mt-6 pt-5 border-t border-slate-800">
                <button
                  type="button"
                  onClick={handleStartRace}
                  className="w-full min-h-[52px] px-6 py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-[0.99] text-slate-950 font-bold text-base flex items-center justify-center gap-2.5 shadow-lg transition-all cursor-pointer whitespace-nowrap"
                >
                  <Play className="w-5 h-5 fill-current" />
                  {selectedMode === 'GRAND_PRIX'
                    ? 'Iniciar Campeonato Grand Prix (3 Pistas)'
                    : selectedMode === 'TIME_TRIAL'
                    ? `Iniciar Contrarreloj en ${activeTrack.name}`
                    : `Iniciar Carrera Rápida en ${activeTrack.name}`}
                </button>
              </div>
            </div>
          </section>
        </main>
      )}

      {/* RECORDS & CHAMPIONSHIP TROPHIES VIEW */}
      {activeView === 'RECORDS' && (
        <main className="flex-1 w-full max-w-7xl mx-auto px-6 py-8 space-y-8">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-slate-800">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold font-display text-slate-100">
                Archivo de Récords & Telemetría Oficial
              </h1>
              <p className="text-sm text-slate-400 mt-1">
                Tiempos almacenados localmente en el dispositivo para juego offline y fantasmas de Contrarreloj
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                const defaults = resetAllRecords();
                setRecords(defaults);
                setGpTrophies([]);
              }}
              className="min-h-[42px] px-4 py-2 rounded-xl border border-slate-700 hover:bg-slate-800 text-xs font-semibold text-slate-300 flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
            >
              <RotateCcw className="w-4 h-4" />
              Restablecer Récords de Fábrica
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TRACKS.map((track) => {
              const rec = records[track.id];
              const usedCraft = CRAFTS.find((c) => c.id === rec?.craftId) ?? CRAFTS[0];
              return (
                <div
                  key={track.id}
                  className="bg-slate-900/75 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between"
                >
                  <div>
                    <div className="text-xs text-slate-400">{track.sector}</div>
                    <h2 className="text-2xl font-bold font-display text-slate-100 mt-0.5">
                      {track.name}
                    </h2>

                    <div className="mt-5 space-y-3 pt-4 border-t border-slate-800/80 font-mono-tabular">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-400 font-sans">Mejor Vuelta Rápida</span>
                        <span className="text-emerald-400 font-bold">
                          {rec ? formatRaceTime(rec.bestLapMs) : '--:--.---'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-400 font-sans">Tiempo Total (3 Vueltas)</span>
                        <span className="text-slate-100 font-semibold">
                          {rec ? formatRaceTime(rec.bestTotalMs) : '--:--.---'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-800/60">
                        <span className="text-slate-400 font-sans">Nave Registrada</span>
                        <span className="text-slate-200 font-sans font-medium">
                          {usedCraft.name} · {rec?.pilotName}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400 font-sans">Fantasma Contrarreloj</span>
                        <span className="text-amber-400 font-sans font-medium">
                          {rec?.ghostSamples && rec.ghostSamples.length > 0
                            ? `Activo (${rec.ghostSamples.length} muestras)`
                            : 'Disponible al completar pista'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedMode('TIME_TRIAL');
                      setSelectedTrackId(track.id);
                      setActiveView('RACING');
                    }}
                    className="mt-6 w-full min-h-[42px] rounded-xl bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-100 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
                  >
                    Desafiar Récord en Contrarreloj
                  </button>
                </div>
              );
            })}
          </div>

          {/* Grand Prix Trophies History */}
          <div className="bg-slate-900/75 border border-slate-800 rounded-2xl p-6">
            <div className="flex items-center gap-2.5 mb-4">
              <Award className="w-5 h-5 text-amber-400" />
              <h2 className="text-xl font-bold font-display text-slate-100">
                Historial de Copas Grand Prix Completadas
              </h2>
            </div>

            {gpTrophies.length === 0 ? (
              <p className="text-sm text-slate-400">
                Aún no has finalizado una Copa Grand Prix de 3 circuitos. Selecciona el modo Copa Grand Prix en el Hangar para competir por el trofeo.
              </p>
            ) : (
              <div className="divide-y divide-slate-800 border border-slate-800 rounded-xl">
                {gpTrophies.map((t, i) => (
                  <div
                    key={`${t.dateStr}-${i}`}
                    className="flex items-center justify-between px-4 py-3 text-sm"
                  >
                    <div className="flex items-center gap-3">
                      <Trophy
                        className={`w-4 h-4 ${
                          t.rank === 1 ? 'text-amber-400' : 'text-slate-400'
                        }`}
                      />
                      <span className="font-bold text-slate-100">Posición Final: {t.rank}º</span>
                      <span className="text-slate-400">·</span>
                      <span className="text-slate-300">{t.craftName}</span>
                    </div>
                    <div className="font-mono-tabular text-xs text-slate-300">
                      <strong className="text-amber-400">{t.totalPoints} pts</strong> · {t.dateStr}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      )}

      {/* CONTROLS & AUDIO CONFIGURATION VIEW */}
      {activeView === 'CONTROLS' && (
        <main className="flex-1 w-full max-w-7xl mx-auto px-6 py-8 space-y-8">
          <div className="pb-6 border-b border-slate-800">
            <h1 className="text-3xl sm:text-4xl font-bold font-display text-slate-100">
              Esquema de Controles & Sintetizador de Audio
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Soporte simultáneo para Teclado, Mando Gamepad USB/Bluetooth y Controles Táctiles en Pantalla
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Control Mapping Reference */}
            <div className="bg-slate-900/75 border border-slate-800 rounded-2xl p-6 space-y-5">
              <div className="flex items-center gap-2.5">
                <Gamepad2 className="w-5 h-5 text-amber-400" />
                <h2 className="text-xl font-bold font-display text-slate-100">
                  Mapeo Universal de Cabina
                </h2>
              </div>

              <div className="divide-y divide-slate-800 text-sm">
                <div className="py-3 flex items-center justify-between gap-4">
                  <span className="text-slate-300">Acelerador Principal</span>
                  <span className="font-mono-tabular text-xs text-slate-100">
                    Tecla W / Flecha Arriba / Gamepad A o RT
                  </span>
                </div>
                <div className="py-3 flex items-center justify-between gap-4">
                  <span className="text-slate-300">Dirección Izquierda / Derecha</span>
                  <span className="font-mono-tabular text-xs text-slate-100">
                    Teclas A, D / Flechas ←, → / Stick Izquierdo
                  </span>
                </div>
                <div className="py-3 flex items-center justify-between gap-4">
                  <span className="text-slate-300">Inclinación Magnética (Strafe L/R)</span>
                  <span className="font-mono-tabular text-xs text-slate-100">
                    Teclas Q, E (o Z, C) / Botones LB, RB
                  </span>
                </div>
                <div className="py-3 flex items-center justify-between gap-4">
                  <span className="text-slate-300">Activar Hyper-Boost (Consume Escudo)</span>
                  <span className="font-mono-tabular text-xs text-amber-400 font-semibold">
                    Espacio / Shift / Tecla X / Gamepad X o Y
                  </span>
                </div>
                <div className="py-3 flex items-center justify-between gap-4">
                  <span className="text-slate-300">Freno Aerodinámico</span>
                  <span className="font-mono-tabular text-xs text-slate-100">
                    Tecla S / Flecha Abajo / Gamepad B o LT
                  </span>
                </div>
                <div className="py-3 flex items-center justify-between gap-4">
                  <span className="text-slate-300">Pausa Táctica</span>
                  <span className="font-mono-tabular text-xs text-slate-100">
                    Tecla Esc o P
                  </span>
                </div>
              </div>
            </div>

            {/* Audio & Ergonomics Settings */}
            <div className="bg-slate-900/75 border border-slate-800 rounded-2xl p-6 space-y-6">
              <div className="flex items-center gap-2.5">
                <Sliders className="w-5 h-5 text-amber-400" />
                <h2 className="text-xl font-bold font-display text-slate-100">
                  Ajustes de Cabina & Sintetizador Web Audio
                </h2>
              </div>

              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-slate-100">
                      Sintetizador de Audio General
                    </div>
                    <div className="text-xs text-slate-400">
                      Genera el motor antigravedad y la música 16-bits sin descargas externas
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setSettings((s) => ({ ...s, soundEnabled: !s.soundEnabled }))
                    }
                    className={`min-h-[40px] px-4 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                      settings.soundEnabled
                        ? 'bg-emerald-500 text-slate-950'
                        : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    {settings.soundEnabled ? 'Activado' : 'Silenciado'}
                  </button>
                </div>

                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-slate-300 font-medium">
                      Volumen Música Synth-Rock 16-Bits
                    </span>
                    <span className="font-mono-tabular text-slate-200">
                      {Math.round(settings.musicVolume * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={settings.musicVolume}
                    onChange={(e) =>
                      setSettings((s) => ({ ...s, musicVolume: parseFloat(e.target.value) }))
                    }
                    className="w-full accent-amber-500 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-slate-300 font-medium">
                      Volumen Turbina & Efectos de Pista
                    </span>
                    <span className="font-mono-tabular text-slate-200">
                      {Math.round(settings.sfxVolume * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={settings.sfxVolume}
                    onChange={(e) =>
                      setSettings((s) => ({ ...s, sfxVolume: parseFloat(e.target.value) }))
                    }
                    className="w-full accent-amber-500 cursor-pointer"
                  />
                </div>

                <div className="pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold text-slate-100">
                      Controles Táctiles en Pantalla
                    </div>
                    <div className="text-xs text-slate-400">
                      Muestra los pedales y dirección táctil en la zona inferior
                    </div>
                  </div>
                  <div className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-xl">
                    {(
                      [
                        { id: 'AUTO', label: 'Automático' },
                        { id: 'ALWAYS', label: 'Siempre Visible' },
                        { id: 'OFF', label: 'Oculto' },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() =>
                          setSettings((s) => ({ ...s, showTouchControls: opt.id }))
                        }
                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                          settings.showTouchControls === opt.id
                            ? 'bg-amber-500 text-slate-950'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      )}

      {/* GRAND PRIX FINAL CHAMPIONSHIP CEREMONY MODAL */}
      {gpCompleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="w-full max-w-xl rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div>
                <div className="text-xs font-semibold text-amber-400">
                  Campeonato Oficial AERO-X 99 Finalizado
                </div>
                <h2 className="text-3xl font-bold font-display text-slate-100 mt-0.5 flex items-center gap-2">
                  <Trophy className="w-7 h-7 text-amber-400" />
                  Clasificación General · {gpCompleteModal.playerRank}º Puesto
                </h2>
              </div>
              <div className="text-right font-mono-tabular">
                <div className="text-xs text-slate-400">Puntos Totales</div>
                <div className="text-2xl font-bold text-amber-400">
                  {gpCompleteModal.playerPoints} pts
                </div>
              </div>
            </div>

            <div className="mt-4 max-h-60 overflow-y-auto divide-y divide-slate-800 border border-slate-800 rounded-xl">
              {gpCompleteModal.standings.map((st, idx) => (
                <div
                  key={st.id}
                  className={`flex items-center justify-between px-4 py-2.5 text-sm ${
                    st.isPlayer ? 'bg-amber-500/15 text-amber-200 font-semibold' : 'text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 font-mono-tabular text-slate-400">{idx + 1}.</span>
                    <span
                      className="w-3 h-3 rounded-sm"
                      style={{ backgroundColor: st.primaryColor }}
                    />
                    <span>{st.name}</span>
                    <span className="text-xs text-slate-400">· {st.craftName}</span>
                  </div>
                  <span className="font-mono-tabular font-bold text-amber-400">
                    {st.points} pts
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setGpCompleteModal(null)}
                className="min-h-[44px] px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-colors cursor-pointer whitespace-nowrap"
              >
                Cerrar Ceremonia
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quiet Footer */}
      {activeView !== 'RACING' && (
        <footer className="mt-auto border-t border-slate-800/80 py-4 px-6 text-xs text-slate-400 flex flex-wrap items-center justify-between gap-4 max-w-7xl w-full mx-auto">
          <div className="flex items-center gap-2">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>AERO-X 99 · Propiedad Intelectual, Naves y Audio Sintetizado 100% Originales</span>
          </div>
          <div>PWA Offline-Ready · HTML5 Mode-7 Canvas Engine</div>
        </footer>
      )}

      <OfflineIndicator />
    </div>
  );
}
