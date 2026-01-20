import { useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Check, RotateCcw, ChevronLeft, ChevronRight, CheckCircle2, XCircle, ArrowUpDown } from "lucide-react";
import type { OrderModeState, OrderSentenceState } from "./types";
import type { SavedSentence } from "@/hooks/use-saved-sentences";

interface OrderModeProps {
  sentences: SavedSentence[];
  state: OrderModeState;
  onStateChange: (state: OrderModeState) => void;
  onResetProgress?: () => void;
  onClearSentences?: () => void;
  isCompleted?: boolean;
}

interface SentenceWithWords {
  original: string;
  translation: string;
  words: string[];
}

export function OrderMode({ sentences: inputSentences, state, onStateChange, onResetProgress, onClearSentences, isCompleted = false }: OrderModeProps) {
  const sentences = useMemo(() => {
    return inputSentences.map(s => ({
      original: s.german,
      translation: s.translation,
      words: extractWords(s.german)
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
          No saved sentences for this text yet.
        </p>
        <p className="text-sm text-muted-foreground text-center mt-2">
          Switch to Study mode (Sentence), click on a sentence, and save it for practice.
        </p>
      </div>
    );
  }

  if (sentences.length === 0) {
    return (
      <div className="flex flex-col h-full items-center justify-center px-6 py-12">
        <ArrowUpDown className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground text-center">
          Сохранённые предложения слишком короткие.
        </p>
        <p className="text-sm text-muted-foreground text-center mt-2">
          Для практики нужны предложения минимум из 3 слов.
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
    const sourceIndex = parseInt(e.dataTransfer.getData("index"));

    if (fromOrdered) {
      if (dropIndex !== undefined && dropIndex !== sourceIndex) {
        const newArr = [...orderedWords];
        newArr.splice(sourceIndex, 1);
        newArr.splice(dropIndex > sourceIndex ? dropIndex - 1 : dropIndex, 0, word);
        updateCurrentSentenceState({ orderedWords: newArr, validationState: "idle" });
      }
    } else {
      const newShuffled = shuffledWords.filter((_, i) => i !== sourceIndex);
      if (dropIndex !== undefined) {
        const newOrdered = [...orderedWords];
        newOrdered.splice(dropIndex, 0, word);
        updateCurrentSentenceState({
          shuffledWords: newShuffled,
          orderedWords: newOrdered,
          validationState: "idle",
        });
      } else {
        updateCurrentSentenceState({
          shuffledWords: newShuffled,
          orderedWords: [...orderedWords, word],
          validationState: "idle",
        });
      }
    }
  };

  const handleDropOnShuffled = (e: React.DragEvent) => {
    e.preventDefault();
    const word = e.dataTransfer.getData("word");
    const fromOrdered = e.dataTransfer.getData("fromOrdered") === "true";
    const sourceIndex = parseInt(e.dataTransfer.getData("index"));

    if (fromOrdered) {
      updateCurrentSentenceState({
        orderedWords: orderedWords.filter((_, i) => i !== sourceIndex),
        shuffledWords: [...shuffledWords, word],
        validationState: "idle",
      });
    }
  };

  const handleCheck = () => {
    const isCorrect = orderedWords.join(" ") === currentSentence.words.join(" ");
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
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Translation:</p>
            <p className="text-base font-medium">{currentSentence.translation}</p>
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
                  <span className="text-muted-foreground text-sm italic">
                    Drag words here in the correct order
                  </span>
                )}
                {orderedWords.map((word, idx) => (
                  <span
                    key={`ordered-${idx}`}
                    draggable
                    onClick={() => handleWordClick(word, true)}
                    onDragStart={(e) => handleDragStart(e, word, true, idx)}
                    onDrop={(e) => {
                      e.stopPropagation();
                      handleDropOnOrdered(e, idx);
                    }}
                    onDragOver={(e) => e.preventDefault()}
                    data-testid={`ordered-word-${idx}`}
                    className="px-3 py-1.5 bg-background border rounded-md cursor-grab active:cursor-grabbing hover:bg-accent transition-colors text-base font-serif"
                  >
                    {word}
                  </span>
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
                {shuffledWords.length === 0 && (
                  <span className="text-muted-foreground text-sm">All words placed</span>
                )}
                {shuffledWords.map((word, idx) => (
                  <span
                    key={`shuffled-${idx}`}
                    draggable
                    onClick={() => handleWordClick(word, false)}
                    onDragStart={(e) => handleDragStart(e, word, false, idx)}
                    data-testid={`shuffled-word-${idx}`}
                    className="px-3 py-1.5 bg-background border rounded-md cursor-grab active:cursor-grabbing hover:bg-accent transition-colors text-base font-serif"
                  >
                    {word}
                  </span>
                ))}
              </div>
            </div>
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
              <span className="font-medium">Incorrect order. Try again!</span>
            </div>
          )}

          <div className="flex gap-2">
            <Button onClick={handleCheck} data-testid="button-check">
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
            {onClearSentences && (
              <Button 
                variant="ghost" 
                onClick={onClearSentences}
                data-testid="button-clear-sentences"
              >
                Clear Sentences
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function extractWords(text: string): string[] {
  return text.split(/\s+/).filter(w => w.length > 0);
}
