export type SpaceLocale = 'ko' | 'en';

const STAR_WORD_ENGLISH: Record<string, string> = {
  윤슬: 'Glittering Ripples',
  갈피: 'Page Marker',
  여울: 'Rapids',
  풀꽃: 'Wildflower',
  노을: 'Sunset Glow',
  그늘: 'Shade',
  꽃비: 'Flower Rain',
  바람결: 'Breeze',
  모퉁이: 'Corner',
  창가: 'Windowside',
  온기: 'Warmth',
  그을음: 'Soot',
  자국: 'Trace',
  빈터: 'Clearing',
  소음: 'Noise',
  얼룩: 'Stain',
  문턱: 'Threshold',
  나이테: 'Tree Rings',
  미련: 'Lingering Attachment',
  찰나: 'Moment',
  여운: 'Afterglow',
  기척: 'Presence',
  어스름: 'Dusk',
  설렘: 'Flutter',
  침묵: 'Silence',
  그리움: 'Longing',
  조각: 'Fragment',
  흐름: 'Flow',
  봄: 'Spring',
  봄날: 'Spring Day',
  봄비: 'Spring Rain',
  봄바람: 'Spring Breeze',
  개나리: 'Forsythia',
  진달래: 'Azalea',
  매화: 'Plum Blossom',
  벚꽃: 'Cherry Blossom',
  목련: 'Magnolia',
  철쭉: 'Royal Azalea',
  민들레: 'Dandelion',
  새싹: 'Sprout',
  꽃봉오리: 'Bud',
  화분: 'Flowerpot',
  개화: 'Bloom',
  개화기: 'Bloom Season',
  봄볕: 'Spring Sunlight',
  봄향기: 'Spring Scent',
  봄소식: 'Spring Tidings',
  봄나들이: 'Spring Outing',
  봄철: 'Springtime',
  봄눈: 'Spring Snow',
  사과꽃: 'Apple Blossom',
  복숭아꽃: 'Peach Blossom',
  튤립: 'Tulip',
  데이지: 'Daisy',
  모란: 'Peony',
  라일락: 'Lilac',
  유채: 'Canola Blossom',
  꽃샘: 'Spring Chill',
  꽃피다: 'Bloom',
};

export function localizeSpaceWord(locale: SpaceLocale, word: string) {
  if (locale !== 'en') return word;
  return STAR_WORD_ENGLISH[word] ?? word;
}

type SpaceCopy = {
  localeLabel: string;
  languageOptions: Array<{
    id: SpaceLocale;
    label: string;
    hint: string;
  }>;
  prologue: {
    lines: string[];
    keyboardAriaLabel: string;
    keyboardTitle: string;
    languageTitle: string;
    languageHint: string;
    confirmHint: string;
    statusIdle: string;
    statusLaunching: (seconds: number, languageLabel: string) => string;
    metaControls: string;
    metaGarden: string;
    seedNote: (count: number) => string;
  };
  triggers: {
    startFlight: string;
    firstAim: string;
    firstLod: string;
    plantStart: string;
    plantComplete: string;
    remainingOne: string;
    end: string;
    blocked: string;
  };
  controlGuide: {
    remainingSeeds: (remaining: number, total: number) => string;
    controls: string;
    gardenSync: string;
  };
  ending: {
    title: string;
    plantedWords: string;
    noWords: string;
    restartPromptIdle: string;
    restartPromptActive: (keyLabel: string) => string;
    autoRestart: (seconds: number) => string;
  };
  flight: {
    seedBlocked: string;
    holdProgress: (progressPercent: number) => string;
    speedometer: (value: number) => string;
    plantedToast: (word: string) => string;
  };
  perf: {
    title: string;
    showHud: string;
    positionPanel: string;
    compass: string;
    targetPanel: string;
    throttleBar: string;
    crosshair: string;
    speedometer: string;
    hudScale: (value: number) => string;
    hudOpacity: (value: number) => string;
    dprMin: (value: number) => string;
    dprMax: (value: number) => string;
    antialias: string;
    backgroundStars: (value: number) => string;
    backgroundPointSize: (value: number) => string;
    starGeometrySegments: (value: number) => string;
    maxVisibleLabels: (value: number) => string;
    labelUpdateInterval: (value: number) => string;
    labelConeScale: (value: number) => string;
    labelSampleStep: (value: number) => string;
    labelFontScale: (value: number) => string;
    labelMinSize: (value: number) => string;
    targetPanelMinSize: (value: number) => string;
    launchTrail: (value: number) => string;
    shipQuality: (value: number) => string;
    gridDensity: (value: number) => string;
    reset: string;
    lowPowerPreset: string;
  };
};

