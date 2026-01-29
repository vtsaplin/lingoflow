import { useMemo, useEffect, useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Check, RotateCcw, ChevronLeft, ChevronRight, CheckCircle2, XCircle, ArrowUpDown, Loader2, Volume2 } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { OrderModeState, OrderSentenceState } from "./types";
import { useTTS } from "@/hooks/use-services";
import { useSettings } from "@/hooks/use-settings";

interface OrderModeProps {
  sentences: string[];
  state: OrderModeState;
  onStateChange: (state: OrderModeState) => void;
  onResetProgress?: () => void;
  isCompleted?: boolean;
  translations: Record<string, string>;
  onTranslationAdd: (key: string, value: string) => void;
}

interface SentenceWithWords {
  original: string;
  words: string[];
}

function stripPunctuation(word: string): string {
  return word.replace(/[.,!?;:„"»«"'()–—-]+$/g, "").replace(/^[„"»«"'()–—-]+/g, "");
}

export function OrderMode({ sentences: inputSentences, state, onStateChange, onResetProgress, isCompleted = false, translations, onTranslationAdd }: OrderModeProps) {
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const orderedAreaRef = useRef<HTMLDivElement>(null);
  const dragCounter = useRef(0);
  
  const translateMutation = useMutation({
    mutationFn: async ({ text }: { text: string }) => {
      const res = await apiRequest("POST", "/api/translate", { text });
      const data = await res.json();
      return { translation: data.translation, text };
    },
    onSuccess: (data) => {
      onTranslationAdd(data.text, data.translation);
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

  // Auto-fetch translation when sentence changes
  useEffect(() => {
    const sentence = sentences[currentIndex];
    if (state.initialized && sentences.length > 0 && sentence && !translations[sentence.original]) {
      translateMutation.mutate({ text: sentence.original });
    }
  }, [currentIndex, state.initialized, sentences.length, translations]);

  // Define variables before hooks that use them (to satisfy hook rules)
  const currentSentence = sentences[currentIndex] || { original: "", words: [] };
  const currentState = sentenceStates[currentIndex] || {
    shuffledWords: [],
    orderedWords: [],
    validationState: "idle" as const,
  };
  const { shuffledWords, orderedWords, validationState } = currentState;
  const completedCount = Object.values(sentenceStates).filter(s => s.validationState === "correct").length;
  
  const tts = useTTS();
  const { settings } = useSettings();
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const prevValidationStateRef = useRef<string>(validationState);
  
  const playSentence = useCallback(() => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    setIsPlaying(true);
    tts.mutate(
      { text: currentSentence.original, speed: 1.0, voice: settings.ttsVoice },
      {
        onSuccess: (blob) => {
          const url = URL.createObjectURL(blob);
          const audio = new Audio(url);
          currentAudioRef.current = audio;
          audio.play().catch(() => setIsPlaying(false));
          audio.onended = () => {
            URL.revokeObjectURL(url);
            setIsPlaying(false);
            if (currentAudioRef.current === audio) {
              currentAudioRef.current = null;
            }
          };
        },
        onError: () => setIsPlaying(false)
      }
    );
  }, [currentSentence.original, settings.ttsVoice, tts]);
  
  // Play sentence audio only when validation TRANSITIONS to correct (not on mount)
  useEffect(() => {
    const wasNotCorrect = prevValidationStateRef.current !== "correct";
    const isNowCorrect = validationState === "correct";
    prevValidationStateRef.current = validationState;
    
    if (wasNotCorrect && isNowCorrect && currentSentence.original) {
      playSentence();
    }
  }, [validationState, currentSentence.original]);

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
    e.dataTransfer.effectAllowed = "move";
    setIsDragging(true);
  };

  const handleDropOnOrdered = (e: React.DragEvent) => {
    e.preventDefault();
    const insertAt = dropTargetIndex;
    setDropTargetIndex(null);
    setIsDragging(false);
    dragCounter.current = 0;
    
    const word = e.dataTransfer.getData("word");
    const fromOrdered = e.dataTransfer.getData("fromOrdered") === "true";
    const originalIndex = parseInt(e.dataTransfer.getData("index"));

    if (fromOrdered) {
      if (insertAt !== null && insertAt !== originalIndex && insertAt !== originalIndex + 1) {
        const newOrdered = [...orderedWords];
        newOrdered.splice(originalIndex, 1);
        const adjustedIndex = insertAt > originalIndex ? insertAt - 1 : insertAt;
        newOrdered.splice(adjustedIndex, 0, word);
        updateCurrentSentenceState({
          orderedWords: newOrdered,
          validationState: "idle",
        });
      }
    } else {
      const newShuffled = shuffledWords.filter((_, i) => i !== originalIndex);
      const newOrdered = insertAt !== null
        ? [...orderedWords.slice(0, insertAt), word, ...orderedWords.slice(insertAt)]
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
    setDropTargetIndex(null);
    setIsDragging(false);
    dragCounter.current = 0;
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

  const handleDragOverWord = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const midX = rect.left + rect.width / 2;
    const insertIndex = e.clientX < midX ? idx : idx + 1;
    if (dropTargetIndex !== insertIndex) {
      setDropTargetIndex(insertIndex);
    }
  };

  const handleDragEnterOrdered = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current++;
  };

  const handleDragLeaveOrdered = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setDropTargetIndex(null);
    }
  };

  const handleDragEnd = () => {
    setDropTargetIndex(null);
    setIsDragging(false);
    dragCounter.current = 0;
  };

  const checkAnswers = useCallback(() => {
    const userAnswer = orderedWords.join(" ");
    const correctAnswer = currentSentence.words.join(" ");
    const isCorrect = userAnswer === correctAnswer;
    updateCurrentSentenceState({
      validationState: isCorrect ? "correct" : "incorrect",
    });
  }, [orderedWords, currentSentence.words, updateCurrentSentenceState]);

  // Auto-check when all words are placed (word bank is empty)
  useEffect(() => {
    if (validationState !== "idle") return;
    if (!state.initialized || sentences.length === 0) return;
    
    if (shuffledWords.length === 0 && orderedWords.length > 0) {
      checkAnswers();
    }
  }, [shuffledWords.length, orderedWords.length, validationState, checkAnswers, state.initialized, sentences.length]);

  // Early returns AFTER all hooks
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

  const handleCheck = () => {
    checkAnswers();
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

  const currentTranslation = translations[currentSentence.original];

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
          
          <div className="mb-6 p-4 bg-muted/30 rounded-lg border" data-testid="text-translation-hint">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Translation hint:</p>
            {currentTranslation ? (
              <p className="text-sm">{currentTranslation}</p>
            ) : (
              <p className="text-sm text-muted-foreground italic flex items-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin" />
                Loading translation...
              </p>
            )}
          </div>

          <div className="space-y-4">
            <div
              ref={orderedAreaRef}
              className={`bg-card border-2 rounded-lg p-6 transition-all duration-200 ${
                validationState === "correct"
                  ? "border-green-500"
                  : validationState === "incorrect"
                    ? "border-destructive"
                    : isDragging
                      ? "border-primary/50 border-dashed bg-primary/5"
                      : "border-border"
              }`}
              onDrop={handleDropOnOrdered}
              onDragEnter={handleDragEnterOrdered}
              onDragOver={(e) => {
                e.preventDefault();
                if (orderedWords.length === 0) {
                  setDropTargetIndex(0);
                }
              }}
              onDragLeave={handleDragLeaveOrdered}
              data-testid="ordered-area"
            >
              <div className="flex flex-wrap gap-2 min-h-[48px] items-center">
                {orderedWords.length === 0 && dropTargetIndex === 0 && (
                  <div className="w-0.5 h-8 bg-primary rounded-full animate-pulse" />
                )}
                {orderedWords.length === 0 && dropTargetIndex !== 0 && (
                  <p className="text-sm text-muted-foreground italic">Drag or click words to place them here</p>
                )}
                {orderedWords.map((word, idx) => (
                  <div key={`ordered-${idx}`} className="relative flex items-center">
                    {dropTargetIndex === idx && (
                      <div className="absolute -left-[5px] top-1/2 -translate-y-1/2 w-0.5 h-8 bg-primary rounded-full animate-pulse" />
                    )}
                    <span
                      onClick={() => handleWordClick(word, true)}
                      draggable
                      onDragStart={(e) => handleDragStart(e, word, true, idx)}
                      onDragEnd={handleDragEnd}
                      onDragOver={(e) => handleDragOverWord(e, idx)}
                      className={`px-3 py-2 rounded-md cursor-pointer transition-all duration-150 hover-elevate active-elevate-2 select-none font-medium ${
                        validationState === "correct"
                          ? "bg-green-100 dark:bg-green-900/30 border border-green-500 text-green-700 dark:text-green-400"
                          : validationState === "incorrect"
                            ? "bg-destructive/10 border border-destructive text-destructive"
                            : "bg-primary/10 border border-primary/30 text-primary"
                      }`}
                      data-testid={`ordered-word-${idx}`}
                    >
                      {stripPunctuation(word)}
                    </span>
                    {dropTargetIndex === orderedWords.length && idx === orderedWords.length - 1 && (
                      <div className="absolute -right-[5px] top-1/2 -translate-y-1/2 w-0.5 h-8 bg-primary rounded-full animate-pulse" />
                    )}
                  </div>
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
              <div className="flex flex-wrap gap-2 min-h-[40px]">
                {shuffledWords.length === 0 && orderedWords.length > 0 && (
                  <p className="text-sm text-muted-foreground italic">All words placed</p>
                )}
                {shuffledWords.map((word, idx) => (
                  <button
                    key={`shuffled-${idx}`}
                    onClick={() => handleWordClick(word, false)}
                    draggable
                    onDragStart={(e) => handleDragStart(e, word, false, idx)}
                    onDragEnd={handleDragEnd}
                    className="px-3 py-2 bg-background border rounded-md cursor-grab hover-elevate active-elevate-2 select-none font-medium transition-all duration-150"
                    data-testid={`shuffled-word-${idx}`}
                  >
                    {stripPunctuation(word)}
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
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-medium">Correct!</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={playSentence}
                disabled={tts.isPending}
                className={isPlaying ? "text-primary bg-primary/10" : ""}
                data-testid="button-play-correct-sentence"
              >
                <Volume2 className={`h-4 w-4 ${isPlaying ? "animate-pulse" : ""}`} />
              </Button>
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
