import { createDefaults, normalizeState } from "./data";

const STORAGE_KEY = "easy-tab-state-v1";

export function isSyncStorageAvailable() {
  return Boolean(globalThis.chrome?.storage?.sync);
}

function loadLocalState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return normalizeState(saved ? JSON.parse(saved) : null);
  } catch {
    return createDefaults();
  }
}

export async function loadState() {
  if (!isSyncStorageAvailable()) return loadLocalState();

  try {
    const result = await globalThis.chrome.storage.sync.get(STORAGE_KEY);
    if (result[STORAGE_KEY]) return normalizeState(result[STORAGE_KEY]);

    const initialState = loadLocalState();
    await globalThis.chrome.storage.sync.set({ [STORAGE_KEY]: initialState });
    return initialState;
  } catch {
    return loadLocalState();
  }
}

export async function saveState(state) {
  const normalized = normalizeState(state);
  if (isSyncStorageAvailable()) {
    await globalThis.chrome.storage.sync.set({ [STORAGE_KEY]: normalized });
  } else {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  }
  return normalized;
}

export function subscribeToState(onChange) {
  if (!isSyncStorageAvailable()) return () => {};

  const handleChange = (changes, areaName) => {
    if (areaName === "sync" && changes[STORAGE_KEY]) {
      onChange(normalizeState(changes[STORAGE_KEY].newValue));
    }
  };
  globalThis.chrome.storage.onChanged.addListener(handleChange);
  return () => globalThis.chrome.storage.onChanged.removeListener(handleChange);
}
