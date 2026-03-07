import {
  DEFAULT_COLOR_MAPPING_PRESET,
  getActiveColorMappingPreset,
  normalizeColorMappingPreset,
  setActiveColorMappingPreset,
  type ColorMappingPreset,
} from './SemanticMapper';

export const COLOR_PRESET_STORAGE_KEY = 'flower:color-preset';
export const COLOR_PRESET_PUBLIC_FILENAME = 'color-preset.json';
export const COLOR_PRESET_INSTALL_PATH = 'client/public/color-preset.json';
export const COLOR_PRESET_APPLY_EVENT = 'flower:color-preset-applied';

export type ColorPresetSource = 'default' | 'localStorage' | 'publicFile' | 'runtime';
export type ColorPresetDetail = { preset: ColorMappingPreset; source: ColorPresetSource };

let currentSource: ColorPresetSource = 'default';
let loadPromise: Promise<ColorPresetDetail> | null = null;

function canUseWindow() {
  return typeof window !== 'undefined';
}

function emitPresetEvent(detail: ColorPresetDetail) {
  if (!canUseWindow()) return;
  window.dispatchEvent(new CustomEvent<ColorPresetDetail>(COLOR_PRESET_APPLY_EVENT, { detail }));
}

function applyLoadedPreset(preset: ColorMappingPreset, source: ColorPresetSource) {
  const normalized = setActiveColorMappingPreset(preset);
  currentSource = source;
  return { preset: normalized, source };
}

function readLocalStoragePreset() {
  if (!canUseWindow()) return null;

  try {
    const raw = window.localStorage.getItem(COLOR_PRESET_STORAGE_KEY);
    if (!raw) return null;
    return normalizeColorMappingPreset(JSON.parse(raw));
  } catch {
    return null;
  }
}

async function readPublicFilePreset() {
  if (!canUseWindow()) return null;

  try {
    const response = await fetch(`${import.meta.env.BASE_URL ?? '/'}${COLOR_PRESET_PUBLIC_FILENAME}`, {
      cache: 'no-store',
    });
    if (!response.ok) return null;
    return normalizeColorMappingPreset(await response.json());
  } catch {
    return null;
  }
}

export async function ensureColorPresetLoaded() {
  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = (async () => {
    const publicPreset = await readPublicFilePreset();
    if (publicPreset) {
      return applyLoadedPreset(publicPreset, 'publicFile');
    }

    const localPreset = readLocalStoragePreset();
    if (localPreset) {
      return applyLoadedPreset(localPreset, 'localStorage');
    }

    const detail = applyLoadedPreset(DEFAULT_COLOR_MAPPING_PRESET, 'default');
    return detail;
  })();

  return loadPromise;
}

export function getCurrentColorPreset() {
  return getActiveColorMappingPreset();
}

export function getCurrentColorPresetSource() {
  return currentSource;
}

export function applyColorPreset(
  preset: Partial<ColorMappingPreset> | ColorMappingPreset,
  options: { persistToLocalStorage?: boolean; source?: ColorPresetSource } = {},
) {
  const normalized = setActiveColorMappingPreset(preset);
  const source = options.source ?? 'runtime';
  currentSource = source;

  if (options.persistToLocalStorage !== false && canUseWindow()) {
    window.localStorage.setItem(COLOR_PRESET_STORAGE_KEY, JSON.stringify(normalized));
  }

  const detail = { preset: normalized, source };
  emitPresetEvent(detail);
  return detail;
}

export function subscribeToColorPreset(listener: (detail: ColorPresetDetail) => void) {
  if (!canUseWindow()) {
    return () => {};
  }

  const handleApplied = (event: Event) => {
    listener((event as CustomEvent<ColorPresetDetail>).detail);
  };

  const handleStorage = (event: StorageEvent) => {
    if (event.key !== COLOR_PRESET_STORAGE_KEY) return;
    const preset = readLocalStoragePreset();
    if (!preset) return;
    listener(applyLoadedPreset(preset, 'localStorage'));
  };

  window.addEventListener(COLOR_PRESET_APPLY_EVENT, handleApplied as EventListener);
  window.addEventListener('storage', handleStorage);

  return () => {
    window.removeEventListener(COLOR_PRESET_APPLY_EVENT, handleApplied as EventListener);
    window.removeEventListener('storage', handleStorage);
  };
}

export function downloadColorPresetFile(preset: ColorMappingPreset, filename = COLOR_PRESET_PUBLIC_FILENAME) {
  if (!canUseWindow()) return;

  const blob = new Blob([JSON.stringify(normalizeColorMappingPreset(preset), null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
