import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "lingoflow-saved-sentences";

export interface SavedSentence {
  id: string;
  german: string;
  translation: string;
  topicId: string;
  textId: string;
  createdAt: number;
}

interface SentenceStore {
  sentences: SavedSentence[];
}

let sentenceState: SentenceStore = loadFromStorage();
const listeners = new Set<() => void>();

function loadFromStorage(): SentenceStore {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch {}
  return { sentences: [] };
}

function saveToStorage(state: SentenceStore) {
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

function getSnapshot(): SentenceStore {
  return sentenceState;
}

function addSentenceInternal(german: string, translation: string, topicId: string, textId: string) {
  const normalizedGerman = german.trim();
  const exists = sentenceState.sentences.some(
    s => s.german === normalizedGerman && s.topicId === topicId && s.textId === textId
  );
  if (exists) return false;

  const newSentence: SavedSentence = {
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    german: normalizedGerman,
    translation: translation.trim(),
    topicId,
    textId,
    createdAt: Date.now()
  };

  sentenceState = {
    sentences: [...sentenceState.sentences, newSentence]
  };
  saveToStorage(sentenceState);
  notifyListeners();
  return true;
}

function removeSentenceInternal(id: string) {
  sentenceState = {
    sentences: sentenceState.sentences.filter(s => s.id !== id)
  };
  saveToStorage(sentenceState);
  notifyListeners();
}

function clearSentencesForTextInternal(topicId: string, textId: string) {
  sentenceState = {
    sentences: sentenceState.sentences.filter(s => !(s.topicId === topicId && s.textId === textId))
  };
  saveToStorage(sentenceState);
  notifyListeners();
}

export function useSavedSentences() {
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const addSentence = useCallback((german: string, translation: string, topicId: string, textId: string) => {
    return addSentenceInternal(german, translation, topicId, textId);
  }, []);

  const removeSentence = useCallback((id: string) => {
    removeSentenceInternal(id);
  }, []);

  const getSentencesForText = useCallback((topicId: string, textId: string): SavedSentence[] => {
    return state.sentences.filter(s => s.topicId === topicId && s.textId === textId);
  }, [state.sentences]);

  const getAllSentences = useCallback((): SavedSentence[] => {
    return state.sentences;
  }, [state.sentences]);

  const hasSentence = useCallback((german: string, topicId: string, textId: string): boolean => {
    const normalizedGerman = german.trim();
    return state.sentences.some(
      s => s.german === normalizedGerman && s.topicId === topicId && s.textId === textId
    );
  }, [state.sentences]);

  const clearSentencesForText = useCallback((topicId: string, textId: string) => {
    clearSentencesForTextInternal(topicId, textId);
  }, []);

  const getSentenceCount = useCallback((): number => {
    return state.sentences.length;
  }, [state.sentences]);

  return {
    sentences: state.sentences,
    addSentence,
    removeSentence,
    getSentencesForText,
    getAllSentences,
    hasSentence,
    clearSentencesForText,
    getSentenceCount
  };
}
