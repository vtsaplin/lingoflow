import { useMemo, useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Check, RotateCcw, CheckCircle2, XCircle, PenLine, ChevronLeft, ChevronRight } from "lucide-react";
import type { WriteModeState, WriteSentenceState, ValidationState } from "./types";

interface WriteModeProps {
  paragraphs: string[];
  state: WriteModeState;
  onStateChange: (state: WriteModeState) => void;
  onResetProgress?: () => void;
  isCompleted?: boolean;
}

interface GapInfo {
  id: number;
  original: string;
  hint: string;
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
}

export function WriteMode({ paragraphs, state, onStateChange, onResetProgress, isCompleted = false }: WriteModeProps) {
  const sentences = useMemo(() => {
    return extractSentencesWithGaps(paragraphs);
  }, [paragraphs]);

  const { currentIndex, sentenceStates } = state;

  useEffect(() => {
    const sentenceCountMismatch = Object.keys(state.sentenceStates).length !== sentences.length;
    const needsReinit = !state.initialized || sentenceCountMismatch;
    
    if (sentences.length > 0 && needsReinit) {
      const initialStates: Record<number, WriteSentenceState> = {};
      const shouldRestoreCompleted = isCompleted && !sentenceCountMismatch;
      
      sentences.forEach((sentence, idx) => {
        if (shouldRestoreCompleted) {
          const correctInputs: Record<number, string> = {};
          Object.entries(sentence.gapLookup).forEach(([id, gap]) => {
            correctInputs[Number(id)] = gap.original;
          });
          initialStates[idx] = {
            inputs: correctInputs,
            validationState: "correct",
            incorrectGaps: [],
          };
        } else {
          initialStates[idx] = {
            inputs: {},
            validationState: "idle",
            incorrectGaps: [],
          };
        }
      });
      onStateChange({
        currentIndex: 0,
        sentenceStates: initialStates,
        initialized: true,
      });
    }
  }, [sentences, state.initialized, onStateChange, isCompleted]);

  if (sentences.length === 0) {
    return (
      <div className="flex flex-col h-full items-center justify-center px-6 py-12">
        <PenLine className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground text-center">
          No sentences found in this text.
        </p>
      </div>
    );
  }

  if (!state.initialized) {
    return null;
  }

  const currentSentence = sentences[currentIndex];
  const currentState = sentenceStates[currentIndex] || {
    inputs: {},
    validationState: "idle" as ValidationState,
    incorrectGaps: [],
  };
  const { inputs, validationState, incorrectGaps } = currentState;
  const incorrectGapsSet = new Set(incorrectGaps);

  const updateCurrentSentenceState = (updates: Partial<WriteSentenceState>) => {
    onStateChange({
      ...state,
      sentenceStates: {
        ...sentenceStates,
        [currentIndex]: { ...currentState, ...updates },
      },
    });
  };

  const handleInputChange = (gapId: number, value: string) => {
    const newIncorrect = incorrectGaps.filter((id) => id !== gapId);
    updateCurrentSentenceState({
      inputs: { ...inputs, [gapId]: value },
      validationState: "idle",
      incorrectGaps: newIncorrect,
    });
  };

  const handleCheck = () => {
    let allCorrect = true;
    const newIncorrect: number[] = [];

    for (const gapId of Object.keys(currentSentence.gapLookup).map(Number)) {
      const gap = currentSentence.gapLookup[gapId];
      const userInput = (inputs[gapId] || "").trim().toLowerCase();
      const expected = gap.original.toLowerCase();
      if (userInput !== expected) {
        allCorrect = false;
        newIncorrect.push(gapId);
      }
    }

    updateCurrentSentenceState({
      incorrectGaps: newIncorrect,
      validationState: allCorrect ? "correct" : "incorrect",
    });
  };

  const handleReset = () => {
    updateCurrentSentenceState({
      inputs: {},
      validationState: "idle",
      incorrectGaps: [],
    });
  };

  const handleFullReset = useCallback(() => {
    const initialStates: Record<number, WriteSentenceState> = {};
    sentences.forEach((_, idx) => {
      initialStates[idx] = {
        inputs: {},
        validationState: "idle",
        incorrectGaps: [],
      };
    });
    onStateChange({
      currentIndex: 0,
      sentenceStates: initialStates,
      initialized: true,
    });
    onResetProgress?.();
  }, [sentences, onStateChange, onResetProgress]);

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

  const completedCount = Object.values(sentenceStates).filter(s => s.validationState === "correct").length;
  const allComplete = completedCount === sentences.length;

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto px-6 sm:px-8 py-6">
        <div className="max-w-3xl mx-auto">
          <p className="text-sm text-muted-foreground mb-2">
            Type the missing words. The first letter is shown as a hint.
          </p>
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-muted-foreground">
              Sentence {currentIndex + 1} of {sentences.length}
            </span>
            <span className={`text-sm font-medium ${allComplete ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}`}>
              {completedCount} / {sentences.length} complete
            </span>
          </div>

          <div className="bg-card border rounded-lg p-6">
            <p className="font-serif text-lg leading-loose text-foreground/90">
              {currentSentence.template.map((item, tIdx) => {
                if (item.type === "text") {
                  return <span key={tIdx}>{item.content}</span>;
                }
                const gapId = item.gapId!;
                const gap = currentSentence.gapLookup[gapId];
                const isIncorrect = incorrectGapsSet.has(gapId);
                const isCorrect = validationState === "correct";

                const wordLength = gap?.original?.length || 5;
                const inputWidth = Math.max(40, Math.min(wordLength * 10 + 16, 150));

                return (
                  <span key={tIdx} className="inline-flex items-center mx-0.5">
                    <input
                      type="text"
                      value={inputs[gapId] || ""}
                      onChange={(e) => handleInputChange(gapId, e.target.value)}
                      placeholder={gap?.hint || "___"}
                      data-testid={`input-gap-${gapId}`}
                      style={{ width: `${inputWidth}px` }}
                      className={`inline-block px-1 py-0.5 text-center border-b-2 bg-transparent outline-none transition-colors font-serif text-base ${
                        isIncorrect
                          ? "border-destructive text-destructive"
                          : isCorrect
                            ? "border-green-500 text-green-600 dark:text-green-400"
                            : "border-muted-foreground/50 focus:border-primary"
                      }`}
                    />
                  </span>
                );
              })}
            </p>
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
          const hint = cleanWord.charAt(0) + "_".repeat(Math.max(1, cleanWord.length - 1));
          gapLookup[gapId] = { id: gapId, original: cleanWord, hint };
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

      if (Object.keys(gapLookup).length > 0) {
        result.push({
          original: trimmed,
          template,
          gapLookup,
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
