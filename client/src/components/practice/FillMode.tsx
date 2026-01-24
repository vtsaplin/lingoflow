import { useMemo, useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Check, RotateCcw, CheckCircle2, XCircle, Puzzle, ChevronLeft, ChevronRight } from "lucide-react";
import type { FillModeState, FillSentenceState, ValidationState } from "./types";

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

interface SentenceData {
  original: string;
  template: TemplateItem[];
  gapLookup: Record<number, GapInfo>;
  allGapWords: string[];
}

export function FillMode({ paragraphs, flashcardWords, state, onStateChange, onResetProgress, isCompleted = false }: FillModeProps) {
  const sentences = useMemo(() => {
    return extractSentencesWithGaps(paragraphs, flashcardWords);
  }, [paragraphs, flashcardWords]);

  const { currentIndex, sentenceStates } = state;

  useEffect(() => {
    const countIncreased = flashcardWords.length > state.flashcardCount && state.flashcardCount > 0;
    const countDecreased = flashcardWords.length < state.flashcardCount && state.flashcardCount > 0;
    const sentenceCountMismatch = Object.keys(state.sentenceStates).length !== sentences.length;
    
    // Check if gap words in state match the current sentences
    let gapWordsMismatch = false;
    if (state.initialized && sentences.length > 0 && Object.keys(state.sentenceStates).length === sentences.length) {
      for (let i = 0; i < sentences.length; i++) {
        const sentenceGaps = sentences[i].allGapWords.sort().join(",");
        const stateData = state.sentenceStates[i];
        if (stateData) {
          const stateWords = [...stateData.availableWords, ...Object.values(stateData.placedWords).filter(Boolean) as string[]].sort().join(",");
          if (sentenceGaps !== stateWords) {
            gapWordsMismatch = true;
            break;
          }
        }
      }
    }
    
    const needsReinit = !state.initialized || countIncreased || countDecreased || sentenceCountMismatch || gapWordsMismatch;
    
    if (sentences.length > 0 && needsReinit) {
      const initialStates: Record<number, FillSentenceState> = {};
      const shouldRestoreCompleted = isCompleted && !countIncreased && !countDecreased;
      
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
            availableWords: shuffleArray([...sentence.allGapWords]),
            validationState: "idle",
            incorrectGaps: [],
          };
        }
      });
      onStateChange({
        currentIndex: 0,
        sentenceStates: initialStates,
        initialized: true,
        flashcardCount: flashcardWords.length,
      });
    } else if (countDecreased && sentences.length === 0) {
      onStateChange({
        currentIndex: 0,
        sentenceStates: {},
        initialized: true,
        flashcardCount: flashcardWords.length,
      });
    }
  }, [sentences, state.initialized, state.sentenceStates, onStateChange, isCompleted, flashcardWords.length, state.flashcardCount]);

  if (sentences.length === 0) {
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

  if (!state.initialized) {
    return null;
  }

  const currentSentence = sentences[currentIndex];
  const currentState = sentenceStates[currentIndex] || {
    placedWords: {},
    availableWords: [],
    validationState: "idle" as ValidationState,
    incorrectGaps: [],
  };
  const { placedWords, availableWords, validationState, incorrectGaps } = currentState;
  const incorrectGapsSet = new Set(incorrectGaps);

  const updateCurrentSentenceState = (updates: Partial<FillSentenceState>) => {
    onStateChange({
      ...state,
      sentenceStates: {
        ...sentenceStates,
        [currentIndex]: { ...currentState, ...updates },
      },
    });
  };

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
      updateCurrentSentenceState({
        placedWords: { ...placedWords, [gapId]: selectedWord.word },
        availableWords: newAvailable,
        validationState: "idle",
        incorrectGaps: [],
      });
      setSelectedWord(null);
    } else if (existingWord) {
      updateCurrentSentenceState({
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
      updateCurrentSentenceState({
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
      updateCurrentSentenceState({
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

    for (const gapId of Object.keys(currentSentence.gapLookup).map(Number)) {
      const gap = currentSentence.gapLookup[gapId];
      const placed = placedWords[gapId];
      if (placed?.toLowerCase() !== gap.original.toLowerCase()) {
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
      placedWords: {},
      availableWords: shuffleArray([...currentSentence.allGapWords]),
      validationState: "idle",
      incorrectGaps: [],
    });
  };

  const handleFullReset = useCallback(() => {
    const initialStates: Record<number, FillSentenceState> = {};
    sentences.forEach((sentence, idx) => {
      initialStates[idx] = {
        placedWords: {},
        availableWords: shuffleArray([...sentence.allGapWords]),
        validationState: "idle",
        incorrectGaps: [],
      };
    });
    onStateChange({
      currentIndex: 0,
      sentenceStates: initialStates,
      initialized: true,
      flashcardCount: state.flashcardCount,
    });
    onResetProgress?.();
  }, [sentences, onStateChange, onResetProgress, state.flashcardCount]);

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
          <p className="text-sm text-muted-foreground mb-4">
            Fill in the gaps with the correct words. Click a word to select it, then click a gap to place it.
          </p>
          
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-muted-foreground">
              Sentence {currentIndex + 1} of {sentences.length}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-sm">
                <span className="text-green-600 dark:text-green-400">{completedCount}</span>
                <span className="text-muted-foreground"> / {sentences.length} complete</span>
              </span>
            </div>
          </div>

          <div className="bg-card border rounded-lg p-6 mb-6">
            <p className="font-serif text-xl leading-relaxed text-foreground/90">
              {currentSentence.template.map((item, idx) => {
                if (item.type === "text") {
                  return <span key={idx}>{item.content}</span>;
                }
                const gapId = item.gapId!;
                const placed = placedWords[gapId];
                const isIncorrect = incorrectGapsSet.has(gapId);
                const isClickTarget = selectedWord && !placed;
                
                return (
                  <span
                    key={idx}
                    onClick={() => handleGapClick(gapId)}
                    onDrop={(e) => handleDrop(e, gapId)}
                    onDragOver={handleDragOver}
                    data-testid={`gap-${gapId}`}
                    className={`
                      inline-flex items-center justify-center min-w-[80px] h-8 mx-1
                      border-b-2 border-dashed cursor-pointer transition-colors
                      ${placed 
                        ? isIncorrect
                          ? "bg-destructive/10 border-destructive text-destructive"
                          : validationState === "correct"
                            ? "bg-green-100 dark:bg-green-900/30 border-green-500 text-green-700 dark:text-green-400"
                            : "bg-primary/10 border-primary"
                        : isClickTarget
                          ? "bg-primary/20 border-primary"
                          : "border-muted-foreground/50"
                      }
                    `}
                    draggable={!!placed}
                    onDragStart={(e) => placed && handleDragStart(e, placed, gapId)}
                  >
                    {placed || ""}
                  </span>
                );
              })}
            </p>
          </div>

          {availableWords.length > 0 && (
            <div className="bg-muted/50 rounded-lg p-4 mb-6">
              <p className="text-sm text-muted-foreground mb-3">Word bank:</p>
              <div className="flex flex-wrap gap-2">
                {availableWords.map((word, idx) => (
                  <Button
                    key={idx}
                    variant={selectedWord?.index === idx ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleWordBankClick(word, idx)}
                    draggable
                    onDragStart={(e) => handleDragStart(e, word)}
                    data-testid={`word-bank-${idx}`}
                    className="cursor-grab active:cursor-grabbing"
                  >
                    {word}
                  </Button>
                ))}
              </div>
            </div>
          )}

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

          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <Button onClick={handleCheck} data-testid="button-check" disabled={availableWords.length > 0}>
                <Check className="h-4 w-4 mr-2" />
                Check
              </Button>
              <Button variant="outline" onClick={handleReset} data-testid="button-reset-sentence">
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset
              </Button>
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={handlePrev}
                disabled={currentIndex === 0}
                data-testid="button-prev"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={handleNext}
                disabled={currentIndex === sentences.length - 1}
                data-testid="button-next"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {allComplete && (
        <div className="border-t px-6 sm:px-8 py-4">
          <div className="max-w-3xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
              <CheckCircle2 className="h-5 w-5" />
              <span className="font-medium">All sentences completed!</span>
            </div>
            <Button variant="outline" onClick={handleFullReset} data-testid="button-reset-all">
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset All
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function extractSentencesWithGaps(paragraphs: string[], flashcardWords: string[]): SentenceData[] {
  const flashcardWordsLower = new Set(flashcardWords.map(w => w.toLowerCase()));
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
      const totalWordCount = cleanWords.filter(w => w.length > 0).length;
      
      const flashcardWordsInSentence = cleanWords.filter(w => w && flashcardWordsLower.has(w));
      
      if (flashcardWordsInSentence.length === 0) return;

      // Limit total gaps to ~30% of words, minimum 1, maximum 3
      const maxGaps = Math.max(1, Math.min(3, Math.ceil(totalWordCount * 0.3)));
      
      // Prioritize flashcard words, then add random words if room
      const uniqueFlashcardWords = Array.from(new Set(flashcardWordsInSentence));
      const flashcardGaps = uniqueFlashcardWords.slice(0, maxGaps);
      
      const remainingSlots = maxGaps - flashcardGaps.length;
      let randomWordsToGap: string[] = [];
      
      if (remainingSlots > 0) {
        const otherWords = cleanWords.filter(w => w && !flashcardWordsLower.has(w) && w.length > 2);
        const uniqueOthers = Array.from(new Set(otherWords));
        const shuffledOthers = shuffleArray(uniqueOthers);
        randomWordsToGap = shuffledOthers.slice(0, remainingSlots);
      }
      
      const wordsToGap = new Set([...flashcardGaps, ...randomWordsToGap]);
      const usedInSentence = new Set<string>();

      words.forEach((w) => {
        const cleanWord = w.replace(/[.,!?;:«»„"'"]/g, "").trim();
        const cleanWordLower = cleanWord.toLowerCase();
        const shouldGap = cleanWord && wordsToGap.has(cleanWordLower) && !usedInSentence.has(cleanWordLower);

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

function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
