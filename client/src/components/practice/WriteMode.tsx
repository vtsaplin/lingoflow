import { useMemo, useEffect, useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Check, RotateCcw, CheckCircle2, XCircle, PenLine, ChevronLeft, ChevronRight, Volume2, Loader2, Keyboard } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { WriteModeState, WriteSentenceState, ValidationState } from "./types";
import { useTTS } from "@/hooks/use-services";
import { useSettings } from "@/hooks/use-settings";

// Real-time umlaut replacement: ae→ä, oe→ö, ue→ü, ss→ß
function replaceUmlauts(text: string): string {
  return text
    .replace(/ae/gi, (match) => match[0] === 'A' ? 'Ä' : 'ä')
    .replace(/oe/gi, (match) => match[0] === 'O' ? 'Ö' : 'ö')
    .replace(/ue/gi, (match) => match[0] === 'U' ? 'Ü' : 'ü')
    .replace(/ss/g, 'ß');
}

interface WriteModeProps {
  paragraphs: string[];
  state: WriteModeState;
  onStateChange: (state: WriteModeState) => void;
  onResetProgress?: () => void;
  isCompleted?: boolean;
  translations: Record<string, string>;
  onTranslationAdd: (key: string, value: string) => void;
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

export function WriteMode({ paragraphs, state, onStateChange, onResetProgress, isCompleted = false, translations, onTranslationAdd }: WriteModeProps) {
  const sentences = useMemo(() => {
    return extractSentencesWithGaps(paragraphs);
  }, [paragraphs]);

  const { currentIndex, sentenceStates } = state;
  
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
  
  // All hooks must be at the top, before any conditional returns
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

  // Define variables before hooks that use them (to satisfy hook rules)
  const currentSentence = sentences[currentIndex] || { original: "", template: [], gapLookup: {} };
  
  // Auto-fetch translation when sentence changes
  useEffect(() => {
    const sentence = sentences[currentIndex];
    if (state.initialized && sentences.length > 0 && sentence && !translations[sentence.original]) {
      translateMutation.mutate({ text: sentence.original });
    }
  }, [state.initialized, currentIndex, sentences, translations]);
  
  const currentTranslation = translations[currentSentence.original];
  const currentState = sentenceStates[currentIndex] || {
    inputs: {},
    validationState: "idle" as ValidationState,
    incorrectGaps: [],
  };
  const { inputs, validationState, incorrectGaps } = currentState;
  const incorrectGapsSet = new Set(incorrectGaps);
  
  const tts = useTTS();
  const { settings } = useSettings();
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const prevValidationStateRef = useRef<ValidationState>(validationState);
  
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
    // Apply real-time umlaut replacement
    const convertedValue = replaceUmlauts(value);
    const newIncorrect = incorrectGaps.filter((id) => id !== gapId);
    updateCurrentSentenceState({
      inputs: { ...inputs, [gapId]: convertedValue },
      validationState: "idle",
      incorrectGaps: newIncorrect,
    });
  };

  const checkAnswers = useCallback(() => {
    if (!state.initialized || sentences.length === 0) return;
    
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
  }, [currentSentence.gapLookup, inputs, updateCurrentSentenceState, state.initialized, sentences.length]);

  // Auto-check when all gaps are filled
  useEffect(() => {
    if (validationState !== "idle") return;
    if (!state.initialized || sentences.length === 0) return;
    
    const gapIds = Object.keys(currentSentence.gapLookup).map(Number);
    const allFilled = gapIds.every(gapId => (inputs[gapId] || "").trim().length > 0);
    
    if (allFilled && gapIds.length > 0) {
      checkAnswers();
    }
  }, [inputs, currentSentence.gapLookup, validationState, checkAnswers, state.initialized, sentences.length]);

  // Early returns AFTER all hooks
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

  const handleCheck = () => {
    checkAnswers();
  };

  const handleReset = () => {
    updateCurrentSentenceState({
      inputs: {},
      validationState: "idle",
      incorrectGaps: [],
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
          
          <div className="mb-4 p-4 bg-muted/30 rounded-lg border" data-testid="text-translation-hint">
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

          <div className="bg-card border rounded-lg p-6">
            <p className="font-serif text-lg leading-relaxed text-foreground/90">
              {currentSentence.template.map((item, tIdx) => {
                if (item.type === "text") {
                  // Subtle highlight for non-gap words to show they are correct/fixed
                  return (
                    <span 
                      key={tIdx} 
                      className="text-green-700/70 dark:text-green-400/60"
                    >
                      {item.content}
                    </span>
                  );
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
            <div className="inline-flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 px-3 py-2 rounded-md" data-testid="text-umlaut-hint">
              <Keyboard className="h-3 w-3 flex-shrink-0" />
              <span>ae → ä, oe → ö, ue → ü, ss → ß</span>
            </div>
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
