import { useState, useEffect, useCallback } from "react";
import { createInitialPracticeState, type PracticeState, type FillModeState, type OrderModeState, type WriteModeState, type CardsModeState, type SpeakModeState } from "@/components/practice/types";

const STORAGE_KEY = "lingoflow-practice-state";

interface StoredPracticeStates {
  [textKey: string]: PracticeState;
}

function migrateState(stored: Partial<PracticeState>): PracticeState {
  const defaults = createInitialPracticeState();
  return {
    fill: { ...defaults.fill, ...stored.fill },
    order: { ...defaults.order, ...stored.order },
    write: { ...defaults.write, ...stored.write },
    cards: { ...defaults.cards, ...stored.cards },
    speak: { ...defaults.speak, ...stored.speak },
  };
}

function loadFromStorage(): StoredPracticeStates {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch {}
  return {};
}

function saveToStorage(states: StoredPracticeStates) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(states));
  } catch {}
}

export function usePracticeState(topicId: string, textId: string) {
  const textKey = `${topicId}-${textId}`;
  
  const [practiceState, setPracticeStateInternal] = useState<PracticeState>(() => {
    const stored = loadFromStorage();
    return stored[textKey] ? migrateState(stored[textKey]) : createInitialPracticeState();
  });

  const [activeTextKey, setActiveTextKey] = useState(textKey);

  useEffect(() => {
    if (activeTextKey !== textKey) {
      setActiveTextKey(textKey);
      const stored = loadFromStorage();
      setPracticeStateInternal(stored[textKey] ? migrateState(stored[textKey]) : createInitialPracticeState());
    }
  }, [textKey, activeTextKey]);

  useEffect(() => {
    if (activeTextKey !== textKey) return;
    
    const stored = loadFromStorage();
    stored[textKey] = practiceState;
    saveToStorage(stored);
  }, [practiceState, textKey, activeTextKey]);

  const updateFillState = useCallback((newState: FillModeState) => {
    setPracticeStateInternal(prev => ({ ...prev, fill: newState }));
  }, []);

  const updateOrderState = useCallback((newState: OrderModeState) => {
    setPracticeStateInternal(prev => ({ ...prev, order: newState }));
  }, []);

  const updateWriteState = useCallback((newState: WriteModeState) => {
    setPracticeStateInternal(prev => ({ ...prev, write: newState }));
  }, []);

  const updateCardsState = useCallback((newState: CardsModeState) => {
    setPracticeStateInternal(prev => ({ ...prev, cards: newState }));
  }, []);

  const updateSpeakState = useCallback((newState: SpeakModeState) => {
    setPracticeStateInternal(prev => ({ ...prev, speak: newState }));
  }, []);

  const resetPracticeState = useCallback(() => {
    const newState = createInitialPracticeState();
    setPracticeStateInternal(newState);
    
    const stored = loadFromStorage();
    delete stored[textKey];
    saveToStorage(stored);
  }, [textKey]);

  return {
    practiceState,
    updateFillState,
    updateOrderState,
    updateWriteState,
    updateCardsState,
    updateSpeakState,
    resetPracticeState,
    textKey,
    activeTextKey
  };
}

export function clearPracticeStateForText(topicId: string, textId: string) {
  const textKey = `${topicId}-${textId}`;
  const stored = loadFromStorage();
  delete stored[textKey];
  saveToStorage(stored);
}
