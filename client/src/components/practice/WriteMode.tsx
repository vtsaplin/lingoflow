import { useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Check, RotateCcw, CheckCircle2, XCircle, PenLine } from "lucide-react";
import type { WriteModeState } from "./types";

interface WriteModeProps {
  paragraphs: string[];
  flashcardWords: string[];
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

interface ParagraphData {
  template: TemplateItem[];
}

interface GapLookup {
  [gapId: number]: GapInfo;
}

export function WriteMode({ paragraphs, flashcardWords, state, onStateChange, onResetProgress, isCompleted = false }: WriteModeProps) {
  const { paragraphData, gapLookup } = useMemo(
    () => generateWriteGaps(paragraphs, flashcardWords),
    [paragraphs, flashcardWords]
  );

  const totalGaps = Object.keys(gapLookup).length;

  useEffect(() => {
    const flashcardCountChanged = state.initialized && flashcardWords.length > state.flashcardCount;
    
    if ((!state.initialized || flashcardCountChanged) && totalGaps > 0) {
      if (isCompleted && !flashcardCountChanged) {
        const correctInputs: Record<number, string> = {};
        Object.entries(gapLookup).forEach(([id, gap]) => {
          correctInputs[Number(id)] = gap.original;
        });
        onStateChange({
          ...state,
          inputs: correctInputs,
          validationState: "correct",
          initialized: true,
          flashcardCount: flashcardWords.length,
        });
      } else {
        onStateChange({
          ...state,
          inputs: {},
          validationState: "idle",
          incorrectGaps: [],
          initialized: true,
          flashcardCount: flashcardWords.length,
        });
      }
    }
  }, [state.initialized, state.flashcardCount, flashcardWords.length, totalGaps, onStateChange, state, isCompleted, gapLookup]);

  if (totalGaps === 0) {
    return (
      <div className="flex flex-col h-full items-center justify-center px-6 py-12">
        <PenLine className="h-12 w-12 text-muted-foreground mb-4" />
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

  const { inputs, validationState, incorrectGaps } = state;
  const incorrectGapsSet = new Set(incorrectGaps);

  const handleInputChange = (gapId: number, value: string) => {
    const newIncorrect = incorrectGaps.filter((id) => id !== gapId);
    onStateChange({
      ...state,
      inputs: { ...inputs, [gapId]: value },
      validationState: "idle",
      incorrectGaps: newIncorrect,
    });
  };

  const handleCheck = () => {
    let allCorrect = true;
    const newIncorrect: number[] = [];

    for (const gapId of Object.keys(gapLookup).map(Number)) {
      const gap = gapLookup[gapId];
      const userInput = (inputs[gapId] || "").trim().toLowerCase();
      const expected = gap.original.toLowerCase();
      if (userInput !== expected) {
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

  const handleReset = () => {
    onStateChange({
      inputs: {},
      validationState: "idle",
      incorrectGaps: [],
      initialized: true,
      flashcardCount: state.flashcardCount,
    });
    onResetProgress?.();
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto px-6 sm:px-8 py-6">
        <div className="max-w-3xl mx-auto">
          <p className="text-sm text-muted-foreground mb-4">
            Type the missing words. The first letter is shown as a hint.
          </p>
          <div className="space-y-6 font-serif text-lg leading-relaxed text-foreground/90">
            {paragraphData.map((para, pIdx) => (
              <p key={pIdx} className="leading-loose">
                {para.template.map((item, tIdx) => {
                  if (item.type === "text") {
                    return <span key={tIdx}>{item.content}</span>;
                  }
                  const gapId = item.gapId!;
                  const gap = gapLookup[gapId];
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

function generateWriteGaps(paragraphs: string[], flashcardWords: string[]): {
  paragraphData: ParagraphData[];
  gapLookup: GapLookup;
} {
  let gapIdCounter = 0;
  const gapLookup: GapLookup = {};

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
        const hint = cleanWord.charAt(0) + "_".repeat(Math.max(1, cleanWord.length - 1));
        const gapId = gapIdCounter++;
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

    return { template };
  });

  return { paragraphData, gapLookup };
}
