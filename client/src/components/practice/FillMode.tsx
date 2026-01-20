import { useMemo, useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Check, RotateCcw, CheckCircle2, XCircle, Puzzle } from "lucide-react";
import type { FillModeState, ValidationState } from "./types";

interface FillModeProps {
  paragraphs: string[];
  flashcardWords: string[];
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

interface ParagraphData {
  template: TemplateItem[];
}

interface GapLookup {
  [gapId: number]: GapInfo;
}

export function FillMode({ paragraphs, flashcardWords, state, onStateChange, onResetProgress, isCompleted = false }: FillModeProps) {
  const { paragraphData, gapLookup, allGapWords } = useMemo(
    () => generateGaps(paragraphs, flashcardWords),
    [paragraphs, flashcardWords]
  );

  const totalGaps = Object.keys(gapLookup).length;

  useEffect(() => {
    const flashcardCountIncreased = state.initialized && flashcardWords.length > state.flashcardCount;
    const flashcardCountDecreased = state.initialized && flashcardWords.length < state.flashcardCount;
    const flashcardCountChanged = flashcardCountIncreased || flashcardCountDecreased;
    
    if ((!state.initialized || flashcardCountChanged) && totalGaps > 0) {
      if (isCompleted && !flashcardCountChanged) {
        const correctPlacements: Record<number, string> = {};
        Object.entries(gapLookup).forEach(([id, gap]) => {
          correctPlacements[Number(id)] = gap.original;
        });
        onStateChange({
          ...state,
          placedWords: correctPlacements,
          availableWords: [],
          validationState: "correct",
          initialized: true,
          flashcardCount: flashcardWords.length,
        });
      } else {
        onStateChange({
          ...state,
          placedWords: {},
          availableWords: shuffleArray([...allGapWords]),
          validationState: "idle",
          incorrectGaps: [],
          initialized: true,
          flashcardCount: flashcardWords.length,
        });
      }
    } else if (flashcardCountDecreased && totalGaps === 0) {
      onStateChange({
        ...state,
        placedWords: {},
        availableWords: [],
        validationState: "idle",
        incorrectGaps: [],
        initialized: true,
        flashcardCount: flashcardWords.length,
      });
    }
  }, [state.initialized, state.flashcardCount, flashcardWords.length, totalGaps, allGapWords, onStateChange, state, isCompleted, gapLookup]);

  if (totalGaps === 0) {
    return (
      <div className="flex flex-col h-full items-center justify-center px-6 py-12">
        <Puzzle className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground text-center">
          {flashcardWords.length === 0 
            ? "No flashcards saved for this text yet."
            : "No matching words found in this text."
          }
        </p>
        <p className="text-sm text-muted-foreground text-center mt-2">
          {flashcardWords.length === 0 
            ? "Switch to Study mode and click on words to save them to your flashcards."
            : "Try adding more words from this text to your dictionary."
          }
        </p>
      </div>
    );
  }

  const { placedWords, availableWords, validationState, incorrectGaps } = state;
  const incorrectGapsSet = new Set(incorrectGaps);

  const [selectedWord, setSelectedWord] = useState<{ word: string; index: number } | null>(null);

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
      let newAvailable = [...availableWords];
      const idx = newAvailable.findIndex((w, i) => w === selectedWord.word && i === selectedWord.index);
      if (idx !== -1) {
        newAvailable.splice(idx, 1);
      }
      if (existingWord) {
        newAvailable.push(existingWord);
      }
      onStateChange({
        ...state,
        placedWords: { ...placedWords, [gapId]: selectedWord.word },
        availableWords: newAvailable,
        validationState: "idle",
        incorrectGaps: [],
      });
      setSelectedWord(null);
    } else if (existingWord) {
      onStateChange({
        ...state,
        placedWords: { ...placedWords, [gapId]: null },
        availableWords: [...availableWords, existingWord],
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
      onStateChange({
        ...state,
        placedWords: newPlaced,
        validationState: "idle",
        incorrectGaps: [],
      });
    } else {
      let newAvailable = [...availableWords];
      const idx = newAvailable.indexOf(word);
      if (idx !== -1) {
        newAvailable.splice(idx, 1);
      }
      if (existingWordInTarget) {
        newAvailable.push(existingWordInTarget);
      }
      onStateChange({
        ...state,
        placedWords: { ...placedWords, [gapId]: word },
        availableWords: newAvailable,
        validationState: "idle",
        incorrectGaps: [],
      });
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleCheck = () => {
    let allCorrect = true;
    const newIncorrect: number[] = [];

    for (const gapId of Object.keys(gapLookup).map(Number)) {
      const gap = gapLookup[gapId];
      const placed = placedWords[gapId];
      if (placed?.toLowerCase() !== gap.original.toLowerCase()) {
        allCorrect = false;
        newIncorrect.push(gapId);
      }
    }

    onStateChange({
      ...state,
      incorrectGaps: newIncorrect,
      validationState: allCorrect ? "correct" : "incorrect",
    });
  };

  const handleReset = useCallback(() => {
    onStateChange({
      placedWords: {},
      availableWords: shuffleArray([...allGapWords]),
      validationState: "idle",
      incorrectGaps: [],
      initialized: true,
      flashcardCount: state.flashcardCount,
    });
    onResetProgress?.();
  }, [allGapWords, onStateChange, onResetProgress, state.flashcardCount]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto">
        <div className="px-6 sm:px-8 py-6">
          <div className="max-w-3xl mx-auto space-y-6">
            <p className="text-sm text-muted-foreground">
              Click a word below to select it, then click a gap to place it. Or drag and drop words. Click a placed word to return it.
            </p>
            
            <div className="space-y-6 font-serif text-lg leading-relaxed text-foreground/90">
              {paragraphData.map((para, pIdx) => (
                <p key={pIdx}>
                  {para.template.map((item, tIdx) => {
                    if (item.type === "text") {
                      return <span key={tIdx}>{item.content}</span>;
                    }
                    const gapId = item.gapId!;
                    const placed = placedWords[gapId];
                    const isIncorrect = incorrectGapsSet.has(gapId);

                    const isClickTarget = selectedWord && !placed;
                    return (
                      <span
                        key={tIdx}
                        onDrop={(e) => handleDrop(e, gapId)}
                        onDragOver={handleDragOver}
                        onClick={() => handleGapClick(gapId)}
                        data-testid={`gap-${gapId}`}
                        className={`inline-flex items-center justify-center min-w-[60px] h-7 mx-0.5 px-2 rounded border-2 border-dashed transition-colors cursor-pointer ${
                          placed
                            ? isIncorrect
                              ? "bg-destructive/10 border-destructive text-foreground"
                              : validationState === "correct"
                                ? "bg-green-100 dark:bg-green-900/30 border-green-500 text-foreground"
                                : "bg-primary/10 border-primary/50 text-foreground"
                            : isClickTarget
                              ? "bg-primary/20 border-primary animate-pulse"
                              : "bg-muted/50 border-muted-foreground/30 text-muted-foreground"
                        }`}
                        draggable={!!placed}
                        onDragStart={(e) => placed && handleDragStart(e, placed, gapId)}
                      >
                        {placed || "___"}
                      </span>
                    );
                  })}
                </p>
              ))}
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 z-50 px-6 sm:px-8 py-3 bg-background/95 backdrop-blur-sm border-t">
          <div className="max-w-3xl mx-auto">
            <div className="min-h-[60px] p-4 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wider">Available words:</p>
              <div className="flex flex-wrap gap-2">
                {availableWords.length === 0 && (
                  <span className="text-muted-foreground text-sm">All words placed</span>
                )}
                {availableWords.map((word, idx) => {
                  const isSelected = selectedWord?.index === idx;
                  return (
                    <span
                      key={`${word}-${idx}`}
                      draggable
                      onDragStart={(e) => handleDragStart(e, word)}
                      onClick={() => handleWordBankClick(word, idx)}
                      data-testid={`word-bank-${idx}`}
                      className={`px-3 py-1.5 border rounded-md cursor-pointer active:cursor-grabbing hover:bg-accent transition-colors text-base font-serif ${
                        isSelected 
                          ? "bg-primary text-primary-foreground border-primary ring-2 ring-primary/50" 
                          : "bg-background"
                      }`}
                    >
                      {word}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t bg-card px-6 sm:px-8 py-4">
        <div className="max-w-3xl mx-auto">
          {validationState === "correct" && (
            <div className="flex items-center gap-2 mb-3 text-green-600 dark:text-green-400">
              <CheckCircle2 className="h-5 w-5" />
              <span className="font-medium">All correct!</span>
            </div>
          )}
          {validationState === "incorrect" && (
            <div className="flex items-center gap-2 mb-3 text-destructive">
              <XCircle className="h-5 w-5" />
              <span className="font-medium">Some answers are incorrect. Try again!</span>
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
          </div>
        </div>
      </div>
    </div>
  );
}

function generateGaps(paragraphs: string[], flashcardWords: string[]): {
  paragraphData: ParagraphData[];
  gapLookup: GapLookup;
  allGapWords: string[];
} {
  let gapIdCounter = 0;
  const gapLookup: GapLookup = {};
  const allGapWords: string[] = [];

  const flashcardWordsLower = new Set(flashcardWords.map(w => w.toLowerCase()));
  const usedWords = new Set<string>();

  const paragraphData = paragraphs.map((para) => {
    const words = para.split(/(\s+)/);
    const template: TemplateItem[] = [];
    let currentText = "";

    words.forEach((w) => {
      const cleanWord = w.replace(/[.,!?;:«»„"'"]/g, "").trim();
      const cleanWordLower = cleanWord.toLowerCase();
      const isFlashcardWord = cleanWord && flashcardWordsLower.has(cleanWordLower);
      const isFirstOccurrence = isFlashcardWord && !usedWords.has(cleanWordLower);

      if (isFirstOccurrence) {
        usedWords.add(cleanWordLower);
        if (currentText) {
          template.push({ type: "text", content: currentText });
          currentText = "";
        }
        const gapId = gapIdCounter++;
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

    return { template };
  });

  return { paragraphData, gapLookup, allGapWords };
}

function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
