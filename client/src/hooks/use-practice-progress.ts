import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "lingoflow-practice-progress";

export interface TextProgress {
  fill: boolean;
  order: boolean;
  write: boolean;
  cards: boolean;
  flashcardCount: number;
  sentenceCount: number;
}

interface ProgressStore {
  [key: string]: TextProgress;
}

let progressState: ProgressStore = loadFromStorage();
const listeners = new Set<() => void>();

function loadFromStorage(): ProgressStore {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch {}
  return {};
}

function saveToStorage(progress: ProgressStore) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {}
}

function notifyListeners() {
  listeners.forEach(listener => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): ProgressStore {
  return progressState;
}

function createDefaultProgress(): TextProgress {
  return { fill: false, order: false, write: false, cards: false, flashcardCount: 0, sentenceCount: 0 };
}

function setModeCompleteInternal(topicId: string, textId: string, mode: "fill" | "order" | "write" | "cards") {
  const key = `${topicId}-${textId}`;
  const current = progressState[key] || createDefaultProgress();
  if (current[mode]) return;
  
  progressState = {
    ...progressState,
    [key]: { ...current, [mode]: true }
  };
  saveToStorage(progressState);
  notifyListeners();
}

function resetModeProgressInternal(topicId: string, textId: string, mode: "fill" | "order" | "write" | "cards") {
  const key = `${topicId}-${textId}`;
  const current = progressState[key];
  if (!current || !current[mode]) return;
  
  progressState = {
    ...progressState,
    [key]: { ...current, [mode]: false }
  };
  saveToStorage(progressState);
  notifyListeners();
}

function updateFlashcardCountInternal(topicId: string, textId: string, count: number) {
  const key = `${topicId}-${textId}`;
  const current = progressState[key] || createDefaultProgress();
  
  if (count !== current.flashcardCount) {
    progressState = {
      ...progressState,
      [key]: { 
        ...current, 
        flashcardCount: count,
        fill: false,
        write: false,
        cards: false
      }
    };
    saveToStorage(progressState);
    notifyListeners();
  }
}

function updateSentenceCountInternal(topicId: string, textId: string, count: number) {
  const key = `${topicId}-${textId}`;
  const current = progressState[key] || createDefaultProgress();
  
  if (count !== current.sentenceCount) {
    progressState = {
      ...progressState,
      [key]: { 
        ...current, 
        sentenceCount: count,
        order: false
      }
    };
    saveToStorage(progressState);
    notifyListeners();
  }
}

function resetTextProgressInternal(topicId: string, textId: string) {
  const key = `${topicId}-${textId}`;
  const { [key]: _, ...rest } = progressState;
  progressState = rest;
  saveToStorage(progressState);
  notifyListeners();
}

export function usePracticeProgress() {
  const progress = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const getTextProgress = useCallback((topicId: string, textId: string): TextProgress => {
    const key = `${topicId}-${textId}`;
    return progress[key] || createDefaultProgress();
  }, [progress]);

  const setModeComplete = useCallback((topicId: string, textId: string, mode: "fill" | "order" | "write" | "cards") => {
    setModeCompleteInternal(topicId, textId, mode);
  }, []);

  const resetModeProgress = useCallback((topicId: string, textId: string, mode: "fill" | "order" | "write" | "cards") => {
    resetModeProgressInternal(topicId, textId, mode);
  }, []);

  const updateFlashcardCount = useCallback((topicId: string, textId: string, count: number) => {
    updateFlashcardCountInternal(topicId, textId, count);
  }, []);

  const updateSentenceCount = useCallback((topicId: string, textId: string, count: number) => {
    updateSentenceCountInternal(topicId, textId, count);
  }, []);

  const resetTextProgress = useCallback((topicId: string, textId: string) => {
    resetTextProgressInternal(topicId, textId);
  }, []);

  const getCompletionCount = useCallback((topicId: string, textId: string): number => {
    const p = getTextProgress(topicId, textId);
    return (p.fill ? 1 : 0) + (p.order ? 1 : 0) + (p.write ? 1 : 0) + (p.cards ? 1 : 0);
  }, [getTextProgress]);

  const isTextComplete = useCallback((topicId: string, textId: string): boolean => {
    const p = getTextProgress(topicId, textId);
    return p.fill && p.order && p.write && p.cards;
  }, [getTextProgress]);

  const getCompletionPercentage = useCallback((topicId: string, textId: string): number => {
    return Math.round((getCompletionCount(topicId, textId) / 4) * 100);
  }, [getCompletionCount]);

  return {
    getTextProgress,
    setModeComplete,
    resetModeProgress,
    updateFlashcardCount,
    updateSentenceCount,
    resetTextProgress,
    getCompletionCount,
    isTextComplete,
    getCompletionPercentage
  };
}
