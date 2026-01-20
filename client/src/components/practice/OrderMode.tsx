import { useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Check, RotateCcw, CheckCircle2, XCircle, ArrowUpDown } from "lucide-react";
import type { OrderModeState, OrderSentenceState } from "./types";

interface OrderModeProps {
  paragraphs: string[];
  flashcardWords: string[];
  state: OrderModeState;
  onStateChange: (state: OrderModeState) => void;
  onResetProgress?: () => void;
  isCompleted?: boolean;
}

interface ParsedSentence {
  text: string;
  words: string[];
  isEligible: boolean;
  eligibleIndex: number | null;
}

interface ParsedParagraph {
  sentences: ParsedSentence[];
}

export function OrderMode({ paragraphs, flashcardWords, state, onStateChange, onResetProgress, isCompleted = false }: OrderModeProps) {
  const flashcardWordsLower = useMemo(() => 
    new Set(flashcardWords.map(w => w.toLowerCase())), 
    [flashcardWords]
  );

  const { parsedParagraphs, eligibleSentences } = useMemo(() => {
    const parsed: ParsedParagraph[] = [];
    const eligible: { text: string; words: string[]; index: number }[] = [];
    let eligibleIdx = 0;

    paragraphs.forEach((para) => {
      const sentenceMatches = para.match(/[^.!?]+[.!?]+["']?|[^.!?]+$/g) || [para];
      const parsedSentences: ParsedSentence[] = [];

      sentenceMatches.forEach((sentence) => {
        const trimmed = sentence.trim();
        if (trimmed.length === 0) return;

        const words = extractWords(trimmed);
        const hasFlashcardWord = words.some(w => 
          flashcardWordsLower.has(w.toLowerCase().replace(/[.,!?;:'"()]/g, ''))
        );
        const isEligible = hasFlashcardWord && words.length >= 3;

        if (isEligible) {
          eligible.push({ text: trimmed, words, index: eligibleIdx });
          parsedSentences.push({
            text: trimmed,
            words,
            isEligible: true,
            eligibleIndex: eligibleIdx
          });
          eligibleIdx++;
        } else {
          parsedSentences.push({
            text: trimmed,
            words,
            isEligible: false,
            eligibleIndex: null
          });
        }
      });

      if (parsedSentences.length > 0) {
        parsed.push({ sentences: parsedSentences });
      }
    });

    return { parsedParagraphs: parsed, eligibleSentences: eligible };
  }, [paragraphs, flashcardWordsLower]);

  const { sentenceStates, flashcardCount: savedCount } = state;

  useEffect(() => {
    const countIncreased = eligibleSentences.length > savedCount && savedCount > 0;
    const countDecreased = eligibleSentences.length < savedCount && savedCount > 0;
    const needsReinit = !state.initialized || countIncreased || countDecreased;
    
    if (eligibleSentences.length > 0 && needsReinit) {
      const initialStates: Record<number, OrderSentenceState> = {};
      eligibleSentences.forEach((sentence) => {
        if (isCompleted && !needsReinit) {
          initialStates[sentence.index] = {
            shuffledWords: [],
            orderedWords: [...sentence.words],
            validationState: "correct",
          };
        } else {
          initialStates[sentence.index] = {
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
        flashcardCount: eligibleSentences.length,
      });
    } else if (eligibleSentences.length === 0 && !state.initialized) {
      onStateChange({
        currentIndex: 0,
        sentenceStates: {},
        initialized: true,
        flashcardCount: 0,
      });
    } else if (countDecreased && eligibleSentences.length === 0) {
      onStateChange({
        currentIndex: 0,
        sentenceStates: {},
        initialized: true,
        flashcardCount: eligibleSentences.length,
      });
    }
  }, [eligibleSentences, state.initialized, onStateChange, isCompleted, savedCount]);

  if (flashcardWords.length === 0) {
    return (
      <div className="flex flex-col h-full items-center justify-center px-6 py-12">
        <ArrowUpDown className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground text-center">
          No flashcard words found.
        </p>
        <p className="text-sm text-muted-foreground text-center mt-2">
          Add words to your flashcard dictionary in Read mode to unlock Order practice.
        </p>
      </div>
    );
  }

  if (eligibleSentences.length === 0) {
    return (
      <div className="flex flex-col h-full items-center justify-center px-6 py-12">
        <ArrowUpDown className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground text-center">
          No sentences with flashcard words found.
        </p>
        <p className="text-sm text-muted-foreground text-center mt-2">
          Sentences need at least 3 words each for word ordering practice.
        </p>
      </div>
    );
  }

  if (!state.initialized) {
    return null;
  }

  const updateSentenceState = (sentenceIdx: number, updates: Partial<OrderSentenceState>) => {
    const currentState = sentenceStates[sentenceIdx] || {
      shuffledWords: [],
      orderedWords: [],
      validationState: "idle" as const,
    };
    onStateChange({
      ...state,
      sentenceStates: {
        ...sentenceStates,
        [sentenceIdx]: { ...currentState, ...updates },
      },
    });
  };

  const handleWordClick = (sentenceIdx: number, word: string, fromOrdered: boolean) => {
    const currentState = sentenceStates[sentenceIdx];
    if (!currentState) return;
    
    const { shuffledWords, orderedWords } = currentState;
    
    if (fromOrdered) {
      const idx = orderedWords.indexOf(word);
      if (idx !== -1) {
        updateSentenceState(sentenceIdx, {
          orderedWords: orderedWords.filter((_, i) => i !== idx),
          shuffledWords: [...shuffledWords, word],
          validationState: "idle",
        });
      }
    } else {
      const idx = shuffledWords.indexOf(word);
      if (idx !== -1) {
        updateSentenceState(sentenceIdx, {
          shuffledWords: shuffledWords.filter((_, i) => i !== idx),
          orderedWords: [...orderedWords, word],
          validationState: "idle",
        });
      }
    }
  };

  const handleDragStart = (e: React.DragEvent, sentenceIdx: number, word: string, fromOrdered: boolean, wordIndex: number) => {
    e.dataTransfer.setData("word", word);
    e.dataTransfer.setData("fromOrdered", String(fromOrdered));
    e.dataTransfer.setData("wordIndex", String(wordIndex));
    e.dataTransfer.setData("sentenceIdx", String(sentenceIdx));
  };

  const handleDropOnOrdered = (e: React.DragEvent, targetSentenceIdx: number, dropIndex?: number) => {
    e.preventDefault();
    const word = e.dataTransfer.getData("word");
    const fromOrdered = e.dataTransfer.getData("fromOrdered") === "true";
    const sourceIndex = parseInt(e.dataTransfer.getData("wordIndex"));
    const sourceSentenceIdx = parseInt(e.dataTransfer.getData("sentenceIdx"));
    
    if (sourceSentenceIdx !== targetSentenceIdx) return;
    
    const currentState = sentenceStates[targetSentenceIdx];
    if (!currentState) return;
    
    const { shuffledWords, orderedWords } = currentState;

    if (fromOrdered) {
      if (dropIndex !== undefined && dropIndex !== sourceIndex) {
        const newArr = [...orderedWords];
        newArr.splice(sourceIndex, 1);
        newArr.splice(dropIndex > sourceIndex ? dropIndex - 1 : dropIndex, 0, word);
        updateSentenceState(targetSentenceIdx, { orderedWords: newArr, validationState: "idle" });
      }
    } else {
      const newShuffled = shuffledWords.filter((_, i) => i !== sourceIndex);
      if (dropIndex !== undefined) {
        const newOrdered = [...orderedWords];
        newOrdered.splice(dropIndex, 0, word);
        updateSentenceState(targetSentenceIdx, {
          shuffledWords: newShuffled,
          orderedWords: newOrdered,
          validationState: "idle",
        });
      } else {
        updateSentenceState(targetSentenceIdx, {
          shuffledWords: newShuffled,
          orderedWords: [...orderedWords, word],
          validationState: "idle",
        });
      }
    }
  };

  const handleDropOnShuffled = (e: React.DragEvent, targetSentenceIdx: number) => {
    e.preventDefault();
    const word = e.dataTransfer.getData("word");
    const fromOrdered = e.dataTransfer.getData("fromOrdered") === "true";
    const sourceIndex = parseInt(e.dataTransfer.getData("wordIndex"));
    const sourceSentenceIdx = parseInt(e.dataTransfer.getData("sentenceIdx"));
    
    if (sourceSentenceIdx !== targetSentenceIdx) return;
    
    const currentState = sentenceStates[targetSentenceIdx];
    if (!currentState) return;

    if (fromOrdered) {
      updateSentenceState(targetSentenceIdx, {
        orderedWords: currentState.orderedWords.filter((_, i) => i !== sourceIndex),
        shuffledWords: [...currentState.shuffledWords, word],
        validationState: "idle",
      });
    }
  };

  const handleCheckSentence = (sentenceIdx: number, sentence: { words: string[] }) => {
    const currentState = sentenceStates[sentenceIdx];
    if (!currentState) return;
    
    const isCorrect = currentState.orderedWords.join(" ") === sentence.words.join(" ");
    updateSentenceState(sentenceIdx, {
      validationState: isCorrect ? "correct" : "incorrect",
    });
  };

  const handleResetSentence = (sentenceIdx: number, sentence: { words: string[] }) => {
    updateSentenceState(sentenceIdx, {
      shuffledWords: shuffleArray([...sentence.words]),
      orderedWords: [],
      validationState: "idle",
    });
  };

  const handleCheckAll = () => {
    const newStates = { ...sentenceStates };
    eligibleSentences.forEach((sentence) => {
      const currentState = newStates[sentence.index];
      if (currentState && currentState.validationState !== "correct") {
        const isCorrect = currentState.orderedWords.join(" ") === sentence.words.join(" ");
        newStates[sentence.index] = {
          ...currentState,
          validationState: isCorrect ? "correct" : "incorrect",
        };
      }
    });
    onStateChange({ ...state, sentenceStates: newStates });
  };

  const handleResetAll = () => {
    if (onResetProgress) {
      onResetProgress();
    }
    onStateChange({
      currentIndex: 0,
      sentenceStates: {},
      initialized: false,
      flashcardCount: eligibleSentences.length,
    });
  };

  const allCorrect = eligibleSentences.every(s => sentenceStates[s.index]?.validationState === "correct");
  const correctCount = eligibleSentences.filter(s => sentenceStates[s.index]?.validationState === "correct").length;

  const renderEligibleSentence = (sentence: ParsedSentence, paraIdx?: number, sentIdx?: number) => {
    const idx = sentence.eligibleIndex!;
    const sentState = sentenceStates[idx] || {
      shuffledWords: [],
      orderedWords: [],
      validationState: "idle" as const,
    };
    const { shuffledWords, orderedWords, validationState } = sentState;
    const allWordsPlaced = shuffledWords.length === 0 && orderedWords.length > 0;

    return (
      <div 
        key={`eligible-${paraIdx ?? 0}-${sentIdx ?? idx}`}
        className={`my-3 p-3 rounded-lg border transition-colors ${
          validationState === "correct"
            ? "bg-green-50 dark:bg-green-900/20 border-green-500"
            : validationState === "incorrect"
              ? "bg-destructive/10 border-destructive"
              : "bg-muted/30 border-border"
        }`}
        data-testid={`sentence-block-${idx}`}
      >
        <div 
          className={`min-h-[40px] p-2 rounded-md border-2 border-dashed mb-2 ${
            orderedWords.length > 0
              ? "border-primary/30 bg-primary/5"
              : "border-muted-foreground/30 bg-background"
          }`}
          onDrop={(e) => handleDropOnOrdered(e, idx)}
          onDragOver={(e) => e.preventDefault()}
          data-testid={`ordered-area-${idx}`}
        >
          <div className="flex flex-wrap gap-1.5">
            {orderedWords.length === 0 && (
              <span className="text-muted-foreground text-sm italic">
                Click words to build sentence
              </span>
            )}
            {orderedWords.map((word, wordIdx) => (
              <span
                key={`${word}-${wordIdx}`}
                draggable
                onClick={() => handleWordClick(idx, word, true)}
                onDragStart={(e) => handleDragStart(e, idx, word, true, wordIdx)}
                onDrop={(e) => {
                  e.stopPropagation();
                  handleDropOnOrdered(e, idx, wordIdx);
                }}
                onDragOver={(e) => e.preventDefault()}
                data-testid={`ordered-word-${idx}-${wordIdx}`}
                className="px-2 py-1 bg-background border rounded cursor-grab active:cursor-grabbing hover:bg-accent transition-colors text-sm font-serif"
              >
                {word}
              </span>
            ))}
          </div>
        </div>

        <div
          className="min-h-[32px] p-2 rounded-md bg-muted/50"
          onDrop={(e) => handleDropOnShuffled(e, idx)}
          onDragOver={(e) => e.preventDefault()}
          data-testid={`shuffled-area-${idx}`}
        >
          <div className="flex flex-wrap gap-1.5">
            {shuffledWords.length === 0 && orderedWords.length > 0 && (
              <span className="text-muted-foreground text-xs">All placed</span>
            )}
            {shuffledWords.map((word, wordIdx) => (
              <span
                key={`${word}-${wordIdx}`}
                draggable
                onClick={() => handleWordClick(idx, word, false)}
                onDragStart={(e) => handleDragStart(e, idx, word, false, wordIdx)}
                data-testid={`shuffled-word-${idx}-${wordIdx}`}
                className="px-2 py-1 bg-background border rounded cursor-grab active:cursor-grabbing hover:bg-accent transition-colors text-sm font-serif"
              >
                {word}
              </span>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-1">
            {validationState === "correct" && (
              <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span className="text-xs font-medium">Correct</span>
              </div>
            )}
            {validationState === "incorrect" && (
              <div className="flex items-center gap-1 text-destructive">
                <XCircle className="h-3.5 w-3.5" />
                <span className="text-xs font-medium">Try again</span>
              </div>
            )}
          </div>
          <div className="flex gap-1">
            {validationState !== "correct" && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleCheckSentence(idx, sentence)}
                disabled={!allWordsPlaced}
                data-testid={`button-check-${idx}`}
                className="h-7 px-2 text-xs"
              >
                <Check className="h-3 w-3 mr-1" />
                Check
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleResetSentence(idx, sentence)}
              data-testid={`button-reset-${idx}`}
              className="h-7 px-2 text-xs"
            >
              <RotateCcw className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto px-6 sm:px-8 py-6">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted-foreground">
              Arrange words in correct order. Click or drag to move.
            </p>
            <span className="text-sm text-muted-foreground">
              {correctCount}/{eligibleSentences.length} correct
            </span>
          </div>

          <div className="prose prose-sm dark:prose-invert max-w-none">
            {parsedParagraphs.map((para, paraIdx) => (
              <div key={paraIdx} className="mb-4">
                {para.sentences.map((sentence, sentIdx) => {
                  if (sentence.isEligible) {
                    return renderEligibleSentence(sentence, paraIdx, sentIdx);
                  } else {
                    return (
                      <span 
                        key={`plain-${paraIdx}-${sentIdx}`} 
                        className="font-serif text-base text-muted-foreground"
                      >
                        {sentence.text}{' '}
                      </span>
                    );
                  }
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="border-t bg-card px-6 sm:px-8 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            {allCorrect && (
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-medium">All correct!</span>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <Button onClick={handleCheckAll} data-testid="button-check-all">
              <Check className="h-4 w-4 mr-2" />
              Check All
            </Button>
            <Button variant="outline" onClick={handleResetAll} data-testid="button-reset-all">
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset All
            </Button>
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