export const SPACE_COPY: Record<SpaceLocale, SpaceCopy> = {
  ko: {
    localeLabel: '한국어',
    languageOptions: [
      { id: 'ko', label: '한국어 / Korean', hint: 'W / A' },
      { id: 'en', label: '영어 / English', hint: 'S / D' },
    ],
    prologue: {
      lines: [
        '서가의 그늘에서, 우주는 시작된다.',
        '단어를 조준해 심으면 Garden 창에 꽃으로 피어납니다.',
        'WASD로 방향을 바꾸고, Space를 오래 눌러 심어보세요.',
        '오늘의 항해에는 심기 수 제한이 있습니다.',
      ],
      keyboardAriaLabel: 'WASD 언어 선택 및 출항 조작',
      keyboardTitle: '키보드 출항',
      languageTitle: '언어 선택',
      languageHint: 'W / A = 한국어, S / D = 영어',
      confirmHint: 'Space를 누르면 선택한 언어로 출항합니다.',
      statusIdle: '먼저 W / A / S / D로 언어를 고르고, Space로 출항하세요.',
      statusLaunching: (seconds, languageLabel) => `${languageLabel} 선택 완료. ${seconds}초 뒤 출항합니다.`,
      metaControls: '조작: W/A/S/D = 방향 변경, Space 0.9초 홀드 = 심기',
      metaGarden: '심은 단어는 Garden 창에서 즉시 꽃으로 연결됩니다.',
      seedNote: (count) => `심기 가능 수: ${count}`,
    },
    triggers: {
      startFlight: '관성에 몸을 맡기세요.',
      firstAim: '당신이 바라본 것만, 이름을 얻는다.',
      firstLod: '가까워지는 일은, 읽는 일이다.',
      plantStart: '공백이 자리를 만들고, 의미가 피어납니다.',
      plantComplete: '전사(全射): 단어가 형태를 얻었습니다.',
      remainingOne: '남은 봄은 하나.',
      end: '당신의 별자리가 기록되었습니다.',
      blocked: '더 이상 심을 수 없습니다.',
    },
    controlGuide: {
      remainingSeeds: (remaining, total) => `남은 심기: ${remaining} / ${total}`,
      controls: '조작: W/A/S/D + Space(0.9초 홀드)',
      gardenSync: 'Garden(큰 모니터)에 심기 상태가 즉시 갱신됩니다.',
    },
    ending: {
      title: '항해가 기록되었습니다.',
      plantedWords: '심은 단어:',
      noWords: '이번 항해에서 심은 단어가 없습니다.',
      restartPromptIdle: 'W / A / S / D 중 아무 키 하나를 2번 연속으로 누르면 메인 화면으로 돌아갑니다.',
      restartPromptActive: (keyLabel) => `${keyLabel} 키를 한 번 더 누르면 메인 화면으로 돌아갑니다.`,
      autoRestart: (seconds) => `${seconds}초 후에는 자동으로 다음 항해가 시작됩니다.`,
    },
    flight: {
      seedBlocked: '심을 수 있는 여지가 없습니다.',
      holdProgress: (progressPercent) => `심기 ${progressPercent}%`,
      speedometer: (value) => `속도계 ${value}`,
      plantedToast: (word) => `심음: ${word}`,
    },
    perf: {
      title: '성능 조정',
      showHud: 'HUD 표시',
      positionPanel: '위치 패널',
      compass: '나침반',
      targetPanel: '타깃 패널',
      throttleBar: '스로틀 바',
      crosshair: '십자선',
      speedometer: '속도계',
      hudScale: (value) => `HUD 크기 (${value.toFixed(2)})`,
      hudOpacity: (value) => `HUD 불투명도 (${value.toFixed(2)})`,
      dprMin: (value) => `DPR 최소 (${value.toFixed(2)})`,
      dprMax: (value) => `DPR 최대 (${value.toFixed(2)})`,
      antialias: '안티앨리어싱',
      backgroundStars: (value) => `배경 별 밀도 (${value}%)`,
      backgroundPointSize: (value) => `배경 점 크기 (${value.toFixed(1)})`,
      starGeometrySegments: (value) => `별 지오메트리 세그먼트 (${value})`,
      maxVisibleLabels: (value) => `최대 라벨 수 (${value})`,
      labelUpdateInterval: (value) => `라벨 갱신 주기 (${value}ms)`,
      labelConeScale: (value) => `라벨 콘 스케일 (${value.toFixed(2)})`,
      labelSampleStep: (value) => `라벨 샘플 간격 (${value})`,
      labelFontScale: (value) => `라벨 폰트 배율 (${value.toFixed(2)})`,
      labelMinSize: (value) => `라벨 최소 크기 (${value}px)`,
      targetPanelMinSize: (value) => `타깃 패널 최소 크기 (${value}px)`,
      launchTrail: (value) => `런치 트레일 (${value})`,
      shipQuality: (value) => `우주선 품질 (${value.toFixed(2)})`,
      gridDensity: (value) => `그리드 밀도 (${value.toFixed(2)})`,
      reset: '초기화',
      lowPowerPreset: '저전력 프리셋',
    },
  },
  en: {
    localeLabel: 'English',
    languageOptions: [
      { id: 'ko', label: 'Korean / 한국어', hint: 'W / A' },
      { id: 'en', label: 'English / 영어', hint: 'S / D' },
    ],
    prologue: {
      lines: [
        'In the shadow of the shelves, the cosmos begins.',
        'Aim at a word and plant it; it blooms as a flower in the Garden display.',
        'Steer with WASD, then hold Space to plant.',
        'This voyage has a limited number of seeds.',
      ],
      keyboardAriaLabel: 'WASD language selection and launch controls',
      keyboardTitle: 'keyboard launch',
      languageTitle: 'Language Select',
      languageHint: 'W / A = Korean, S / D = English',
      confirmHint: 'Press Space to launch in the selected language.',
      statusIdle: 'Choose a language with W / A / S / D, then press Space to launch.',
      statusLaunching: (seconds, languageLabel) => `${languageLabel} selected. Launching in ${seconds} second${seconds === 1 ? '' : 's'}.`,
      metaControls: 'Controls: W/A/S/D = steer, hold Space 0.9s = plant',
      metaGarden: 'Planted words connect to flowers in the Garden display immediately.',
      seedNote: (count) => `Available seeds: ${count}`,
    },
    triggers: {
      startFlight: 'Give yourself to inertia.',
      firstAim: 'Only what you look at earns a name.',
      firstLod: 'To come closer is to begin reading.',
      plantStart: 'A blank opens, and meaning starts to bloom.',
      plantComplete: 'The word has taken form.',
      remainingOne: 'Only one spring remains.',
      end: 'Your constellation has been recorded.',
      blocked: 'No more seeds can be planted.',
    },
    controlGuide: {
      remainingSeeds: (remaining, total) => `Seeds left: ${remaining} / ${total}`,
      controls: 'Controls: W/A/S/D + Space (hold 0.9s)',
      gardenSync: 'Planting status updates on the Garden display immediately.',
    },
    ending: {
      title: 'The voyage has been recorded.',
      plantedWords: 'Planted words:',
      noWords: 'No words were planted during this voyage.',
      restartPromptIdle: 'Press any one of W / A / S / D twice in a row to return to the main screen.',
      restartPromptActive: (keyLabel) => `Press ${keyLabel} one more time to return to the main screen.`,
      autoRestart: (seconds) => `The next voyage will start automatically in ${seconds} seconds.`,
    },
    flight: {
      seedBlocked: 'No planting slots remain.',
      holdProgress: (progressPercent) => `plant ${progressPercent}%`,
      speedometer: (value) => `Speedometer ${value}`,
      plantedToast: (word) => `planted: ${word}`,
    },
    perf: {
      title: 'Performance Tuning',
      showHud: 'Show HUD',
      positionPanel: 'Position panel',
      compass: 'Compass',
      targetPanel: 'Target panel',
      throttleBar: 'Throttle bar',
      crosshair: 'Crosshair',
      speedometer: 'Speedometer',
      hudScale: (value) => `HUD scale (${value.toFixed(2)})`,
      hudOpacity: (value) => `HUD opacity (${value.toFixed(2)})`,
      dprMin: (value) => `DPR min (${value.toFixed(2)})`,
      dprMax: (value) => `DPR max (${value.toFixed(2)})`,
      antialias: 'Antialias',
      backgroundStars: (value) => `Background stars (${value}%)`,
      backgroundPointSize: (value) => `Background point size (${value.toFixed(1)})`,
      starGeometrySegments: (value) => `Star geometry segments (${value})`,
      maxVisibleLabels: (value) => `Max visible labels (${value})`,
      labelUpdateInterval: (value) => `Label update interval (${value}ms)`,
      labelConeScale: (value) => `Label cone scale (${value.toFixed(2)})`,
      labelSampleStep: (value) => `Label sample step (${value})`,
      labelFontScale: (value) => `Label font scale (${value.toFixed(2)})`,
      labelMinSize: (value) => `Label min size (${value}px)`,
      targetPanelMinSize: (value) => `Target panel min size (${value}px)`,
      launchTrail: (value) => `Launch trail (${value})`,
      shipQuality: (value) => `Ship quality (${value.toFixed(2)})`,
      gridDensity: (value) => `Grid density (${value.toFixed(2)})`,
      reset: 'Reset',
      lowPowerPreset: 'Low power preset',
    },
  },
};
