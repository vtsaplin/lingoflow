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
    const needsReinit = !state.initialized || countIncreased || countDecreased;
    
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
  }, [sentences, state.initialized, onStateChange, isCompleted, inputSentences.length, savedCount]);

  if (inputSentences.length === 0) {
    return (
      <div className="flex flex-col h-full items-center justify-center px-6 py-12">
        <ArrowUpDown className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground text-center">
          No sentences with flashcard words found.
        </p>
        <p className="text-sm text-muted-foreground text-center mt-2">
          Add words to your flashcards in Study mode to practice sentence ordering.
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
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={handlePrev}
                disabled={currentIndex === 0}
                data-testid="button-prev-sentence"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={handleNext}
                disabled={currentIndex === sentences.length - 1}
                data-testid="button-next-sentence"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          <div className="mb-6 p-4 bg-muted/30 rounded-lg border" data-testid="text-translation-hint">
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

          <div className="space-y-6">
            <div
              className={`min-h-[100px] p-4 rounded-lg border-2 border-dashed transition-colors ${
                orderedWords.length > 0
                  ? validationState === "correct"
                    ? "bg-green-50 dark:bg-green-900/20 border-green-500"
                    : validationState === "incorrect"
                      ? "bg-destructive/10 border-destructive"
                      : "bg-primary/5 border-primary/30"
                  : "bg-muted/30 border-muted-foreground/30"
              }`}
              onDrop={(e) => handleDropOnOrdered(e)}
              onDragOver={(e) => e.preventDefault()}
              data-testid="ordered-area"
            >
              <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wider">Your answer:</p>
              <div className="flex flex-wrap gap-2">
                {orderedWords.length === 0 && (
                  <p className="text-sm text-muted-foreground italic">Drag or click words to place them here</p>
                )}
                {orderedWords.map((word, idx) => (
                  <button
                    key={`ordered-${idx}`}
                    onClick={() => handleWordClick(word, true)}
                    draggable
                    onDragStart={(e) => handleDragStart(e, word, true, idx)}
                    onDrop={(e) => handleDropOnOrdered(e, idx)}
                    onDragOver={(e) => e.preventDefault()}
                    className={`px-3 py-2 rounded-md font-medium cursor-pointer transition-all hover-elevate active-elevate-2 ${
                      validationState === "correct"
                        ? "bg-green-500 text-white"
                        : validationState === "incorrect"
                          ? "bg-destructive text-destructive-foreground"
                          : "bg-primary text-primary-foreground"
                    }`}
                    data-testid={`ordered-word-${idx}`}
                  >
                    {word}
                  </button>
                ))}
              </div>
            </div>

            <div
              className="min-h-[80px] p-4 rounded-lg bg-muted/50"
              onDrop={handleDropOnShuffled}
              onDragOver={(e) => e.preventDefault()}
              data-testid="shuffled-area"
            >
              <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wider">Available words:</p>
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
                    className="px-3 py-2 rounded-md bg-secondary text-secondary-foreground font-medium cursor-pointer transition-all hover-elevate active-elevate-2"
                    data-testid={`shuffled-word-${idx}`}
                  >
                    {word}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 mt-6 text-sm">
            {Object.values(sentenceStates).map((s, idx) => (
              <div
                key={idx}
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                  s.validationState === "correct"
                    ? "bg-green-500 text-white"
                    : idx === currentIndex
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                }`}
                data-testid={`sentence-indicator-${idx}`}
              >
                {s.validationState === "correct" ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : s.validationState === "incorrect" ? (
                  <XCircle className="h-4 w-4" />
                ) : (
                  idx + 1
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      
      <div className="border-t bg-card">
        <div className="max-w-3xl mx-auto px-6 sm:px-8 py-4 flex items-center justify-between gap-4">
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
              Reset Sentence
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
