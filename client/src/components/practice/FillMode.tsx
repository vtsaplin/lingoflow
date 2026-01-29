import { useMemo, useEffect, useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Check, RotateCcw, CheckCircle2, XCircle, Puzzle, ChevronLeft, ChevronRight } from "lucide-react";
import type { FillModeState, FillSentenceState, ValidationState } from "./types";
import { useTTS } from "@/hooks/use-services";
import { useSettings } from "@/hooks/use-settings";

interface FillModeProps {
  paragraphs: string[];
  state: FillModeState;
  onStateChange: (state: FillModeState) => void;
  onResetProgress?: () => void;
  isCompleted?: boolean;
}

interface GapInfo {
  id: number;
  original: string;
}

interface TemplateItem {
  type: "text" | "gap";
  content?: string;
  gapId?: number;
}

interface SentenceData {
  original: string;
  template: TemplateItem[];
  gapLookup: Record<number, GapInfo>;
  allGapWords: string[];
}

export function FillMode({ paragraphs, state, onStateChange, onResetProgress, isCompleted = false }: FillModeProps) {
  const sentences = useMemo(() => {
    return extractSentencesWithGaps(paragraphs);
  }, [paragraphs]);

  const { currentIndex, sentenceStates } = state;
  
  // State hooks must be at the top, before any conditional returns
  const [selectedWord, setSelectedWord] = useState<{ word: string; index: number } | null>(null);
  
  // All callbacks with hooks must also be at top level
  const handleFullReset = useCallback(() => {
    const initialStates: Record<number, FillSentenceState> = {};
    sentences.forEach((_, idx) => {
      initialStates[idx] = {
        placedWords: {},
        availableWords: [],
        validationState: "idle",
        incorrectGaps: [],
      };
    });
    onStateChange({
      currentIndex: 0,
      sentenceStates: initialStates,
      initialized: true,
      flashcardCount: 0,
    });
    onResetProgress?.();
  }, [sentences, onStateChange, onResetProgress]);

  useEffect(() => {
    const sentenceCountMismatch = Object.keys(state.sentenceStates).length !== sentences.length;
    const needsReinit = !state.initialized || sentenceCountMismatch;
    
    if (sentences.length > 0 && needsReinit) {
      const initialStates: Record<number, FillSentenceState> = {};
      const shouldRestoreCompleted = isCompleted && !sentenceCountMismatch;
      
      sentences.forEach((sentence, idx) => {
        if (shouldRestoreCompleted) {
          const correctPlacements: Record<number, string> = {};
          Object.entries(sentence.gapLookup).forEach(([id, gap]) => {
            correctPlacements[Number(id)] = gap.original;
          });
          initialStates[idx] = {
            placedWords: correctPlacements,
            availableWords: [],
            validationState: "correct",
            incorrectGaps: [],
          };
        } else {
          initialStates[idx] = {
            placedWords: {},
            availableWords: [],
            validationState: "idle",
            incorrectGaps: [],
          };
        }
      });
      onStateChange({
        currentIndex: 0,
        sentenceStates: initialStates,
        initialized: true,
        flashcardCount: 0,
      });
    }
  }, [sentences, state.initialized, onStateChange, isCompleted]);

  // Define these variables before hooks that use them (to satisfy hook rules)
  const currentSentence = sentences[currentIndex] || { original: "", template: [], gapLookup: {}, allGapWords: [] };
  const currentState = sentenceStates[currentIndex] || {
    placedWords: {},
    availableWords: [],
    validationState: "idle" as ValidationState,
    incorrectGaps: [],
  };
  const { placedWords, validationState, incorrectGaps } = currentState;
  const incorrectGapsSet = new Set(incorrectGaps);
  
  const tts = useTTS();
  const { settings } = useSettings();
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  
  // Play sentence audio when validation is correct
  useEffect(() => {
    if (validationState === "correct" && currentSentence.original) {
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      }
      tts.mutate(
        { text: currentSentence.original, speed: 1.0, voice: settings.ttsVoice },
        {
          onSuccess: (blob) => {
            const url = URL.createObjectURL(blob);
            const audio = new Audio(url);
            currentAudioRef.current = audio;
            audio.play().catch(() => {});
            audio.onended = () => {
              URL.revokeObjectURL(url);
              if (currentAudioRef.current === audio) {
                currentAudioRef.current = null;
              }
            };
          }
        }
      );
    }
  }, [validationState, currentSentence.original]);
  
  const placedWordsSet = new Set(Object.values(placedWords).filter(Boolean) as string[]);
  const availableWords = shuffleArraySeeded(
    currentSentence.allGapWords.filter(w => !placedWordsSet.has(w)),
    hashString(currentSentence.original + "wordbank")
  );

  const updateCurrentSentenceState = (updates: Partial<FillSentenceState>) => {
    onStateChange({
      ...state,
      sentenceStates: {
        ...sentenceStates,
        [currentIndex]: { ...currentState, ...updates },
      },
    });
  };

  const handleWordBankClick = (word: string, index: number) => {
    if (selectedWord?.index === index) {
      setSelectedWord(null);
    } else {
      setSelectedWord({ word, index });
    }
  };

  const handleGapClick = (gapId: number) => {
    const existingWord = placedWords[gapId];
    
    if (selectedWord) {
      updateCurrentSentenceState({
        placedWords: { ...placedWords, [gapId]: selectedWord.word },
        validationState: "idle",
        incorrectGaps: [],
      });
      setSelectedWord(null);
    } else if (existingWord) {
      updateCurrentSentenceState({
        placedWords: { ...placedWords, [gapId]: null },
        validationState: "idle",
        incorrectGaps: [],
      });
    }
  };

  const handleDragStart = (e: React.DragEvent, word: string, fromGap?: number) => {
    e.dataTransfer.setData("text/plain", word);
    e.dataTransfer.setData("fromGap", fromGap !== undefined ? String(fromGap) : "");
  };

  const handleDrop = (e: React.DragEvent, gapId: number) => {
    e.preventDefault();
    const word = e.dataTransfer.getData("text/plain");
    const fromGapStr = e.dataTransfer.getData("fromGap");
    const fromGap = fromGapStr ? parseInt(fromGapStr) : null;

    const existingWordInTarget = placedWords[gapId];

    if (fromGap !== null) {
      const newPlaced = { ...placedWords, [gapId]: word };
      if (fromGap !== gapId) {
        newPlaced[fromGap] = existingWordInTarget || null;
      }
      updateCurrentSentenceState({
        placedWords: newPlaced,
        validationState: "idle",
        incorrectGaps: [],
      });
    } else {
      updateCurrentSentenceState({
        placedWords: { ...placedWords, [gapId]: word },
        validationState: "idle",
        incorrectGaps: [],
      });
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const checkAnswers = useCallback(() => {
    let allCorrect = true;
    const newIncorrect: number[] = [];

    for (const [gapIdStr, gap] of Object.entries(currentSentence.gapLookup)) {
      const gapId = Number(gapIdStr);
      const placed = placedWords[gapId];
      if (!placed || placed.toLowerCase() !== gap.original.toLowerCase()) {
        allCorrect = false;
        newIncorrect.push(gapId);
      }
    }

    updateCurrentSentenceState({
      incorrectGaps: newIncorrect,
      validationState: allCorrect ? "correct" : "incorrect",
    });
  }, [currentSentence.gapLookup, placedWords, updateCurrentSentenceState]);

  // Auto-check when all gaps are filled
  useEffect(() => {
    if (validationState !== "idle") return;
    if (!state.initialized || sentences.length === 0) return;
    
    const gapIds = Object.keys(currentSentence.gapLookup).map(Number);
    const allFilled = gapIds.every(gapId => placedWords[gapId]);
    
    if (allFilled && gapIds.length > 0) {
      checkAnswers();
    }
  }, [placedWords, currentSentence.gapLookup, validationState, checkAnswers, state.initialized, sentences.length]);

  // Early returns AFTER all hooks
  if (sentences.length === 0) {
    return (
      <div className="flex flex-col h-full items-center justify-center px-6 py-12">
        <Puzzle className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground text-center">
          No sentences found in this text.
        </p>
      </div>
    );
  }

  if (!state.initialized) {
    return null;
  }

  const handleCheck = () => {
    checkAnswers();
  };

  const handleReset = () => {
    updateCurrentSentenceState({
      placedWords: {},
      validationState: "idle",
      incorrectGaps: [],
    });
  };

  const handleNext = () => {
    if (currentIndex < sentences.length - 1) {
      onStateChange({ ...state, currentIndex: currentIndex + 1 });
      setSelectedWord(null);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      onStateChange({ ...state, currentIndex: currentIndex - 1 });
      setSelectedWord(null);
    }
  };

  const completedCount = Object.values(sentenceStates).filter(s => s.validationState === "correct").length;
  const allComplete = completedCount === sentences.length;

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto px-6 sm:px-8 py-6">
        <div className="max-w-3xl mx-auto">
          <p className="text-sm text-muted-foreground mb-2">
            Fill in the gaps with the correct words. Click a word to select it, then click a gap to place it.
          </p>
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-muted-foreground">
              Sentence {currentIndex + 1} of {sentences.length}
            </span>
            <span className={`text-sm font-medium ${allComplete ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}`}>
              {completedCount} / {sentences.length} complete
            </span>
          </div>

          <div className="bg-card border rounded-lg p-6 mb-4">
            <p className="font-serif text-lg leading-relaxed text-foreground/90">
              {currentSentence.template.map((item, idx) => {
                if (item.type === "text") {
                  return <span key={idx}>{item.content}</span>;
                }
                const gapId = item.gapId!;
                const placed = placedWords[gapId];
                const isIncorrect = incorrectGapsSet.has(gapId);
                const isCorrect = validationState === "correct";

                return (
                  <span
                    key={idx}
                    onClick={() => handleGapClick(gapId)}
                    onDrop={(e) => handleDrop(e, gapId)}
                    onDragOver={handleDragOver}
                    draggable={!!placed}
                    onDragStart={(e) => placed && handleDragStart(e, placed, gapId)}
                    data-testid={`gap-${gapId}`}
                    className={`inline-block min-w-[40px] mx-0.5 px-1 py-0.5 text-center border-b-2 border-dashed cursor-pointer transition-colors ${
                      isIncorrect
                        ? "border-destructive bg-destructive/10 text-destructive"
                        : isCorrect
                          ? "border-green-500 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400"
                          : placed
                            ? "border-primary bg-primary/10"
                            : "border-muted-foreground/50 hover:border-primary hover:bg-muted/50"
                    }`}
                  >
                    {placed || "___"}
                  </span>
                );
              })}
            </p>
          </div>

          <div className="bg-muted/30 border rounded-lg p-4">
            <p className="text-sm text-muted-foreground mb-2">Word bank:</p>
            <div className="flex flex-wrap gap-2">
              {availableWords.map((word, idx) => (
                <span
                  key={`${word}-${idx}`}
                  draggable
                  onDragStart={(e) => handleDragStart(e, word)}
                  onClick={() => handleWordBankClick(word, idx)}
                  data-testid={`wordbank-${word}-${idx}`}
                  className={`px-3 py-1.5 bg-background border rounded cursor-grab hover-elevate active-elevate-2 select-none ${
                    selectedWord?.index === idx ? "ring-2 ring-primary" : ""
                  }`}
                >
                  {word}
                </span>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrev}
              disabled={currentIndex === 0}
              data-testid="button-prev-sentence"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleNext}
              disabled={currentIndex === sentences.length - 1}
              data-testid="button-next-sentence"
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      </div>

      <div className="border-t bg-card px-6 sm:px-8 py-4">
        <div className="max-w-3xl mx-auto">
          {validationState === "correct" && (
            <div className="flex items-center gap-2 mb-4 text-green-600 dark:text-green-400">
              <CheckCircle2 className="h-5 w-5" />
              <span className="font-medium">Correct!</span>
            </div>
          )}
          {validationState === "incorrect" && (
            <div className="flex items-center gap-2 mb-4 text-destructive">
              <XCircle className="h-5 w-5" />
              <span className="font-medium">Some words are incorrect. Try again!</span>
            </div>
          )}

          <div className="flex gap-2">
            <Button onClick={handleCheck} data-testid="button-check">
              <Check className="h-4 w-4 mr-2" />
              Check
            </Button>
            <Button variant="outline" onClick={handleReset} data-testid="button-reset">
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset
            </Button>
            <Button variant="ghost" onClick={handleFullReset} data-testid="button-full-reset">
              Reset All
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function extractSentencesWithGaps(paragraphs: string[]): SentenceData[] {
  const result: SentenceData[] = [];
  let globalGapId = 0;

  paragraphs.forEach(para => {
    const sentenceMatches = para.match(/[^.!?]+[.!?]+["']?|[^.!?]+$/g) || [];
    
    sentenceMatches.forEach(sentence => {
      const trimmed = sentence.trim();
      if (!trimmed) return;

      const words = trimmed.split(/(\s+)/);
      const template: TemplateItem[] = [];
      const gapLookup: Record<number, GapInfo> = {};
      const allGapWords: string[] = [];
      let currentText = "";

      const cleanWords = words.filter(w => w.trim()).map(w => w.replace(/[.,!?;:«»„"'"]/g, "").trim().toLowerCase());
      const eligibleWords = cleanWords.filter(w => w.length >= 3);
      const totalWordCount = eligibleWords.length;
      
      if (totalWordCount < 2) return;

      const maxGaps = Math.max(1, Math.min(3, Math.ceil(totalWordCount * 0.3)));
      
      const uniqueWords = Array.from(new Set(eligibleWords));
      const seed = hashString(trimmed);
      const shuffledWords = shuffleArraySeeded(uniqueWords, seed);
      const wordsToGap = new Set(shuffledWords.slice(0, maxGaps));
      const usedInSentence = new Set<string>();

      words.forEach((w) => {
        const cleanWord = w.replace(/[.,!?;:«»„"'"]/g, "").trim();
        const cleanWordLower = cleanWord.toLowerCase();
        const shouldGap = cleanWord.length >= 3 && wordsToGap.has(cleanWordLower) && !usedInSentence.has(cleanWordLower);

        if (shouldGap) {
          usedInSentence.add(cleanWordLower);
          if (currentText) {
            template.push({ type: "text", content: currentText });
            currentText = "";
          }
          const gapId = globalGapId++;
          gapLookup[gapId] = { id: gapId, original: cleanWord };
          allGapWords.push(cleanWord);
          template.push({ type: "gap", gapId });
          const punctuation = w.match(/[.,!?;:«»„"'"]+$/)?.[0] || "";
          if (punctuation) {
            template.push({ type: "text", content: punctuation });
          }
        } else {
          currentText += w;
        }
      });

      if (currentText) {
        template.push({ type: "text", content: currentText });
      }

      if (allGapWords.length > 0) {
        result.push({
          original: trimmed,
          template,
          gapLookup,
          allGapWords,
        });
      }
    });
  });

  return result;
}

function shuffleArraySeeded<T>(array: T[], seed: number): T[] {
  const result = [...array];
  let s = seed;
  const random = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}
