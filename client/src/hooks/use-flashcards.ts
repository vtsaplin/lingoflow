import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "lingoflow-flashcards";

export interface Flashcard {
  id: string;
  german: string;
  baseForm?: string;
  translation: string;
  topicId: string;
  textId: string;
  createdAt: number;
}

interface FlashcardStore {
  cards: Flashcard[];
}

let flashcardState: FlashcardStore = loadFromStorage();
const listeners = new Set<() => void>();

function loadFromStorage(): FlashcardStore {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch {}
  return { cards: [] };
}

function saveToStorage(state: FlashcardStore) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

function notifyListeners() {
  listeners.forEach(listener => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): FlashcardStore {
  return flashcardState;
}

function addFlashcardInternal(german: string, translation: string, topicId: string, textId: string, baseForm?: string) {
  const exists = flashcardState.cards.some(
    c => c.german.toLowerCase() === german.toLowerCase() && c.topicId === topicId && c.textId === textId
  );
  if (exists) return false;

  const newCard: Flashcard = {
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    german: german.trim(),
    baseForm: baseForm?.trim(),
    translation: translation.trim(),
    topicId,
    textId,
    createdAt: Date.now()
  };

  flashcardState = {
    cards: [...flashcardState.cards, newCard]
  };
  saveToStorage(flashcardState);
  notifyListeners();
  return true;
}

function removeFlashcardInternal(id: string) {
  flashcardState = {
    cards: flashcardState.cards.filter(c => c.id !== id)
  };
  saveToStorage(flashcardState);
  notifyListeners();
}

function clearFlashcardsForTextInternal(topicId: string, textId: string) {
  flashcardState = {
    cards: flashcardState.cards.filter(c => !(c.topicId === topicId && c.textId === textId))
  };
  saveToStorage(flashcardState);
  notifyListeners();
}

export function useFlashcards() {
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const addFlashcard = useCallback((german: string, translation: string, topicId: string, textId: string, baseForm?: string) => {
    return addFlashcardInternal(german, translation, topicId, textId, baseForm);
  }, []);

  const removeFlashcard = useCallback((id: string) => {
    removeFlashcardInternal(id);
  }, []);

  const getFlashcardsForText = useCallback((topicId: string, textId: string): Flashcard[] => {
    return state.cards.filter(c => c.topicId === topicId && c.textId === textId);
  }, [state.cards]);

  const getAllFlashcards = useCallback((): Flashcard[] => {
    return state.cards;
  }, [state.cards]);

  const hasFlashcard = useCallback((german: string, topicId: string, textId: string): boolean => {
    return state.cards.some(
      c => c.german.toLowerCase() === german.toLowerCase() && c.topicId === topicId && c.textId === textId
    );
  }, [state.cards]);

  const getFlashcardByGerman = useCallback((german: string, topicId: string, textId: string): Flashcard | undefined => {
    return state.cards.find(
      c => c.german.toLowerCase() === german.toLowerCase() && c.topicId === topicId && c.textId === textId
    );
  }, [state.cards]);

  const clearFlashcardsForText = useCallback((topicId: string, textId: string) => {
    clearFlashcardsForTextInternal(topicId, textId);
  }, []);

  const getFlashcardCount = useCallback((): number => {
    return state.cards.length;
  }, [state.cards]);

  const exportToCSV = useCallback((): string => {
    const headers = ["German", "Translation", "Topic ID", "Text ID", "Created"];
    const rows = state.cards.map(c => [
      `"${c.german.replace(/"/g, '""')}"`,
      `"${c.translation.replace(/"/g, '""')}"`,
      c.topicId,
      c.textId,
      new Date(c.createdAt).toISOString()
    ]);
    return [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
  }, [state.cards]);

  return {
    cards: state.cards,
    addFlashcard,
    removeFlashcard,
    getFlashcardsForText,
    getAllFlashcards,
    hasFlashcard,
    getFlashcardByGerman,
    clearFlashcardsForText,
    getFlashcardCount,
    exportToCSV
  };
}
