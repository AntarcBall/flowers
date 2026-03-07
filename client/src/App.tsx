import { useCallback, useEffect, useRef, useState } from 'react';
import SpacePage from './pages/SpacePage';
import { CONFIG } from './config';
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

const PROLOGUE_SHORT = [
  '서가의 그늘에서, 우주는 시작된다.',
  '단어를 조준해 심으면 Garden 창에 꽃으로 피어납니다.',
  'WASD로 방향을 바꾸고, Space를 오래 눌러 심어보세요.',
  '오늘의 항해에는 심기 수 제한이 있습니다.',
] as const;

const TRIGGERS = {
  startFlight: '관성에 몸을 맡기세요.',
  firstAim: '당신이 바라본 것만, 이름을 얻는다.',
  firstLod: '가까워지는 일은, 읽는 일이다.',
  plantStart: '공백이 자리를 만들고, 의미가 피어납니다.',
  plantComplete: '전사(全射): 단어가 형태를 얻었습니다.',
  remainingOne: '남은 봄은 하나.',
  end: '당신의 별자리가 기록되었습니다.',
  blocked: '더 이상 심을 수 없습니다.',
} as const;

const parseSeedLimit = () => {
  if (typeof window === 'undefined') return DEFAULT_SEED_LIMIT;
  const params = new URLSearchParams(window.location.search);
  const value = Number(params.get('seeds'));
  if (!Number.isFinite(value) || value <= 0) return DEFAULT_SEED_LIMIT;
  return Math.max(1, Math.floor(value));
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const isRestartControlKey = (code: string): code is RestartControlKey => code in RESTART_CONTROL_KEY_LABELS;

const PROLOGUE_KEYCAP_LAYOUT: Array<{ code: RestartControlKey; label: 'W' | 'A' | 'S' | 'D'; x: number; y: number }> = [
  { code: 'KeyW', label: 'W', x: 88, y: 0 },
  { code: 'KeyA', label: 'A', x: 0, y: 88 },
  { code: 'KeyS', label: 'S', x: 88, y: 88 },
  { code: 'KeyD', label: 'D', x: 176, y: 88 },
];

function PrologueWasdGlyph({
  activeKey,
  launching,
}: {
  activeKey: RestartControlKey | null;
  launching: boolean;
}) {
  return (
    <svg viewBox="0 0 264 176" className="prologue-wasd-svg" role="img" aria-label="WASD launch controls">
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
  const [prologueLaunchKey, setPrologueLaunchKey] = useState<RestartControlKey | null>(null);
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

  const stopVerse = useCallback(() => {
    if (verseTimerRef.current !== null) {
      window.clearTimeout(verseTimerRef.current);
      verseTimerRef.current = null;
    }
  }, []);

  const publishVerse = useCallback((text: string, durationMs = VERSE_DURATION_MS) => {
    stopVerse();
    setVerse({ id: Date.now(), text });
    verseTimerRef.current = window.setTimeout(() => {
      setVerse(null);
      verseTimerRef.current = null;
    }, durationMs);
  }, [stopVerse]);

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
    setPrologueLaunchKey(null);
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

  const startFlight = useCallback(() => {
    resetPrologueLaunch();
    syncEndingRestartInput({ key: null, count: 0 });
    setPhase('flight');
    resetForNewVoyage();
    setSeedState({ used: 0, remaining: seedLimit, total: seedLimit });
    publishVerse(TRIGGERS.startFlight);
    beginControlGuide();
  }, [beginControlGuide, publishVerse, resetForNewVoyage, resetPrologueLaunch, seedLimit, syncEndingRestartInput]);

  const finishVoyage = useCallback(() => {
    syncEndingRestartInput({ key: null, count: 0 });
    setPhase('ending');
    clearGuideTimer();
    setShowControlGuide(false);
    publishVerse(TRIGGERS.end);
    clearResetTimer();
    endResetTimerRef.current = window.setTimeout(() => {
      setPhase('flight');
      resetForNewVoyage();
      publishVerse(TRIGGERS.startFlight);
      beginControlGuide();
      clearResetTimer();
    }, AUTO_END_RESET_MS);
  }, [beginControlGuide, clearGuideTimer, clearResetTimer, publishVerse, resetForNewVoyage, syncEndingRestartInput]);

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
    resetForNewVoyage();
  }, [
    clearGuideTimer,
    clearInactivityTimer,
    clearResetTimer,
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

    const handlePrologueLaunchInput = (event: KeyboardEvent) => {
      if (event.repeat || !isRestartControlKey(event.code) || prologueLaunchTimerRef.current !== null) {
        return;
      }

      event.preventDefault();
      setPrologueLaunchKey(event.code);
      setIsPrologueLaunching(true);
      clearPrologueLaunchTimer();
      prologueLaunchTimerRef.current = window.setTimeout(() => {
        prologueLaunchTimerRef.current = null;
        startFlight();
      }, PROLOGUE_LAUNCH_DELAY_MS);
    };

    window.addEventListener('keydown', handlePrologueLaunchInput);
    return () => {
      window.removeEventListener('keydown', handlePrologueLaunchInput);
    };
  }, [clearPrologueLaunchTimer, phase, startFlight]);

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
        publishVerse(TRIGGERS.remainingOne);
      }

      if (next.remaining <= 0 && seedState.remaining > 0) {
        finishVoyage();
      }
    },
    [finishVoyage, hasRemainingOne, phase, publishVerse, seedState.remaining],
  );

  const handleAimChange = useCallback(
    (next: AimedStarData) => {
      if (!next) return;

      if (!hasFirstAim) {
        setHasFirstAim(true);
        publishVerse(TRIGGERS.firstAim);
      }

      if (!hasFirstLod && next.distance !== undefined && next.distance < CONFIG.TEXT_LOD_DISTANCE) {
        setHasFirstLod(true);
        publishVerse(TRIGGERS.firstLod);
      }
    },
    [hasFirstAim, hasFirstLod, publishVerse],
  );

  const handlePlantHoldEvent = useCallback(
    (event: { type: 'start' | 'cancel' | 'complete'; target: StarSelectionData | null }) => {
      if (event.type === 'start') {
        publishVerse(TRIGGERS.plantStart);
      }
      if (event.type === 'complete') {
        publishVerse(TRIGGERS.plantComplete);
      }
    },
    [publishVerse],
  );

  const handlePlantBlocked = useCallback(() => {
    publishVerse(TRIGGERS.blocked);
  }, [publishVerse]);

  const handleSeedCommit = useCallback(
    (entry: { id?: number | string; word: string; color: string; params: StarSelectionData['params'] }) => {
      setPlantedWords((current) => {
        if (current.includes(entry.word)) return current;
        return [...current, entry.word];
      });
    },
    [],
  );

  const handleRestart = useCallback(() => {
    clearResetTimer();
    resetPrologueLaunch();
    syncEndingRestartInput({ key: null, count: 0 });
    setPhase('flight');
    resetForNewVoyage();
    beginControlGuide();
    publishVerse(TRIGGERS.startFlight);
  }, [beginControlGuide, clearResetTimer, publishVerse, resetForNewVoyage, resetPrologueLaunch, syncEndingRestartInput]);

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
        handleRestart();
        return;
      }

      syncEndingRestartInput(next);
    };

    window.addEventListener('keydown', handleEndingRestartInput);
    return () => {
      window.removeEventListener('keydown', handleEndingRestartInput);
    };
  }, [handleRestart, phase, syncEndingRestartInput]);

  const prologueLines = PROLOGUE_SHORT;
  const endingRestartPrompt =
    endingRestartInput.key === null
      ? '다음 항해자는 W / A / S / D 중 아무 키 하나를 2번 연속으로 누르세요.'
      : `${RESTART_CONTROL_KEY_LABELS[endingRestartInput.key]} 키를 한 번 더 누르면 다음 항해가 시작됩니다.`;
  const prologueLaunchPrompt =
    prologueLaunchKey === null
      ? 'W / A / S / D 중 아무 키를 누르면 1초 뒤 항해가 시작됩니다.'
      : `${RESTART_CONTROL_KEY_LABELS[prologueLaunchKey]} 입력 감지. ${PROLOGUE_LAUNCH_DELAY_MS / 1000}초 뒤 출항합니다.`;

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
      <div>남은 심기: {seedState.remaining} / {seedState.total}</div>
      <div style={{ marginTop: 4 }}>조작: W/A/S/D + Space(0.9초 홀드)</div>
      <div style={{ marginTop: 2 }}>Garden(큰 모니터)에 심기 상태가 즉시 갱신됩니다.</div>
    </div>
  ) : null;

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden', background: 'black' }}>
      {phase === 'flight' && (
        <SpacePage
          key={voyageEpoch}
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
            {prologueLines.map((line) => (
              <div key={line} style={{ fontSize: 22, lineHeight: 1.55, fontWeight: 300 }}>
                {line}
              </div>
            ))}
          </div>
          <div className="prologue-kbd-stage">
            <div className="prologue-kbd-panel">
              <PrologueWasdGlyph activeKey={prologueLaunchKey} launching={isPrologueLaunching} />
              <div className="prologue-kbd-copy">
                <div className="prologue-kbd-title">keyboard launch</div>
                <div className="prologue-kbd-status">{prologueLaunchPrompt}</div>
                <div className="prologue-kbd-meta">조작: W/A/S/D = 방향 변경, Space 0.9초 홀드 = 심기</div>
                <div className="prologue-kbd-meta">심은 단어는 Garden 창에서 즉시 꽃으로 연결됩니다.</div>
              </div>
            </div>
          </div>
          <div className="prologue-seed-note">심기 가능 수: {clamp(seedLimit, 1, 10)}</div>
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
          <div style={{ fontSize: 24, letterSpacing: 0.4 }}>항해가 기록되었습니다.</div>
          <div style={{ maxWidth: 680 }}>
            심은 단어:
            {plantedWords.length === 0 ? (
              <div style={{ opacity: 0.8, marginTop: 8 }}>이번 항해에서 심은 단어가 없습니다.</div>
            ) : (
              <ul style={{ margin: '10px auto 0', paddingLeft: 18, textAlign: 'left', maxWidth: 420 }}>
                {plantedWords.slice(-5).map((word, index) => (
                  <li key={`${index}-${word}`}>{word}</li>
                ))}
              </ul>
            )}
          </div>
          <div style={{ opacity: 0.78, fontSize: 12 }}>
            {endingRestartPrompt}
          </div>
          <div style={{ opacity: 0.56, fontSize: 11 }}>
            {AUTO_END_RESET_MS / 1000}초 후에는 자동으로 다음 항해가 시작됩니다.
          </div>
        </div>
      )}

      {controlGuide}
      {verseOverlay}
    </div>
  );
}
