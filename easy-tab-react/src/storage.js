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

function createStorageError(reason) {
  const detail = `${reason?.name || ""} ${reason?.message || reason || ""}`;
  const error = new Error(reason?.message || "storage-write-failed");
  error.code = /quota/i.test(detail) ? "quota" : /permission|not allowed|denied/i.test(detail) ? "permission" : "other";
  return error;
}

export function storageErrorMessage(error, fallback = "保存失败，请重试。") {
  if (error?.code === "quota") return "同步空间不足，请减少入口或分组后重试。";
  if (error?.code === "permission") return "浏览器存储权限不可用，请检查扩展权限后重试。";
  return fallback;
}

export async function saveState(state) {
  const normalized = normalizeState(state);
  try {
    if (isSyncStorageAvailable()) {
      await globalThis.chrome.storage.sync.set({ [STORAGE_KEY]: normalized });
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    }
  } catch (reason) {
    throw createStorageError(reason);
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
