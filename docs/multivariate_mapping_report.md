# 다변수 매핑 보고서 (단어 ↔ 우주좌표 ↔ 꽃파라미터)

작성일: 2026-02-27

이 문서는 현재 코드베이스 기준으로, 별(단어)의 시각 표현이 어떻게 생성되는지
`단어 임베딩/3D 우주좌표/꽃 파라미터/색상`의 다변수 매핑 관점에서 정리한다.

## 1) 파이프라인 개요

현재 렌더 파이프라인은 다음 순서로 동작한다.

1. `stars.json` 로드 (`id, word, color, x, y, z`)
2. `SemanticMapper.mapCoordinatesToParams(x, y, z)`  
   → 21개 꽃 파라미터(기저 + 확장) 생성
3. `SemanticMapper.mapCoordinatesToColor(x, y, z)`  
   → 시각 색상 생성
4. `buildStarEmbedding(params, position, color)`  
   → HUD 임베딩 바(1차원 막대)로 보여주기 위한 파생 벡터 생성

즉, 현재는 “단어 문자열 자체 임베딩(예: Word2Vec/임베딩 모델 출력)”을 그대로
불러와 쓰는 구조가 아니라, 우주 좌표에서 결정론적으로 파생된 함수 기반 파라미터/색상으로
표현한다.

## 2) 차원 정의와 크기

### 2.1 입력 공통 좌표 차원

`CUBE_SIZE = 1000` 기준으로 정규화:
- `q_x = x / 1000`
- `q_y = y / 1000`
- `q_z = z / 1000`

정규화된 버전은 `clamp01((q + 1)/2)` 또는 직접 비슷한 정규화로 사용된다.

### 2.2 꽃 파라미터 차원 수 (21차원)
`mapCoordinatesToParams`는 `FlowerRenderParams`의 각 항목을 채운다.

- 기본 5차원: `m, n1, n2, n3, rot`
- 확장 16차원:
  - `petalCount`
  - `petalStretch`
  - `petalCrest`
  - `petalSpread`
  - `coreRadius`
  - `coreGlow`
  - `rimWidth`
  - `outlineWeight`
  - `symmetry`
  - `mandalaDepth`
  - `ringBands`
  - `radialTwist`
  - `innerVoid`
  - `fractalIntensity`
  - `sectorWarp`
  - `ringContrast`
  - `depthEcho`

합계: **21차원**

### 2.3 현재 표시 임베딩(세그먼트 표시) 차원 수
`buildStarEmbedding`는 별 표시용 임베딩을 아래처럼 만든다.

1. 정규화 위치: 3차원
   - `q_x_norm, q_y_norm, q_z_norm`
2. 파라미터 정규화 값: 21차원
   - 각 파라미터는 `CONFIG.FLOWER_RANGES[key]`로 정규화
3. 색 채널: 3차원
   - `r, g, b`

총합: **27차원**  
HUD에서 보이는 막대 수(`임베딩 스펙트럼 (nD)`)는 이 27차원이다.

## 3) 매핑 수식 (코드 기반)

### 3.1 기본 시드 함수
각 파라미터 키 `k`별로:

\[
s_k(x,y,z)=\sum_{i=1}^{3}\sin(\omega_{k,i}\cdot u_i+\phi_{k,i})
\]
\[
t_k=\mathrm{clamp}_{[0,1]}\left(\frac{s_k+3}{6}\right)
\]

여기서 \(u_i\)는 정규화된 좌표 축(상황별 축 순열 포함), \(\omega,\phi\)는 `CONFIG.SEEDS[k]`.

### 3.2 파라미터 스케일링
\[
p_k = p_k^{\min}+ t_k\,(p_k^{\max}-p_k^{\min})
\]
\[
p_{m}=\mathrm{round}(p_{m})
\]

일부 파라미터는 반올림/round 적용(`petalCount`, `symmetry`, `ringBands`)이 존재한다.

### 3.3 색상 생성의 구조
- `smoothSeed(...)`로 주변값 샘플을 섞어 스무딩
- `blendPerceptualPalette(...)` 내부에서 5개 앵커 벡터를
  `exp(sharpness * dot(dir, unit_vector))` 가중 평균으로 결합
- Lab 공간으로부터 RGB 변환 후 HSL 및 지각적 휘도 타깃(`COLOR_LUMINANCE`)으로 재조정
- 최종 색은 `matchLuminance()`로 목표 밝기 맞춤

### 3.4 HUD 임베딩의 구성
\[
e = [q_{x\_norm}, q_{y\_norm}, q_{z\_norm},\; \hat p_1,\ldots,\hat p_{21},\; r,g,b]
\]

`e`의 각 원소는 0~1 범위로 정규화되어 바(세그먼트)로 렌더됨.

## 4) Fully connected linear 여부 판단

요청한 “결국 FC linear인가?”에 대한 결론:

- **아니오.**
- `W x + b` 형태의 선형 결합만으로는 구성되지 않는다.
- 핵심은 `sin`, `exp`, `clamp`, 제곱/루트/곱셈, Lab↔RGB/색공간 변환, 가중치 정규화 등이 섞인
  **비선형 함수 조합**이다.
- 다만 각 키별로 좌표 축 조합이 `seed` 형태로 정의되어 있어 계산량은 비교적 가벼운
  **결정론적 다주파 신호 기반 비선형 지도**로 이해하는 것이 맞다.

## 5) 미분 가능성/연속성 관점

- `sin` 기반 본체와 다수의 완만한 보간은 연속성이 높다.
- `clamp` 구간 경계에서는 미분성이 약해질 수 있으나, 전체적으로는 안정된 연속적 전이.
- 색상 단계에서는 공간 좌표→색상까지 한 번 더 매끄러운 보정이 들어가므로
  전체적으로 “국소적으로 안정적”이지만 전 구간 선형은 아니다.

## 6) 버그/확인 포인트

- `SpaceScene` 라벨 임베딩 표시(`임베딩 스펙트럼`)은 `aimedStarData.embedding` 기반이므로,
  임베딩 길이는 현재 별의 **파생 임베딩 길이(27)**를 따른다.
- “단어 임베딩 원천 차원”을 별도로 저장/표기하려면 `stars.json`에 원시 임베딩 필드가
  필요하며, 현재 구조에서는 3D 좌표에서 유도되는 값이 임베딩처럼 사용되는 점을 주의.

## 7) 코드 참조

- `client/src/modules/SemanticMapper.ts`
- `client/src/components/SpaceScene.tsx` (`buildStarEmbedding`, HUD 라벨)
- `client/src/pages/SpacePage.tsx` (`buildEmbeddingBars`, embedding 표시)
- `client/src/types.ts` (`FlowerRenderParams`)
- `client/src/config.ts` (`FLOWER_RANGES`, `SEEDS`, `CUBE_SIZE`)
