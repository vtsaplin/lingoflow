import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "lingoflow-settings";

export type TTSVoice = "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer";

export interface Settings {
  ttsVoice: TTSVoice;
}

const defaultSettings: Settings = {
  ttsVoice: "alloy"
};

const listeners = new Set<() => void>();

function loadFromStorage(): Settings {
  if (typeof window === "undefined") return defaultSettings;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return { ...defaultSettings, ...parsed };
    }
  } catch {}
  return defaultSettings;
}

let settingsState: Settings = loadFromStorage();

function saveToStorage(settings: Settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {}
}

function notifyListeners() {
  listeners.forEach(listener => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): Settings {
  return settingsState;
}

export function useSettings() {
  const settings = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const updateSettings = useCallback((updates: Partial<Settings>) => {
    settingsState = { ...settingsState, ...updates };
    saveToStorage(settingsState);
    notifyListeners();
  }, []);

  const setVoice = useCallback((voice: TTSVoice) => {
    updateSettings({ ttsVoice: voice });
  }, [updateSettings]);

  return {
    settings,
    updateSettings,
    setVoice
  };
}

export const VOICE_OPTIONS: { value: TTSVoice; label: string; description: string }[] = [
  { value: "alloy", label: "Alloy", description: "Neutral and balanced" },
  { value: "echo", label: "Echo", description: "Deep and resonant" },
  { value: "fable", label: "Fable", description: "Expressive storyteller" },
  { value: "nova", label: "Nova", description: "Bright and energetic" },
  { value: "onyx", label: "Onyx", description: "Strong and authoritative" },
  { value: "shimmer", label: "Shimmer", description: "Light and airy" },
];
