# space 페이지 성능/표시 옵션 설명

본 문서는 `SpacePage`의 `OPT` 패널에서 조정할 수 있는 옵션들의 의미를 설명합니다.

옵션은 `client/src/modules/PerformanceSettings.ts`에 정의되어 있으며,
`SpacePage`에서 UI로 노출됩니다.

## 기본 동작
- 변경은 실시간으로 `localStorage`의 `space_performance_settings`에 저장됩니다.
- 우측 하단 `OPT` 버튼을 눌러 패널을 열고 슬라이더/체크박스로 조절합니다.
- `Reset`은 기본값으로 복원합니다.
- `Low power preset`은 저사양 모드 프리셋을 적용합니다.

## 표시(HUD) 관련

### `showHud`
- 전체 HUD 표시 토글.
- false면 HUD 요소가 거의 모두 숨겨집니다.

### `hudCrosshair`
- 화면 중앙 십자선을 표시/숨김.

### `hudSpeedometer`
- 속도계 UI 표시/숨김.

### `hudPositionPanel`
- 현재 위치 좌표 패널 표시/숨김.

### `hudHeadingCompass`
- 헤딩/피치(HDG/PIT) 패널 표시/숨김.

### `hudTargetPanel`
- 현재 조준 중인 별의 미리보기/목표 패널 표시/숨김.

### `hudThrottleBar`
- 스로틀/속도 보조 바 표시/숨김.

### `hudRangeReadout`
- 조준 별 거리 표시 패널 표시/숨김.

### `hudScale`
- HUD 전체 크기 배율.
- 사용 범위: `0.6 ~ 1.4`

### `hudOpacity`
- HUD 투명도(알파).
- 사용 범위: `0.35 ~ 1`

## 렌더링/성능 관련

### `antialias`
- 안티앨리어싱 켜기/끄기.
- 끄면 성능이 더 좋을 수 있습니다.

### `dprMin`, `dprMax`
- 렌더 해상도 배율 제한.
- 보통 1.0~2.0 범위로 조절합니다.
- 낮은 값일수록 퍼포먼스 개선 여지가 큼.

### `backgroundStarDensity`
- 배경 별 개수 비율.
- 사용 범위: `20% ~ 100%`로 매핑.
- 값이 낮으면 시야의 주변 별 점이 적어집니다.

### `backgroundPointSize`
- 배경 별 점 크기.
- 범위: `1.0 ~ 3.4`

### `starGeometrySegments`
- 별 구체 메시 분할 수(정확도/연산량).
- 범위: `4 ~ 16` (짝수 권장)
- 낮을수록 렌더 비용 감소.

### `gridDensity`
- 장면의 그리드(helper) 밀도.
- 범위: `0 ~ 1`

### `launchTrailLimit`
- 화면에 남을 발사 이펙트 최대 개수.
- 범위: `0 ~ 10`

### `shipQuality`
- 우주선/시각 요소 상세 렌더 품질 정도.
- 범위: `0 ~ 1` (클수록 고급 material, 반사/발광 연산 증가)

### `aimSampleStep`
- 별 조준 계산 때 샘플링 간격.
- 범위: `1 ~ 8`
- 값이 클수록 CPU 부담 감소, 정밀도는 약해질 수 있음.

## 라벨(단어) 관련

### `maxVisibleLabels`
- 한 번에 표시할 최대 라벨 개수.
- 범위: `0 ~ 20`

### `labelUpdateIntervalMs`
- 라벨 후보 업데이트 간격(ms).
- 범위: `24 ~ 220`
- 높으면 갱신이 느리고 CPU 감소.

### `labelConeScale`
- 조준/표시용 라벨 원추각 배율.
- 범위: `0.55 ~ 1.35`
- 클수록 넓은 구간의 별 라벨 표시 가능.

## 기본값(참조)

현재 기본값은 다음과 같습니다.

- `dprMin`: 1.0
- `dprMax`: 1.5
- `showHud`: true
- `hudScale`: 1
- `hudOpacity`: 0.95
- `hudCrosshair`: true
- `hudSpeedometer`: true
- `hudPositionPanel`: true
- `hudHeadingCompass`: true
- `hudTargetPanel`: true
- `hudThrottleBar`: true
- `hudRangeReadout`: true
- `antialias`: false
- `backgroundStarDensity`: 0.85
- `backgroundPointSize`: 2.3
- `starGeometrySegments`: 8
- `maxVisibleLabels`: 8
- `labelUpdateIntervalMs`: 55
- `labelConeScale`: 0.9
- `aimSampleStep`: 1
- `launchTrailLimit`: 6
- `shipQuality`: 1
- `gridDensity`: 1

## 권장 사용 가이드

- 고성능 장치: 기본값 또는 그 이상의 값으로 시각 품질 유지.
- 저사양 장치:
  - `antialias`: false
  - `dprMax`: 1.1
  - `backgroundStarDensity`: 0.35
  - `starGeometrySegments`: 4
  - `aimSampleStep`: 3
  - `maxVisibleLabels`: 0 또는 저값
  - `gridDensity`: 0.15
  - `shipQuality`: 0
- 균형 모드:
  - `backgroundStarDensity`: 0.6
  - `starGeometrySegments`: 6~8
  - `launchTrailLimit`: 3

## 저장 키

- 저장 키: `space_performance_settings`
- 저장 위치: 브라우저 `localStorage`
