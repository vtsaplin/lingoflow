import { useMemo, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Check, RotateCcw, CheckCircle2, XCircle } from "lucide-react";
import type { FillModeState, ValidationState } from "./types";

interface FillModeProps {
  paragraphs: string[];
  state: FillModeState;
  onStateChange: (state: FillModeState) => void;
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

export function FillMode({ paragraphs, state, onStateChange, isCompleted = false }: FillModeProps) {
  const { paragraphData, gapLookup, allGapWords } = useMemo(
    () => generateGaps(paragraphs),
    [paragraphs]
  );

  const totalGaps = Object.keys(gapLookup).length;

  useEffect(() => {
    if (!state.initialized && totalGaps > 0) {
      if (isCompleted) {
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
        });
      } else {
        onStateChange({
          ...state,
          availableWords: shuffleArray([...allGapWords]),
          initialized: true,
        });
      }
    }
  }, [state.initialized, totalGaps, allGapWords, onStateChange, state, isCompleted, gapLookup]);

  if (totalGaps === 0) {
    return (
      <div className="flex flex-col h-full items-center justify-center px-6 py-12">
        <p className="text-muted-foreground">No gaps could be generated from this text.</p>
      </div>
    );
  }

  const { placedWords, availableWords, validationState, incorrectGaps } = state;
  const incorrectGapsSet = new Set(incorrectGaps);

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

  const handleReturnWord = (gapId: number) => {
    const word = placedWords[gapId];
    if (word) {
      onStateChange({
        ...state,
        placedWords: { ...placedWords, [gapId]: null },
        availableWords: [...availableWords, word],
        validationState: "idle",
        incorrectGaps: [],
      });
    }
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
    });
  }, [allGapWords, onStateChange]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto px-6 sm:px-8 py-6">
        <div className="max-w-3xl mx-auto">
          <p className="text-sm text-muted-foreground mb-4">
            Drag words from the word bank below to fill in the gaps. Click a placed word to return it.
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

                  return (
                    <span
                      key={tIdx}
                      onDrop={(e) => handleDrop(e, gapId)}
                      onDragOver={handleDragOver}
                      onClick={() => placed && handleReturnWord(gapId)}
                      data-testid={`gap-${gapId}`}
                      className={`inline-flex items-center justify-center min-w-[80px] h-8 mx-1 px-2 rounded border-2 border-dashed transition-colors cursor-pointer ${
                        placed
                          ? isIncorrect
                            ? "bg-destructive/10 border-destructive text-foreground"
                            : validationState === "correct"
                              ? "bg-green-100 dark:bg-green-900/30 border-green-500 text-foreground"
                              : "bg-primary/10 border-primary/50 text-foreground"
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

      <div className="border-t bg-card px-6 sm:px-8 py-4">
        <div className="max-w-3xl mx-auto">
          {validationState === "correct" && (
            <div className="flex items-center gap-2 mb-4 text-green-600 dark:text-green-400">
              <CheckCircle2 className="h-5 w-5" />
              <span className="font-medium">All correct!</span>
            </div>
          )}
          {validationState === "incorrect" && (
            <div className="flex items-center gap-2 mb-4 text-destructive">
              <XCircle className="h-5 w-5" />
              <span className="font-medium">Some answers are incorrect. Try again!</span>
            </div>
          )}

          <div className="flex flex-wrap gap-2 mb-4 min-h-[44px] p-3 bg-muted/50 rounded-lg">
            {availableWords.length === 0 && (
              <span className="text-muted-foreground text-sm">All words placed</span>
            )}
            {availableWords.map((word, idx) => (
              <span
                key={`${word}-${idx}`}
                draggable
                onDragStart={(e) => handleDragStart(e, word)}
                data-testid={`word-bank-${idx}`}
                className="px-3 py-1.5 bg-background border rounded-md cursor-grab active:cursor-grabbing hover:bg-accent transition-colors text-sm font-medium"
              >
                {word}
              </span>
            ))}
          </div>

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

function generateGaps(paragraphs: string[]): {
  paragraphData: ParagraphData[];
  gapLookup: GapLookup;
  allGapWords: string[];
} {
  let gapIdCounter = 0;
  const gapLookup: GapLookup = {};
  const allGapWords: string[] = [];

  const seed = paragraphs.join("").length;
  let rng = seed;
  const nextRandom = () => {
    rng = (rng * 1103515245 + 12345) & 0x7fffffff;
    return rng / 0x7fffffff;
  };

  const paragraphData = paragraphs.map((para) => {
    const words = para.split(/(\s+)/);
    const contentWords: { word: string; index: number }[] = [];

    words.forEach((w, i) => {
      if (w.trim() && /[a-zA-ZäöüÄÖÜß]/.test(w)) {
        contentWords.push({ word: w, index: i });
      }
    });

    if (contentWords.length === 0) {
      return { template: [{ type: "text" as const, content: para }] };
    }

    const gapCount = Math.max(1, Math.floor(contentWords.length * 0.2));
    const gapIndices = new Set<number>();

    while (gapIndices.size < Math.min(gapCount, contentWords.length)) {
      const idx = Math.floor(nextRandom() * contentWords.length);
      gapIndices.add(idx);
    }

    const template: TemplateItem[] = [];
    let currentText = "";

    words.forEach((w, i) => {
      const contentIdx = contentWords.findIndex((cw) => cw.index === i);
      if (contentIdx !== -1 && gapIndices.has(contentIdx)) {
        if (currentText) {
          template.push({ type: "text", content: currentText });
          currentText = "";
        }
        const cleanWord = w.replace(/[.,!?;:«»„"'"]/g, "").trim();
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
