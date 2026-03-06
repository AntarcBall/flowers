import { useCallback, useEffect, useRef, useState } from 'react';
import SpacePage from './pages/SpacePage';
import { CONFIG } from './config';
import type { StarSelectionData } from './types';
import './App.css';

type AppPhase = 'prologue' | 'flight' | 'ending';
type ReadMode = 'short' | 'full';

type SeedState = { used: number; remaining: number; total: number };
type Verse = { id: number; text: string };
type AimedStarData = (StarSelectionData & { distance?: number; headingOffsetDeg?: number }) | null;

const DEFAULT_SEED_LIMIT = 3;
const AUTO_END_RESET_MS = 20_000;
const VERSE_DURATION_MS = 2100;
const CONTROL_GUIDE_DURATION_MS = 7_500;

const PROLOGUE_SHORT = [
  '서가의 그늘에서, 우주는 시작된다.',
  '단어를 조준해 심으면 Garden 창에 꽃으로 피어납니다.',
  'WASD로 방향을 바꾸고, Space를 오래 눌러 심어보세요.',
  '오늘은 3개의 꽃만 심을 수 있습니다.',
] as const;

const PROLOGUE_FULL = [
  '서가의 그늘에서, 우주는 시작된다.',
  '이 전시는 "단어 임베딩 우주"입니다.',
  '각 단어는 벡터 공간의 좌표를 받아 별 하나로 배치되어 있으며,',
  '의미가 닮은 단어일수록 서로 가까운 궤도로 보입니다.',
  'W / A / S / D로 비행기체 자세를 바꿉니다.',
  'W: 위쪽을 향해 기울임, S: 아래쪽을 향해 기울임',
  'A: 왼쪽 회전, D: 오른쪽 회전',
  '우주선은 앞으로 자동 항속합니다. 좌표계를 찾아다니지 말고, "조준점"을 맞추는 데 집중하세요.',
  'SPACE를 누른 채를 유지하면 조준한 단어가 심어집니다.',
  '심기는 홀드 0.9초 이상이 필요합니다. 중간에 뗄 경우에는 취소됩니다.',
  '심긴 단어는 Garden 창(큰 모니터)에 실시간으로 꽃으로 변환되어 남습니다.',
  '시드를 다 쓰면 항해가 자동으로 종료됩니다. 기본 심기 수는 3개(주소 ?seeds=숫자 로 조정).',
  '실제 조작은 키보드만으로 진행됩니다. 화면을 클릭하지 않아도 됩니다.',
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

export default function App() {
  const [phase, setPhase] = useState<AppPhase>('prologue');
  const [readMode, setReadMode] = useState<ReadMode>('short');
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

  const verseTimerRef = useRef<number | null>(null);
  const guideTimerRef = useRef<number | null>(null);
  const endResetTimerRef = useRef<number | null>(null);

  const stopVerse = () => {
    if (verseTimerRef.current !== null) {
      window.clearTimeout(verseTimerRef.current);
      verseTimerRef.current = null;
    }
  };

  const publishVerse = useCallback((text: string, durationMs = VERSE_DURATION_MS) => {
    stopVerse();
    setVerse({ id: Date.now(), text });
    verseTimerRef.current = window.setTimeout(() => {
      setVerse(null);
      verseTimerRef.current = null;
    }, durationMs);
  }, []);

  const clearGuideTimer = () => {
    if (guideTimerRef.current !== null) {
      window.clearTimeout(guideTimerRef.current);
      guideTimerRef.current = null;
    }
  };

  const clearResetTimer = () => {
    if (endResetTimerRef.current !== null) {
      window.clearTimeout(endResetTimerRef.current);
      endResetTimerRef.current = null;
    }
  };

  const beginControlGuide = useCallback(() => {
    clearGuideTimer();
    setShowControlGuide(true);
    guideTimerRef.current = window.setTimeout(() => {
      setShowControlGuide(false);
      guideTimerRef.current = null;
    }, CONTROL_GUIDE_DURATION_MS);
  }, []);

  const resetForNewVoyage = useCallback(() => {
    setSeedState({ used: 0, remaining: seedLimit, total: seedLimit });
    setPlantedWords([]);
    setHasFirstAim(false);
    setHasFirstLod(false);
    setHasRemainingOne(false);
    setVoyageEpoch((current) => current + 1);
  }, [seedLimit]);

  const startFlight = useCallback(() => {
    setPhase('flight');
    resetForNewVoyage();
    setSeedState({ used: 0, remaining: seedLimit, total: seedLimit });
    publishVerse(TRIGGERS.startFlight);
    beginControlGuide();
  }, [beginControlGuide, publishVerse, resetForNewVoyage, seedLimit]);

  const finishVoyage = useCallback(() => {
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
  }, [beginControlGuide, clearGuideTimer, publishVerse, resetForNewVoyage]);

  useEffect(() => {
    return () => {
      stopVerse();
      clearGuideTimer();
      clearResetTimer();
    };
  }, []);

  useEffect(() => {
    if (phase !== 'ending') {
      clearResetTimer();
      return;
    }

    return () => {
      clearResetTimer();
    };
  }, [phase]);

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
    setPhase('flight');
    resetForNewVoyage();
    beginControlGuide();
    publishVerse(TRIGGERS.startFlight);
  }, [beginControlGuide, clearResetTimer, publishVerse, resetForNewVoyage]);

  const prologueLines = readMode === 'full' ? PROLOGUE_FULL : PROLOGUE_SHORT;

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
      <div>
            남은 심기: {seedState.remaining} / {seedState.total}
          </div>
          <div style={{ marginTop: 4 }}>조작: W/A/S/D + Space(0.9초 홀드)</div>
          <div style={{ marginTop: 2 }}>Garden(큰 모니터)에 심기 상태가 즉시 갱신됩니다.</div>
          </div>
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
          className="prologue-screen"
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
          <div style={{ maxWidth: 760, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {prologueLines.map((line) => (
              <div key={line} style={{ fontSize: 22, lineHeight: 1.55, fontWeight: 300 }}>
                {line}
              </div>
            ))}
          </div>
          <div
            style={{
              display: 'grid',
              gap: 4,
              textAlign: 'center',
              opacity: 0.92,
              lineHeight: 1.35,
              fontSize: 14,
            }}
          >
            <div>조작(키보드만): W/A/S/D = 방향 변경</div>
            <div>현재 조준된 단어에서 Space 0.9초 홀드 = 심기</div>
            <div>심은 단어는 Garden 창에서 꽃으로 확인 가능</div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
            <button onClick={startFlight} style={{ minWidth: 140, fontWeight: 700, color: '#ffd93d' }}>
              우주선 발진
            </button>
            <button
              onClick={() => setReadMode((prev) => (prev === 'short' ? 'full' : 'short'))}
              style={{ color: '#ffd93d' }}
            >
              짧게 읽기 / 전체 읽기
            </button>
            </div>
          <div style={{ opacity: 0.7, fontSize: 12, marginTop: 4 }}>심기 가능 수: {clamp(seedLimit, 1, 10)}</div>
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
            {AUTO_END_RESET_MS / 1000}초 후 다음 항해자로 넘어갑니다.
          </div>
          <button onClick={handleRestart}>다음 항해자에게 넘기기</button>
        </div>
      )}

      {controlGuide}
      {verseOverlay}
    </div>
  );
}
