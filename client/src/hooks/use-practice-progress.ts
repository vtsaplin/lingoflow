import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "lingoflow-practice-progress";

export interface TextProgress {
  fill: boolean;
  order: boolean;
  write: boolean;
}

interface ProgressStore {
  [key: string]: TextProgress;
}

function getStoredProgress(): ProgressStore {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch {}
  return {};
}

function saveProgress(progress: ProgressStore) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {}
}

export function usePracticeProgress() {
  const [progress, setProgress] = useState<ProgressStore>(getStoredProgress);

  useEffect(() => {
    saveProgress(progress);
  }, [progress]);

  const getTextProgress = useCallback((topicId: string, textId: string): TextProgress => {
    const key = `${topicId}-${textId}`;
    return progress[key] || { fill: false, order: false, write: false };
  }, [progress]);

  const setModeComplete = useCallback((topicId: string, textId: string, mode: "fill" | "order" | "write") => {
    const key = `${topicId}-${textId}`;
    setProgress(prev => {
      const current = prev[key] || { fill: false, order: false, write: false };
      if (current[mode]) return prev;
      return {
        ...prev,
        [key]: { ...current, [mode]: true }
      };
    });
  }, []);

  const resetTextProgress = useCallback((topicId: string, textId: string) => {
    const key = `${topicId}-${textId}`;
    setProgress(prev => {
      const { [key]: _, ...rest } = prev;
      return rest;
    });
  }, []);

  const getCompletionCount = useCallback((topicId: string, textId: string): number => {
    const p = getTextProgress(topicId, textId);
    return (p.fill ? 1 : 0) + (p.order ? 1 : 0) + (p.write ? 1 : 0);
  }, [getTextProgress]);

  const isTextComplete = useCallback((topicId: string, textId: string): boolean => {
    const p = getTextProgress(topicId, textId);
    return p.fill && p.order && p.write;
  }, [getTextProgress]);

  const getCompletionPercentage = useCallback((topicId: string, textId: string): number => {
    return Math.round((getCompletionCount(topicId, textId) / 3) * 100);
  }, [getCompletionCount]);

  return {
    getTextProgress,
    setModeComplete,
    resetTextProgress,
    getCompletionCount,
    isTextComplete,
    getCompletionPercentage
  };
}
