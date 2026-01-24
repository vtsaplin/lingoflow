import { useMemo, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, RotateCcw, ChevronLeft, ChevronRight, CheckCircle2, XCircle, ArrowUpDown, Languages, Loader2 } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { OrderModeState, OrderSentenceState } from "./types";

interface OrderModeProps {
  sentences: string[];
  state: OrderModeState;
  onStateChange: (state: OrderModeState) => void;
  onResetProgress?: () => void;
  isCompleted?: boolean;
}

interface SentenceWithWords {
  original: string;
  words: string[];
}

export function OrderMode({ sentences: inputSentences, state, onStateChange, onResetProgress, isCompleted = false }: OrderModeProps) {
  const [translations, setTranslations] = useState<Record<number, string>>({});
  
  const translateMutation = useMutation({
    mutationFn: async ({ text, index }: { text: string; index: number }) => {
      const res = await apiRequest("POST", "/api/translate", { text });
      const data = await res.json();
      return { translation: data.translation, index };
    },
    onSuccess: (data) => {
      setTranslations(prev => ({ ...prev, [data.index]: data.translation }));
    },
  });

  const sentences = useMemo(() => {
    return inputSentences.map(s => ({
      original: s,
      words: extractWords(s)
    })).filter(s => s.words.length >= 3);
  }, [inputSentences]);
  
  const { currentIndex, sentenceStates, flashcardCount: savedCount } = state;

  useEffect(() => {
    const countIncreased = inputSentences.length > savedCount && savedCount > 0;
    const countDecreased = inputSentences.length < savedCount && savedCount > 0;
    
    const statesMatchSentences = sentences.every((sentence, idx) => {
      const stored = sentenceStates[idx];
      if (!stored) return false;
      const storedAllWords = [...stored.shuffledWords, ...stored.orderedWords];
      return storedAllWords.length === sentence.words.length;
    });
    
    const needsReinit = !state.initialized || countIncreased || countDecreased || !statesMatchSentences;
    
    if (sentences.length > 0 && needsReinit) {
      const initialStates: Record<number, OrderSentenceState> = {};
      sentences.forEach((sentence, idx) => {
        if (isCompleted && !needsReinit) {
          initialStates[idx] = {
            shuffledWords: [],
            orderedWords: [...sentence.words],
            validationState: "correct",
          };
        } else {
          initialStates[idx] = {
            shuffledWords: shuffleArray([...sentence.words]),
            orderedWords: [],
            validationState: "idle",
          };
        }
      });
      onStateChange({
        currentIndex: 0,
        sentenceStates: initialStates,
        initialized: true,
        flashcardCount: inputSentences.length,
      });
    } else if (countDecreased && sentences.length === 0) {
      onStateChange({
        currentIndex: 0,
        sentenceStates: {},
        initialized: true,
        flashcardCount: inputSentences.length,
      });
    }
  }, [sentences, state.initialized, sentenceStates, onStateChange, isCompleted, inputSentences.length, savedCount]);

  if (inputSentences.length === 0) {
    return (
      <div className="flex flex-col h-full items-center justify-center px-6 py-12">
        <ArrowUpDown className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground text-center">
          No sentences found in this text.
        </p>
        <p className="text-sm text-muted-foreground text-center mt-2">
          This text doesn't have any sentences long enough for ordering practice.
        </p>
      </div>
    );
  }

  if (sentences.length === 0) {
    return (
      <div className="flex flex-col h-full items-center justify-center px-6 py-12">
        <ArrowUpDown className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground text-center">
          Sentences are too short for practice.
        </p>
        <p className="text-sm text-muted-foreground text-center mt-2">
          Sentences need at least 3 words for ordering practice.
        </p>
      </div>
    );
  }

  if (!state.initialized) {
    return null;
  }

  const currentSentence = sentences[currentIndex];
  const currentState = sentenceStates[currentIndex] || {
    shuffledWords: [],
    orderedWords: [],
    validationState: "idle" as const,
  };
  const { shuffledWords, orderedWords, validationState } = currentState;
  const completedCount = Object.values(sentenceStates).filter(s => s.validationState === "correct").length;

  const updateCurrentSentenceState = (updates: Partial<OrderSentenceState>) => {
    onStateChange({
      ...state,
      sentenceStates: {
        ...sentenceStates,
        [currentIndex]: { ...currentState, ...updates },
      },
    });
  };

  const handleWordClick = (word: string, fromOrdered: boolean) => {
    if (fromOrdered) {
      const idx = orderedWords.indexOf(word);
      if (idx !== -1) {
        updateCurrentSentenceState({
          orderedWords: orderedWords.filter((_, i) => i !== idx),
          shuffledWords: [...shuffledWords, word],
          validationState: "idle",
        });
      }
    } else {
      const idx = shuffledWords.indexOf(word);
      if (idx !== -1) {
        updateCurrentSentenceState({
          shuffledWords: shuffledWords.filter((_, i) => i !== idx),
          orderedWords: [...orderedWords, word],
          validationState: "idle",
        });
      }
    }
  };

  const handleDragStart = (e: React.DragEvent, word: string, fromOrdered: boolean, index: number) => {
    e.dataTransfer.setData("word", word);
    e.dataTransfer.setData("fromOrdered", String(fromOrdered));
    e.dataTransfer.setData("index", String(index));
  };

  const handleDropOnOrdered = (e: React.DragEvent, dropIndex?: number) => {
    e.preventDefault();
    const word = e.dataTransfer.getData("word");
    const fromOrdered = e.dataTransfer.getData("fromOrdered") === "true";
    const originalIndex = parseInt(e.dataTransfer.getData("index"));

    if (fromOrdered) {
      if (dropIndex !== undefined && dropIndex !== originalIndex) {
        const newOrdered = [...orderedWords];
        newOrdered.splice(originalIndex, 1);
        newOrdered.splice(dropIndex > originalIndex ? dropIndex - 1 : dropIndex, 0, word);
        updateCurrentSentenceState({
          orderedWords: newOrdered,
          validationState: "idle",
        });
      }
    } else {
      const newShuffled = shuffledWords.filter((_, i) => i !== originalIndex);
      const newOrdered = dropIndex !== undefined 
        ? [...orderedWords.slice(0, dropIndex), word, ...orderedWords.slice(dropIndex)]
        : [...orderedWords, word];
      updateCurrentSentenceState({
        shuffledWords: newShuffled,
        orderedWords: newOrdered,
        validationState: "idle",
      });
    }
  };

  const handleDropOnShuffled = (e: React.DragEvent) => {
    e.preventDefault();
    const word = e.dataTransfer.getData("word");
    const fromOrdered = e.dataTransfer.getData("fromOrdered") === "true";
    const originalIndex = parseInt(e.dataTransfer.getData("index"));

    if (fromOrdered) {
      updateCurrentSentenceState({
        orderedWords: orderedWords.filter((_, i) => i !== originalIndex),
        shuffledWords: [...shuffledWords, word],
        validationState: "idle",
      });
    }
  };

  const handleCheck = () => {
    const userAnswer = orderedWords.join(" ");
    const correctAnswer = currentSentence.words.join(" ");
    const isCorrect = userAnswer === correctAnswer;
    updateCurrentSentenceState({
      validationState: isCorrect ? "correct" : "incorrect",
    });
  };

  const handleReset = () => {
    updateCurrentSentenceState({
      shuffledWords: shuffleArray([...currentSentence.words]),
      orderedWords: [],
      validationState: "idle",
    });
  };

  const handleNext = () => {
    if (currentIndex < sentences.length - 1) {
      onStateChange({ ...state, currentIndex: currentIndex + 1 });
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      onStateChange({ ...state, currentIndex: currentIndex - 1 });
    }
  };

  const handleTranslate = () => {
    if (!translations[currentIndex] && !translateMutation.isPending) {
      translateMutation.mutate({ text: currentSentence.original, index: currentIndex });
    }
  };

  const currentTranslation = translations[currentIndex];

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto px-6 sm:px-8 py-6">
        <div className="max-w-3xl mx-auto">
          <p className="text-sm text-muted-foreground mb-4">
            Arrange the words in the correct order to form the sentence. Click or drag words to move them.
          </p>
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-muted-foreground">
              Sentence {currentIndex + 1} of {sentences.length}
            </span>
            <span className={`text-sm font-medium ${completedCount === sentences.length ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}`}>
              {completedCount} / {sentences.length} complete
            </span>
          </div>
          
          <div className="mb-6 p-4 bg-card rounded-lg border" data-testid="text-translation-hint">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Translation hint:</p>
              {!currentTranslation && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleTranslate}
                  disabled={translateMutation.isPending}
                  data-testid="button-show-translation"
                >
                  {translateMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Languages className="h-4 w-4 mr-1" />
                      Show
                    </>
                  )}
                </Button>
              )}
            </div>
            {currentTranslation ? (
              <p className="text-base font-medium">{currentTranslation}</p>
            ) : (
              <p className="text-sm text-muted-foreground italic">Click "Show" to see translation</p>
            )}
          </div>

          <div className="space-y-4">
            <div
              className={`bg-card border rounded-lg p-6 transition-colors ${
                validationState === "correct"
                  ? "border-green-500"
                  : validationState === "incorrect"
                    ? "border-destructive"
                    : ""
              }`}
              onDrop={(e) => handleDropOnOrdered(e)}
              onDragOver={(e) => e.preventDefault()}
              data-testid="ordered-area"
            >
              <div className="flex flex-wrap gap-2 min-h-[40px]">
                {orderedWords.length === 0 && (
                  <p className="text-sm text-muted-foreground italic">Drag or click words to place them here</p>
                )}
                {orderedWords.map((word, idx) => (
                  <span
                    key={`ordered-${idx}`}
                    onClick={() => handleWordClick(word, true)}
                    draggable
                    onDragStart={(e) => handleDragStart(e, word, true, idx)}
                    onDrop={(e) => handleDropOnOrdered(e, idx)}
                    onDragOver={(e) => e.preventDefault()}
                    className={`px-3 py-1.5 rounded cursor-pointer transition-all hover-elevate active-elevate-2 select-none ${
                      validationState === "correct"
                        ? "bg-green-100 dark:bg-green-900/30 border border-green-500 text-green-700 dark:text-green-400"
                        : validationState === "incorrect"
                          ? "bg-destructive/10 border border-destructive text-destructive"
                          : "bg-primary/10 border border-primary/30 text-primary"
                    }`}
                    data-testid={`ordered-word-${idx}`}
                  >
                    {word}
                  </span>
                ))}
              </div>
            </div>

            <div
              className="bg-muted/30 border rounded-lg p-4"
              onDrop={handleDropOnShuffled}
              onDragOver={(e) => e.preventDefault()}
              data-testid="shuffled-area"
            >
              <p className="text-sm text-muted-foreground mb-2">Word bank:</p>
              <div className="flex flex-wrap gap-2">
                {shuffledWords.length === 0 && orderedWords.length > 0 && (
                  <p className="text-sm text-muted-foreground italic">All words placed</p>
                )}
                {shuffledWords.map((word, idx) => (
                  <button
                    key={`shuffled-${idx}`}
                    onClick={() => handleWordClick(word, false)}
                    draggable
                    onDragStart={(e) => handleDragStart(e, word, false, idx)}
                    className="px-3 py-1.5 bg-background border rounded cursor-grab hover-elevate active-elevate-2 select-none"
                    data-testid={`shuffled-word-${idx}`}
                  >
                    {word}
                  </button>
                ))}
              </div>
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
              <span className="font-medium">Word order is incorrect. Try again!</span>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              onClick={handleCheck}
              disabled={orderedWords.length !== currentSentence.words.length || validationState !== "idle"}
              data-testid="button-check"
            >
              <Check className="h-4 w-4 mr-2" />
              Check
            </Button>
            <Button variant="outline" onClick={handleReset} data-testid="button-reset">
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset
            </Button>
            {onResetProgress && (
              <Button 
                variant="ghost" 
                onClick={() => {
                  onResetProgress();
                  setTranslations({});
                  onStateChange({
                    currentIndex: 0,
                    sentenceStates: {},
                    initialized: false,
                    flashcardCount: inputSentences.length,
                  });
                }} 
                data-testid="button-reset-all"
              >
                Reset All
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function extractWords(text: string): string[] {
  return text
    .split(/\s+/)
    .map(word => word.trim())
    .filter(word => word.length > 0);
}

function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
