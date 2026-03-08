import { useCallback, useEffect, useRef, useState } from 'react';
import SpacePage from './pages/SpacePage';
import { CONFIG } from './config';
import { SPACE_COPY, type SpaceLocale } from './content/spaceCopy';
import type { StarSelectionData } from './types';
import './App.css';

type AppPhase = 'prologue' | 'flight' | 'ending';
type RestartControlKey = 'KeyW' | 'KeyA' | 'KeyS' | 'KeyD';

type SeedState = { used: number; remaining: number; total: number };
type Verse = { id: number; text: string };
type AimedStarData = (StarSelectionData & { distance?: number; headingOffsetDeg?: number }) | null;

const DEFAULT_SEED_LIMIT = 3;
const AUTO_END_RESET_MS = 20_000;
const VERSE_DURATION_MS = 2100;
const CONTROL_GUIDE_DURATION_MS = 7_500;
const INACTIVITY_RESET_MS = 30_000;
const PROLOGUE_LAUNCH_DELAY_MS = 1_000;
const RESTART_CONTROL_KEY_LABELS: Record<RestartControlKey, 'W' | 'A' | 'S' | 'D'> = {
  KeyW: 'W',
  KeyA: 'A',
  KeyS: 'S',
  KeyD: 'D',
};

const parseSeedLimit = () => {
  if (typeof window === 'undefined') return DEFAULT_SEED_LIMIT;
  const params = new URLSearchParams(window.location.search);
  const value = Number(params.get('seeds'));
  if (!Number.isFinite(value) || value <= 0) return DEFAULT_SEED_LIMIT;
  return Math.max(1, Math.floor(value));
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const isRestartControlKey = (code: string): code is RestartControlKey => code in RESTART_CONTROL_KEY_LABELS;
const isSpaceKey = (event: KeyboardEvent) =>
  event.code === 'Space' || event.key === ' ' || event.key === 'Spacebar';
const localeFromControlKey = (code: RestartControlKey): SpaceLocale =>
  code === 'KeyW' || code === 'KeyA' ? 'ko' : 'en';

const PROLOGUE_KEYCAP_LAYOUT: Array<{ code: RestartControlKey; label: 'W' | 'A' | 'S' | 'D'; x: number; y: number }> = [
  { code: 'KeyW', label: 'W', x: 88, y: 0 },
  { code: 'KeyA', label: 'A', x: 0, y: 88 },
  { code: 'KeyS', label: 'S', x: 88, y: 88 },
  { code: 'KeyD', label: 'D', x: 176, y: 88 },
];

function PrologueWasdGlyph({
  activeKey,
  launching,
  ariaLabel,
}: {
  activeKey: RestartControlKey | null;
  launching: boolean;
  ariaLabel: string;
}) {
  return (
    <svg viewBox="0 0 264 176" className="prologue-wasd-svg" role="img" aria-label={ariaLabel}>
      <defs>
        <filter id="prologueKeyGlow" x="-35%" y="-35%" width="170%" height="170%">
          <feGaussianBlur stdDeviation="7" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {PROLOGUE_KEYCAP_LAYOUT.map(({ code, label, x, y }) => {
        const isActive = activeKey === code;
        const keyFill = isActive ? 'rgba(255, 226, 138, 0.9)' : 'rgba(10, 20, 39, 0.82)';
        const keyStroke = isActive ? 'rgba(255, 237, 179, 0.95)' : 'rgba(208, 235, 255, 0.35)';
        const keyText = isActive ? '#08101f' : 'rgba(241, 249, 255, 0.92)';
        return (
          <g key={code} transform={`translate(${x} ${y})`} filter={isActive ? 'url(#prologueKeyGlow)' : undefined}>
            <rect
              x="6"
              y="10"
              width="76"
              height="76"
              rx="18"
              fill="rgba(0, 0, 0, 0.22)"
              opacity={launching && !isActive ? 0.4 : 1}
            />
            <rect
              width="76"
              height="76"
              rx="18"
              fill={keyFill}
              stroke={keyStroke}
              strokeWidth="2.2"
              opacity={launching && !isActive ? 0.58 : 1}
            />
            <path
              d="M14 20H62"
              stroke={isActive ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.12)'}
              strokeWidth="2"
              strokeLinecap="round"
            />
            <text
              x="38"
              y="48"
              textAnchor="middle"
              dominantBaseline="middle"
              fill={keyText}
              fontSize="28"
              fontWeight="700"
              fontFamily="NanumGothicCustom, sans-serif"
              letterSpacing="1.5"
            >
              {label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export default function App() {
  const [phase, setPhase] = useState<AppPhase>('prologue');
  const [locale, setLocale] = useState<SpaceLocale>('ko');
  const [prologueLocale, setPrologueLocale] = useState<SpaceLocale>('ko');
  const [seedLimit] = useState(() => parseSeedLimit());
  const [seedState, setSeedState] = useState<SeedState>({
    used: 0,
    remaining: seedLimit,
    total: seedLimit,
  });
  const [verse, setVerse] = useState<Verse | null>(null);
  const [showControlGuide, setShowControlGuide] = useState(false);
  const [plantedWords, setPlantedWords] = useState<string[]>([]);
  const [voyageEpoch, setVoyageEpoch] = useState(0);
  const [hasFirstLod, setHasFirstLod] = useState(false);
  const [hasFirstAim, setHasFirstAim] = useState(false);
  const [hasRemainingOne, setHasRemainingOne] = useState(false);
  const [prologueSelectionKey, setPrologueSelectionKey] = useState<RestartControlKey | null>(null);
  const [isPrologueLaunching, setIsPrologueLaunching] = useState(false);
  const [endingRestartInput, setEndingRestartInput] = useState<{ key: RestartControlKey | null; count: number }>({
    key: null,
    count: 0,
  });

  const verseTimerRef = useRef<number | null>(null);
  const guideTimerRef = useRef<number | null>(null);
  const endResetTimerRef = useRef<number | null>(null);
  const inactivityTimerRef = useRef<number | null>(null);
  const prologueLaunchTimerRef = useRef<number | null>(null);
  const endingRestartInputRef = useRef<{ key: RestartControlKey | null; count: number }>({
    key: null,
    count: 0,
  });

  const copy = SPACE_COPY[locale];
  const prologueCopy = SPACE_COPY[prologueLocale];

  const stopVerse = useCallback(() => {
    if (verseTimerRef.current !== null) {
      window.clearTimeout(verseTimerRef.current);
      verseTimerRef.current = null;
    }
  }, []);

  const publishVerse = useCallback(
    (text: string, durationMs = VERSE_DURATION_MS) => {
      stopVerse();
      setVerse({ id: Date.now(), text });
      verseTimerRef.current = window.setTimeout(() => {
        setVerse(null);
        verseTimerRef.current = null;
      }, durationMs);
    },
    [stopVerse],
  );

  const clearGuideTimer = useCallback(() => {
    if (guideTimerRef.current !== null) {
      window.clearTimeout(guideTimerRef.current);
      guideTimerRef.current = null;
    }
  }, []);

  const clearResetTimer = useCallback(() => {
    if (endResetTimerRef.current !== null) {
      window.clearTimeout(endResetTimerRef.current);
      endResetTimerRef.current = null;
    }
  }, []);

  const clearInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current !== null) {
      window.clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }
  }, []);

  const clearPrologueLaunchTimer = useCallback(() => {
    if (prologueLaunchTimerRef.current !== null) {
      window.clearTimeout(prologueLaunchTimerRef.current);
      prologueLaunchTimerRef.current = null;
    }
  }, []);

  const resetPrologueLaunch = useCallback(() => {
    clearPrologueLaunchTimer();
    setPrologueSelectionKey(null);
    setIsPrologueLaunching(false);
  }, [clearPrologueLaunchTimer]);

  const syncEndingRestartInput = useCallback((next: { key: RestartControlKey | null; count: number }) => {
    endingRestartInputRef.current = next;
    setEndingRestartInput(next);
  }, []);

  const beginControlGuide = useCallback(() => {
    clearGuideTimer();
    setShowControlGuide(true);
    guideTimerRef.current = window.setTimeout(() => {
      setShowControlGuide(false);
      guideTimerRef.current = null;
    }, CONTROL_GUIDE_DURATION_MS);
  }, [clearGuideTimer]);

  const resetForNewVoyage = useCallback(() => {
    setSeedState({ used: 0, remaining: seedLimit, total: seedLimit });
    setPlantedWords([]);
    setHasFirstAim(false);
    setHasFirstLod(false);
    setHasRemainingOne(false);
    setVoyageEpoch((current) => current + 1);
  }, [seedLimit]);

  const startFlight = useCallback(
    (nextLocale: SpaceLocale = locale) => {
      setLocale(nextLocale);
      setPrologueLocale(nextLocale);
      resetPrologueLaunch();
      syncEndingRestartInput({ key: null, count: 0 });
      setPhase('flight');
      resetForNewVoyage();
      setSeedState({ used: 0, remaining: seedLimit, total: seedLimit });
      publishVerse(SPACE_COPY[nextLocale].triggers.startFlight);
      beginControlGuide();
    },
    [beginControlGuide, locale, publishVerse, resetForNewVoyage, resetPrologueLaunch, seedLimit, syncEndingRestartInput],
  );

  const finishVoyage = useCallback(() => {
    syncEndingRestartInput({ key: null, count: 0 });
    setPhase('ending');
    clearGuideTimer();
    setShowControlGuide(false);
    publishVerse(SPACE_COPY[locale].triggers.end);
    clearResetTimer();
    endResetTimerRef.current = window.setTimeout(() => {
      setPhase('flight');
      resetForNewVoyage();
      publishVerse(SPACE_COPY[locale].triggers.startFlight);
      beginControlGuide();
      clearResetTimer();
    }, AUTO_END_RESET_MS);
  }, [beginControlGuide, clearGuideTimer, clearResetTimer, locale, publishVerse, resetForNewVoyage, syncEndingRestartInput]);

  const returnToPrologue = useCallback(() => {
    clearInactivityTimer();
    clearGuideTimer();
    clearResetTimer();
    resetPrologueLaunch();
    syncEndingRestartInput({ key: null, count: 0 });
    stopVerse();
    setVerse(null);
    setShowControlGuide(false);
    setPhase('prologue');
    setPrologueLocale(locale);
    resetForNewVoyage();
  }, [
    clearGuideTimer,
    clearInactivityTimer,
    clearResetTimer,
    locale,
    resetForNewVoyage,
    resetPrologueLaunch,
    stopVerse,
    syncEndingRestartInput,
  ]);

  useEffect(() => {
    return () => {
      stopVerse();
      clearGuideTimer();
      clearResetTimer();
      clearInactivityTimer();
      clearPrologueLaunchTimer();
    };
  }, [clearGuideTimer, clearInactivityTimer, clearPrologueLaunchTimer, clearResetTimer, stopVerse]);

  useEffect(() => {
    if (phase !== 'ending') {
      clearResetTimer();
      return;
    }

    return () => {
      clearResetTimer();
    };
  }, [clearResetTimer, phase]);

  useEffect(() => {
    if (phase !== 'prologue') {
      return;
    }

    const handlePrologueKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || prologueLaunchTimerRef.current !== null) {
        return;
      }

      if (isRestartControlKey(event.code)) {
        event.preventDefault();
        setPrologueSelectionKey(event.code);
        setPrologueLocale(localeFromControlKey(event.code));
        return;
      }

      if (!isSpaceKey(event)) {
        return;
      }

      event.preventDefault();
      setLocale(prologueLocale);
      setIsPrologueLaunching(true);
      clearPrologueLaunchTimer();
      prologueLaunchTimerRef.current = window.setTimeout(() => {
        prologueLaunchTimerRef.current = null;
        startFlight(prologueLocale);
      }, PROLOGUE_LAUNCH_DELAY_MS);
    };

    const handlePrologueKeyUp = (event: KeyboardEvent) => {
      if (isRestartControlKey(event.code)) {
        setPrologueSelectionKey((current) => (current === event.code ? null : current));
      }
    };

    window.addEventListener('keydown', handlePrologueKeyDown);
    window.addEventListener('keyup', handlePrologueKeyUp);
    return () => {
      window.removeEventListener('keydown', handlePrologueKeyDown);
      window.removeEventListener('keyup', handlePrologueKeyUp);
    };
  }, [clearPrologueLaunchTimer, phase, prologueLocale, startFlight]);

  useEffect(() => {
    if (phase !== 'flight') {
      clearInactivityTimer();
      return;
    }

    const armInactivityTimer = () => {
      clearInactivityTimer();
      inactivityTimerRef.current = window.setTimeout(() => {
        returnToPrologue();
      }, INACTIVITY_RESET_MS);
    };

    const handleActivity = () => {
      armInactivityTimer();
    };

    window.addEventListener('keydown', handleActivity);
    window.addEventListener('keyup', handleActivity);
    window.addEventListener('pointerdown', handleActivity);
    window.addEventListener('pointermove', handleActivity);
    window.addEventListener('wheel', handleActivity, { passive: true });
    window.addEventListener('touchstart', handleActivity, { passive: true });

    armInactivityTimer();

    return () => {
      clearInactivityTimer();
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('keyup', handleActivity);
      window.removeEventListener('pointerdown', handleActivity);
      window.removeEventListener('pointermove', handleActivity);
      window.removeEventListener('wheel', handleActivity);
      window.removeEventListener('touchstart', handleActivity);
    };
  }, [clearInactivityTimer, phase, returnToPrologue]);

  const canPlant = () => phase === 'flight' && seedState.remaining > 0;

  const handleSeedStateChange = useCallback(
    (next: SeedState) => {
      setSeedState(next);
      if (phase !== 'flight') return;

      if (next.remaining === 1 && !hasRemainingOne && next.total > 1) {
        setHasRemainingOne(true);
        publishVerse(SPACE_COPY[locale].triggers.remainingOne);
      }

      if (next.remaining <= 0 && seedState.remaining > 0) {
        finishVoyage();
      }
    },
    [finishVoyage, hasRemainingOne, locale, phase, publishVerse, seedState.remaining],
  );

  const handleAimChange = useCallback(
    (next: AimedStarData) => {
      if (!next) return;

      if (!hasFirstAim) {
        setHasFirstAim(true);
        publishVerse(SPACE_COPY[locale].triggers.firstAim);
      }

      if (!hasFirstLod && next.distance !== undefined && next.distance < CONFIG.TEXT_LOD_DISTANCE) {
        setHasFirstLod(true);
        publishVerse(SPACE_COPY[locale].triggers.firstLod);
      }
    },
    [hasFirstAim, hasFirstLod, locale, publishVerse],
  );

  const handlePlantHoldEvent = useCallback(
    (event: { type: 'start' | 'cancel' | 'complete'; target: StarSelectionData | null }) => {
      if (event.type === 'start') {
        publishVerse(SPACE_COPY[locale].triggers.plantStart);
      }
      if (event.type === 'complete') {
        publishVerse(SPACE_COPY[locale].triggers.plantComplete);
      }
    },
    [locale, publishVerse],
  );

  const handlePlantBlocked = useCallback(() => {
    publishVerse(SPACE_COPY[locale].triggers.blocked);
  }, [locale, publishVerse]);

  const handleSeedCommit = useCallback(
    (entry: { id?: number | string; word: string; color: string; params: StarSelectionData['params'] }) => {
      setPlantedWords((current) => {
        if (current.includes(entry.word)) return current;
        return [...current, entry.word];
      });
    },
    [],
  );

  const handleReturnToMainFromEnding = useCallback(() => {
    returnToPrologue();
  }, [returnToPrologue]);

  useEffect(() => {
    if (phase !== 'ending') {
      syncEndingRestartInput({ key: null, count: 0 });
      return;
    }

    const handleEndingRestartInput = (event: KeyboardEvent) => {
      if (event.repeat || !isRestartControlKey(event.code)) {
        return;
      }

      event.preventDefault();

      const current = endingRestartInputRef.current;
      const next =
        current.key === event.code
          ? { key: event.code, count: current.count + 1 }
          : { key: event.code, count: 1 };

      if (next.count >= 2) {
        syncEndingRestartInput({ key: null, count: 0 });
        handleReturnToMainFromEnding();
        return;
      }

      syncEndingRestartInput(next);
    };

    window.addEventListener('keydown', handleEndingRestartInput);
    return () => {
      window.removeEventListener('keydown', handleEndingRestartInput);
    };
  }, [handleReturnToMainFromEnding, phase, syncEndingRestartInput]);

  const endingRestartPrompt =
    endingRestartInput.key === null
      ? copy.ending.restartPromptIdle
      : copy.ending.restartPromptActive(RESTART_CONTROL_KEY_LABELS[endingRestartInput.key]);
  const prologueLaunchPrompt = isPrologueLaunching
    ? prologueCopy.prologue.statusLaunching(
        PROLOGUE_LAUNCH_DELAY_MS / 1000,
        prologueCopy.languageOptions.find((option) => option.id === prologueLocale)?.label ?? prologueCopy.localeLabel,
      )
    : prologueCopy.prologue.statusIdle;

  const verseOverlay = verse ? (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        bottom: '10vh',
        transform: 'translateX(-50%)',
        padding: '10px 14px',
        maxWidth: 540,
        color: '#f0f9ff',
        background: 'rgba(5, 12, 26, 0.85)',
        border: '1px solid rgba(185, 225, 255, 0.32)',
        borderRadius: 999,
        zIndex: 40,
        pointerEvents: 'none',
        fontSize: 13,
        textAlign: 'center',
        animation: 'space-label-ink-reveal 0.45s cubic-bezier(0.21, 0.61, 0.35, 1)',
      }}
      key={verse.id}
    >
      {verse.text}
    </div>
  ) : null;

  const controlGuide = showControlGuide ? (
    <div
      style={{
        position: 'absolute',
        top: 20,
        right: 20,
        color: '#eaf6ff',
        fontSize: 13,
        lineHeight: 1.6,
        pointerEvents: 'none',
        zIndex: 25,
        background: 'rgba(7, 16, 34, 0.7)',
        border: '1px solid rgba(180, 230, 255, 0.35)',
        borderRadius: 12,
        padding: '10px 12px',
        maxWidth: 280,
      }}
    >
      <div>{copy.controlGuide.remainingSeeds(seedState.remaining, seedState.total)}</div>
      <div style={{ marginTop: 4 }}>{copy.controlGuide.controls}</div>
      <div style={{ marginTop: 2 }}>{copy.controlGuide.gardenSync}</div>
    </div>
  ) : null;

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden', background: 'black' }}>
      {phase === 'flight' && (
        <SpacePage
          key={voyageEpoch}
          locale={locale}
          initialSeedLimit={seedLimit}
          onSeedStateChange={handleSeedStateChange}
          onSeedCommit={handleSeedCommit}
          onAimChange={handleAimChange}
          onPlantHoldEvent={handlePlantHoldEvent}
          onPlantBlocked={handlePlantBlocked}
          canPlant={canPlant}
        />
      )}

      {phase === 'prologue' && (
        <div
          className={`prologue-screen${isPrologueLaunching ? ' prologue-launching' : ''}`}
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 20,
            background: 'rgba(2, 6, 15, 0.93)',
            color: '#eaf5ff',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '6vh 4vw',
            gap: 22,
            textAlign: 'center',
          }}
        >
          <div className="prologue-launch-overlay" aria-hidden="true" />
          <div style={{ maxWidth: 760, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {prologueCopy.prologue.lines.map((line) => (
              <div key={line} style={{ fontSize: 22, lineHeight: 1.55, fontWeight: 300 }}>
                {line}
              </div>
            ))}
          </div>
          <div className="prologue-kbd-stage">
            <div className="prologue-kbd-panel">
              <PrologueWasdGlyph
                activeKey={prologueSelectionKey}
                launching={isPrologueLaunching}
                ariaLabel={prologueCopy.prologue.keyboardAriaLabel}
              />
              <div className="prologue-kbd-copy">
                <div className="prologue-kbd-title">{prologueCopy.prologue.keyboardTitle}</div>
                <div className="prologue-kbd-status">{prologueLaunchPrompt}</div>
                <div className="prologue-language-panel">
                  <div className="prologue-language-title">{prologueCopy.prologue.languageTitle}</div>
                  <div className="prologue-language-options">
                    {prologueCopy.languageOptions.map((option) => {
                      const selected = option.id === prologueLocale;
                      return (
                        <div
                          key={option.id}
                          className={`prologue-language-option${selected ? ' is-selected' : ''}`}
                          aria-selected={selected}
                        >
                          <div className="prologue-language-hint">{option.hint}</div>
                          <div className="prologue-language-label">{option.label}</div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="prologue-kbd-meta">{prologueCopy.prologue.languageHint}</div>
                  <div className="prologue-kbd-meta">{prologueCopy.prologue.confirmHint}</div>
                </div>
                <div className="prologue-kbd-meta">{prologueCopy.prologue.metaControls}</div>
                <div className="prologue-kbd-meta">{prologueCopy.prologue.metaGarden}</div>
              </div>
            </div>
          </div>
          <div className="prologue-seed-note">{prologueCopy.prologue.seedNote(clamp(seedLimit, 1, 10))}</div>
        </div>
      )}

      {phase === 'ending' && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 30,
            background: 'rgba(0, 0, 0, 0.86)',
            color: '#ecf4ff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            flexDirection: 'column',
            gap: 14,
            padding: 24,
          }}
        >
          <div style={{ fontSize: 24, letterSpacing: 0.4 }}>{copy.ending.title}</div>
          <div style={{ maxWidth: 680 }}>
            {copy.ending.plantedWords}
            {plantedWords.length === 0 ? (
              <div style={{ opacity: 0.8, marginTop: 8 }}>{copy.ending.noWords}</div>
            ) : (
              <ul style={{ margin: '10px auto 0', paddingLeft: 18, textAlign: 'left', maxWidth: 420 }}>
                {plantedWords.slice(-5).map((word, index) => (
                  <li key={`${index}-${word}`}>{word}</li>
                ))}
              </ul>
            )}
          </div>
          <div style={{ opacity: 0.78, fontSize: 12 }}>{endingRestartPrompt}</div>
          <div style={{ opacity: 0.56, fontSize: 11 }}>{copy.ending.autoRestart(AUTO_END_RESET_MS / 1000)}</div>
        </div>
      )}

      {controlGuide}
      {verseOverlay}
    </div>
  );
}
