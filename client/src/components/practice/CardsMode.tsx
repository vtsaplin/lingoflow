import { useMemo, useEffect, useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, RotateCcw, Layers, Volume2, Check, Trash2, List } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Flashcard } from "@/hooks/use-flashcards";
import type { CardsModeState, CardsDirectionState, CardsQuestionState, CardsDirection } from "./types";
import { useTTS } from "@/hooks/use-services";
import { useSettings } from "@/hooks/use-settings";

function playSound(correct: boolean) {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    if (correct) {
      oscillator.frequency.setValueAtTime(523, audioContext.currentTime);
      oscillator.frequency.setValueAtTime(659, audioContext.currentTime + 0.1);
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
    } else {
      oscillator.frequency.setValueAtTime(200, audioContext.currentTime);
      oscillator.frequency.setValueAtTime(150, audioContext.currentTime + 0.15);
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
    }
  } catch (e) {
    // Audio not supported, ignore
  }
}

interface CardsModeProps {
  flashcards: Flashcard[];
  state: CardsModeState;
  onStateChange: (state: CardsModeState) => void;
  onResetProgress?: (direction: CardsDirection) => void;
  onDirectionComplete?: (direction: CardsDirection) => void;
  onRemoveFlashcard?: (id: string) => void;
  onClearAllFlashcards?: () => void;
  topicId: string;
  textId: string;
  deRuComplete: boolean;
  ruDeComplete: boolean;
}

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function generateQuestions(flashcards: Flashcard[], direction: CardsDirection): CardsQuestionState[] {
  if (flashcards.length === 0) return [];
  
  const isDeRu = direction === "de-ru";
  // Use baseForm for display if available, fall back to german
  const getDisplayWord = (card: Flashcard) => card.baseForm || card.german;
  const uniqueAnswers = Array.from(new Set(flashcards.map(f => isDeRu ? f.translation : getDisplayWord(f))));
  
  return shuffleArray(flashcards).map(card => {
    const questionWord = isDeRu ? getDisplayWord(card) : card.translation;
    const correctAnswer = isDeRu ? card.translation : getDisplayWord(card);
    
    const wrongOptions = uniqueAnswers
      .filter(t => t !== correctAnswer)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);
    
    const options = shuffleArray([correctAnswer, ...wrongOptions]);
    
    return {
      cardId: card.id,
      questionWord,
      correctAnswer,
      options,
      selectedAnswer: null,
      isCorrect: null
    };
  });
}

function createInitialDirectionState(): CardsDirectionState {
  return {
    questions: [],
    currentIndex: 0,
    showResults: false,
    initialized: false,
    flashcardCount: 0,
  };
}

export function CardsMode({ 
  flashcards, 
  state, 
  onStateChange, 
  onResetProgress, 
  onDirectionComplete,
  onRemoveFlashcard,
  onClearAllFlashcards,
  topicId, 
  textId,
  deRuComplete,
  ruDeComplete
}: CardsModeProps) {
  const [viewMode, setViewMode] = useState<"quiz" | "manage">("quiz");
  const { direction } = state;
  const currentDirectionState = direction === "de-ru" ? state.deRu : state.ruDe;
  
  const uniqueTranslationCount = useMemo(() => 
    new Set(flashcards.map(f => f.translation)).size,
    [flashcards]
  );
  
  const uniqueGermanCount = useMemo(() => 
    new Set(flashcards.map(f => f.german)).size,
    [flashcards]
  );

  const autoAdvanceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const lastSpokenCardIdRef = useRef<string | null>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const tts = useTTS();
  const { settings } = useSettings();
  const [playingOptionIdx, setPlayingOptionIdx] = useState<number | null>(null);

  useEffect(() => {
    return () => {
      if (autoAdvanceTimerRef.current) {
        clearTimeout(autoAdvanceTimerRef.current);
      }
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      }
    };
  }, []);

  // Auto-speak German words in DE→RU mode
  useEffect(() => {
    if (direction !== "de-ru") return;
    
    const { questions, currentIndex, showResults } = currentDirectionState;
    const currentQuestion = questions[currentIndex];
    
    if (
      currentQuestion && 
      !showResults && 
      currentQuestion.selectedAnswer === null &&
      lastSpokenCardIdRef.current !== currentQuestion.cardId
    ) {
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      }
      
      lastSpokenCardIdRef.current = currentQuestion.cardId;
      tts.mutate(
        { text: currentQuestion.questionWord, speed: 1.0, voice: settings.ttsVoice },
        {
          onSuccess: (blob) => {
            const url = URL.createObjectURL(blob);
            const audio = new Audio(url);
            currentAudioRef.current = audio;
            audio.play().catch(() => {});
            audio.onended = () => {
              URL.revokeObjectURL(url);
              if (currentAudioRef.current === audio) {
                currentAudioRef.current = null;
              }
            };
          }
        }
      );
    }
  }, [direction, currentDirectionState.currentIndex, currentDirectionState.questions, currentDirectionState.showResults, tts]);

  // Check for 100% completion - only if flashcard count matches
  useEffect(() => {
    const { questions, showResults, flashcardCount: stateFlashcardCount } = currentDirectionState;
    // Guard: only mark complete if flashcard count hasn't changed since questions were generated
    if (stateFlashcardCount !== flashcards.length) return;
    if (showResults && questions.length > 0) {
      const correctCount = questions.filter(q => q.isCorrect === true).length;
      if (correctCount === questions.length) {
        onDirectionComplete?.(direction);
      }
    }
  }, [currentDirectionState.showResults, currentDirectionState.questions, currentDirectionState.flashcardCount, flashcards.length, direction, onDirectionComplete]);

  const updateDirectionState = useCallback((newDirectionState: CardsDirectionState) => {
    const latestState = stateRef.current;
    if (latestState.direction === "de-ru") {
      onStateChange({ ...latestState, deRu: newDirectionState });
    } else {
      onStateChange({ ...latestState, ruDe: newDirectionState });
    }
  }, [onStateChange]);

  // Initialize questions when needed
  useEffect(() => {
    const minUnique = direction === "de-ru" ? uniqueTranslationCount : uniqueGermanCount;
    const flashcardCountIncreased = currentDirectionState.initialized && flashcards.length > currentDirectionState.flashcardCount;
    const flashcardCountDecreased = currentDirectionState.initialized && flashcards.length < currentDirectionState.flashcardCount;
    
    if (!currentDirectionState.initialized && flashcards.length >= 4 && minUnique >= 4) {
      updateDirectionState({
        questions: generateQuestions(flashcards, direction),
        currentIndex: 0,
        showResults: false,
        initialized: true,
        flashcardCount: flashcards.length
      });
    } else if (flashcardCountDecreased) {
      if (flashcards.length >= 4 && minUnique >= 4) {
        const remainingCardIds = new Set(flashcards.map(f => f.id));
        const filteredQuestions = currentDirectionState.questions.filter(q => remainingCardIds.has(q.cardId));
        
        let newCurrentIndex = currentDirectionState.currentIndex;
        if (newCurrentIndex >= filteredQuestions.length) {
          newCurrentIndex = Math.max(0, filteredQuestions.length - 1);
        }
        
        const allAnswered = filteredQuestions.length > 0 && 
          filteredQuestions.every(q => q.selectedAnswer !== null);
        
        updateDirectionState({
          ...currentDirectionState,
          questions: filteredQuestions,
          currentIndex: newCurrentIndex,
          showResults: allAnswered ? true : currentDirectionState.showResults,
          flashcardCount: flashcards.length
        });
      } else {
        updateDirectionState({
          questions: [],
          currentIndex: 0,
          showResults: false,
          initialized: true,
          flashcardCount: flashcards.length
        });
      }
    } else if (flashcardCountIncreased && flashcards.length >= 4 && minUnique >= 4) {
      const existingCardIds = new Set(currentDirectionState.questions.map(q => q.cardId));
      const newFlashcards = flashcards.filter(f => !existingCardIds.has(f.id));
      
      if (newFlashcards.length > 0) {
        const isDeRu = direction === "de-ru";
        // Use baseForm for display if available, fall back to german
        const getDisplayWord = (card: Flashcard) => card.baseForm || card.german;
        const uniqueAnswers = Array.from(new Set(flashcards.map(f => isDeRu ? f.translation : getDisplayWord(f))));
        
        const newQuestions = newFlashcards.map(card => {
          const questionWord = isDeRu ? getDisplayWord(card) : card.translation;
          const correctAnswer = isDeRu ? card.translation : getDisplayWord(card);
          
          const wrongOptions = uniqueAnswers
            .filter(t => t !== correctAnswer)
            .sort(() => Math.random() - 0.5)
            .slice(0, 3);
          const options = shuffleArray([correctAnswer, ...wrongOptions]);
          return {
            cardId: card.id,
            questionWord,
            correctAnswer,
            options,
            selectedAnswer: null,
            isCorrect: null
          };
        });
        
        const updatedQuestions = [...currentDirectionState.questions, ...newQuestions];
        const firstNewIndex = currentDirectionState.questions.length;
        
        updateDirectionState({
          ...currentDirectionState,
          questions: updatedQuestions,
          currentIndex: currentDirectionState.showResults ? firstNewIndex : currentDirectionState.currentIndex,
          showResults: false,
          flashcardCount: flashcards.length
        });
        
        // Reset completion status when new flashcards are added
        onResetProgress?.(direction);
      }
    }
  }, [currentDirectionState.initialized, currentDirectionState.flashcardCount, flashcards, uniqueTranslationCount, uniqueGermanCount, direction, updateDirectionState, currentDirectionState, onResetProgress]);

  const handleDirectionChange = useCallback((newDirection: CardsDirection) => {
    if (autoAdvanceTimerRef.current) {
      clearTimeout(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = null;
    }
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    lastSpokenCardIdRef.current = null;
    
    const currentState = stateRef.current;
    const targetDirState = newDirection === "de-ru" ? currentState.deRu : currentState.ruDe;
    
    // Check if the target direction needs reinitialization due to flashcard count change
    if (targetDirState.initialized && targetDirState.flashcardCount !== flashcards.length) {
      const minUnique = newDirection === "de-ru" ? uniqueTranslationCount : uniqueGermanCount;
      if (flashcards.length >= 4 && minUnique >= 4) {
        // Reinitialize the target direction with current flashcards
        const newDirState: CardsDirectionState = {
          questions: generateQuestions(flashcards, newDirection),
          currentIndex: 0,
          showResults: false,
          initialized: true,
          flashcardCount: flashcards.length
        };
        if (newDirection === "de-ru") {
          onStateChange({ ...currentState, direction: newDirection, deRu: newDirState });
        } else {
          onStateChange({ ...currentState, direction: newDirection, ruDe: newDirState });
        }
        // Reset completion status for the reinitialized direction
        onResetProgress?.(newDirection);
        return;
      }
    }
    
    onStateChange({ ...currentState, direction: newDirection });
  }, [onStateChange, flashcards, uniqueTranslationCount, uniqueGermanCount, onResetProgress]);

  const handleReset = useCallback(() => {
    lastSpokenCardIdRef.current = null;
    updateDirectionState({
      questions: generateQuestions(flashcards, direction),
      currentIndex: 0,
      showResults: false,
      initialized: true,
      flashcardCount: flashcards.length
    });
    onResetProgress?.(direction);
  }, [flashcards, direction, updateDirectionState, onResetProgress]);

  const handleSelectAnswer = useCallback((answer: string) => {
    const currentState = stateRef.current;
    const dirState = currentState.direction === "de-ru" ? currentState.deRu : currentState.ruDe;
    const { questions, currentIndex } = dirState;
    
    if (questions[currentIndex]?.selectedAnswer !== null) return;
    
    const isCorrect = answer === questions[currentIndex].correctAnswer;
    const newQuestions = [...questions];
    newQuestions[currentIndex] = {
      ...newQuestions[currentIndex],
      selectedAnswer: answer,
      isCorrect
    };
    
    updateDirectionState({
      ...dirState,
      questions: newQuestions
    });
    
    playSound(isCorrect);
    
    if (autoAdvanceTimerRef.current) {
      clearTimeout(autoAdvanceTimerRef.current);
    }
    
    autoAdvanceTimerRef.current = setTimeout(() => {
      const latestState = stateRef.current;
      const latestDirState = latestState.direction === "de-ru" ? latestState.deRu : latestState.ruDe;
      if (currentIndex < questions.length - 1) {
        if (latestState.direction === "de-ru") {
          onStateChange({ ...latestState, deRu: { ...latestDirState, currentIndex: currentIndex + 1 } });
        } else {
          onStateChange({ ...latestState, ruDe: { ...latestDirState, currentIndex: currentIndex + 1 } });
        }
      } else {
        if (latestState.direction === "de-ru") {
          onStateChange({ ...latestState, deRu: { ...latestDirState, showResults: true } });
        } else {
          onStateChange({ ...latestState, ruDe: { ...latestDirState, showResults: true } });
        }
      }
      autoAdvanceTimerRef.current = null;
    }, 1200);
  }, [updateDirectionState, onStateChange]);

  const speakCurrentWord = useCallback(() => {
    const currentState = stateRef.current;
    const dirState = currentState.direction === "de-ru" ? currentState.deRu : currentState.ruDe;
    const currentQuestion = dirState.questions[dirState.currentIndex];
    if (!currentQuestion) return;
    
    // For DE→RU, speak the German question word
    // For RU→DE, speak the correct German answer after selection
    const textToSpeak = currentState.direction === "de-ru" 
      ? currentQuestion.questionWord 
      : currentQuestion.correctAnswer;
    
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    
    tts.mutate(
      { text: textToSpeak, speed: 1.0, voice: settings.ttsVoice },
      {
        onSuccess: (blob) => {
          const url = URL.createObjectURL(blob);
          const audio = new Audio(url);
          currentAudioRef.current = audio;
          audio.play().catch(() => {});
          audio.onended = () => {
            URL.revokeObjectURL(url);
            if (currentAudioRef.current === audio) {
              currentAudioRef.current = null;
            }
          };
        }
      }
    );
  }, [tts]);

  const { questions, currentIndex, showResults } = currentDirectionState;
  const correctCount = questions.filter(q => q.isCorrect === true).length;
  const incorrectCount = questions.filter(q => q.isCorrect === false).length;
  const currentQuestion = questions[currentIndex];
  const minUnique = direction === "de-ru" ? uniqueTranslationCount : uniqueGermanCount;

  const ViewModeToggle = () => (
    <div className="flex items-center gap-1 p-1 bg-muted rounded-lg">
      <button
        onClick={() => setViewMode("quiz")}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
          viewMode === "quiz" 
            ? "bg-background shadow-sm text-foreground" 
            : "text-muted-foreground hover:text-foreground"
        }`}
        data-testid="button-view-quiz"
      >
        <Layers className="h-4 w-4" />
        Quiz
      </button>
      <button
        onClick={() => setViewMode("manage")}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
          viewMode === "manage" 
            ? "bg-background shadow-sm text-foreground" 
            : "text-muted-foreground hover:text-foreground"
        }`}
        data-testid="button-view-manage"
      >
        <List className="h-4 w-4" />
        Manage
      </button>
    </div>
  );

  const ManageView = () => (
    <div className="flex flex-col h-full">
      <div className="px-6 sm:px-8 py-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <ViewModeToggle />
            {flashcards.length > 0 && onClearAllFlashcards && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" data-testid="button-clear-all-flashcards">
                    <Trash2 className="h-4 w-4 mr-1.5" />
                    Clear All
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Clear all flashcards?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will delete all {flashcards.length} flashcards for this text. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={onClearAllFlashcards} data-testid="button-confirm-clear-all">
                      Clear All
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>
      </div>
      <ScrollArea className="flex-1 px-6 sm:px-8 pb-6">
        <div className="max-w-4xl mx-auto">
          {flashcards.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Layers className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground text-center">
                No flashcards saved for this text yet.
              </p>
              <p className="text-sm text-muted-foreground text-center mt-2">
                Switch to Study mode and select Words to add them.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {flashcards.map((card) => (
                <div
                  key={card.id}
                  className="flex items-center gap-3 p-3 rounded-lg border bg-card"
                  data-testid={`flashcard-item-${card.id}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-foreground">
                      {card.baseForm || card.german}
                    </div>
                    <div className="text-sm text-muted-foreground truncate">
                      {card.translation}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        const textToSpeak = card.baseForm || card.german;
                        tts.mutate(
                          { text: textToSpeak, speed: 1.0, voice: settings.ttsVoice },
                          {
                            onSuccess: (blob) => {
                              const url = URL.createObjectURL(blob);
                              const audio = new Audio(url);
                              audio.play().catch(() => {});
                              audio.onended = () => URL.revokeObjectURL(url);
                            }
                          }
                        );
                      }}
                      data-testid={`button-play-flashcard-${card.id}`}
                    >
                      <Volume2 className="h-4 w-4" />
                    </Button>
                    {onRemoveFlashcard && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onRemoveFlashcard(card.id)}
                        data-testid={`button-delete-flashcard-${card.id}`}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );

  if (viewMode === "manage") {
    return <ManageView />;
  }

  if (flashcards.length === 0) {
    return (
      <div className="flex flex-col h-full items-center justify-center px-6 py-12">
        <Layers className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground text-center">
          No flashcards saved for this text yet.
        </p>
        <p className="text-sm text-muted-foreground text-center mt-2">
          Switch to Study mode and select Words to add them.
        </p>
      </div>
    );
  }
  
  if (minUnique < 4) {
    return (
      <div className="flex flex-col h-full items-center justify-center px-6 py-12">
        <Layers className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground text-center">
          You need at least 4 flashcards with unique translations to practice.
        </p>
        <p className="text-sm text-muted-foreground text-center mt-2">
          Currently saved: {flashcards.length} card{flashcards.length !== 1 ? "s" : ""} ({minUnique} unique). Add more in Study mode.
        </p>
      </div>
    );
  }

  // Direction tabs
  const DirectionTabs = () => (
    <div className="flex items-center gap-1 p-1 bg-muted rounded-lg">
      <button
        onClick={() => handleDirectionChange("de-ru")}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
          direction === "de-ru" 
            ? "bg-background shadow-sm text-foreground" 
            : "text-muted-foreground hover:text-foreground"
        }`}
        data-testid="button-direction-de-ru"
      >
        DE → RU
        {deRuComplete && <Check className="h-3.5 w-3.5 text-green-500" />}
      </button>
      <button
        onClick={() => handleDirectionChange("ru-de")}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
          direction === "ru-de" 
            ? "bg-background shadow-sm text-foreground" 
            : "text-muted-foreground hover:text-foreground"
        }`}
        data-testid="button-direction-ru-de"
      >
        RU → DE
        {ruDeComplete && <Check className="h-3.5 w-3.5 text-green-500" />}
      </button>
    </div>
  );

  if (showResults) {
    const percentage = questions.length > 0 ? Math.round((correctCount / questions.length) * 100) : 0;
    return (
      <div className="flex flex-col h-full">
        <div className="px-6 sm:px-8 py-4">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3 flex-wrap">
                <ViewModeToggle />
                <DirectionTabs />
              </div>
              <Button
                variant="outline"
                onClick={handleReset}
                data-testid="button-reset-cards"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset
              </Button>
            </div>
            <p className="text-sm text-muted-foreground mt-3">
              {percentage === 100 ? "Perfect score! Try the other direction." : "Practice makes perfect!"}
            </p>
          </div>
        </div>
        
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
          <div className="text-center">
            <div className={`text-6xl font-bold mb-4 ${percentage >= 70 ? "text-green-500" : percentage >= 50 ? "text-yellow-500" : "text-destructive"}`}>
              {percentage}%
            </div>
            <p className="text-xl text-foreground mb-2">
              {correctCount} of {questions.length} correct
            </p>
            <p className="text-muted-foreground mb-6">
              {percentage === 100 
                ? "Perfect! Direction complete!" 
                : percentage >= 90 
                  ? "Excellent!" 
                  : percentage >= 70 
                    ? "Good job!" 
                    : percentage >= 50 
                      ? "Keep practicing!" 
                      : "Try again!"}
            </p>
            <Button onClick={handleReset} data-testid="button-restart-cards">
              <RotateCcw className="h-4 w-4 mr-2" />
              Practice Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!currentQuestion) return null;

  const isDeRu = direction === "de-ru";

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 sm:px-8 py-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3 flex-wrap">
              <ViewModeToggle />
              <DirectionTabs />
            </div>
            
            <div className="flex items-center justify-center gap-3">
              <span className="text-sm text-muted-foreground shrink-0">{correctCount + incorrectCount}/{questions.length}</span>
              <div className="w-32 bg-muted rounded-full h-1.5">
                <div 
                  className="bg-primary h-1.5 rounded-full transition-all"
                  style={{ width: `${((correctCount + incorrectCount) / questions.length) * 100}%` }}
                />
              </div>
              <div className="flex items-center gap-2 text-sm shrink-0">
                <span className="text-green-600 dark:text-green-400">{correctCount}</span>
                <span className="text-muted-foreground">/</span>
                <span className="text-destructive">{incorrectCount}</span>
              </div>
            </div>
            
            <Button
              variant="outline"
              onClick={handleReset}
              data-testid="button-reset-cards"
              className="shrink-0"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset
            </Button>
          </div>
          <p className="text-sm text-muted-foreground mt-3">
            {isDeRu 
              ? "Select the correct Russian translation for the German word."
              : "Select the correct German word for the Russian translation."}
          </p>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-start px-6 pt-8">
        <div className="text-center mb-6 w-full max-w-lg px-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
            {isDeRu ? "German" : "Russian"}
          </p>
          <div className="flex items-center justify-center gap-3">
            <p className={`font-serif font-bold text-foreground text-center ${isDeRu ? "text-3xl" : "text-xl leading-relaxed"}`}>
              {currentQuestion.questionWord}
            </p>
            {isDeRu && (
              <Button
                variant="ghost"
                size="icon"
                onClick={speakCurrentWord}
                disabled={tts.isPending}
                className="h-9 w-9 shrink-0"
                data-testid="button-speak-card-word"
              >
                <Volume2 className="h-5 w-5" />
              </Button>
            )}
          </div>
        </div>

        <div className="w-full max-w-md space-y-3">
          <p className="text-xs text-muted-foreground uppercase tracking-wider text-center mb-4">
            Select the correct {isDeRu ? "translation" : "German word"}
          </p>
          {currentQuestion.options.map((option, idx) => {
            const isSelected = currentQuestion.selectedAnswer === option;
            const isCorrectOption = option === currentQuestion.correctAnswer;
            const showFeedback = currentQuestion.selectedAnswer !== null;
            
            let buttonClass = "w-full justify-start text-left py-4 text-base";
            if (showFeedback) {
              if (isCorrectOption) {
                buttonClass += " bg-green-500/20 border-green-500 text-green-700 dark:text-green-400";
              } else if (isSelected && !isCorrectOption) {
                buttonClass += " bg-destructive/20 border-destructive text-destructive";
              }
            }

            return (
              <div key={idx} className="flex items-center gap-2">
                <Button
                  variant="outline"
                  className={buttonClass}
                  onClick={() => handleSelectAnswer(option)}
                  disabled={showFeedback}
                  data-testid={`button-option-${idx}`}
                >
                  <span className="flex-1 line-clamp-2 text-left">{option}</span>
                  {showFeedback && isCorrectOption && (
                    <CheckCircle2 className="h-5 w-5 text-green-500 ml-2 shrink-0" />
                  )}
                  {showFeedback && isSelected && !isCorrectOption && (
                    <XCircle className="h-5 w-5 text-destructive ml-2 shrink-0" />
                  )}
                </Button>
                {!isDeRu && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (currentAudioRef.current) {
                        currentAudioRef.current.pause();
                        currentAudioRef.current = null;
                      }
                      setPlayingOptionIdx(idx);
                      tts.mutate(
                        { text: option, speed: 1.0, voice: settings.ttsVoice },
                        {
                          onSuccess: (blob) => {
                            const url = URL.createObjectURL(blob);
                            const audio = new Audio(url);
                            currentAudioRef.current = audio;
                            audio.play().catch(() => {});
                            audio.onended = () => {
                              URL.revokeObjectURL(url);
                              setPlayingOptionIdx(null);
                              if (currentAudioRef.current === audio) {
                                currentAudioRef.current = null;
                              }
                            };
                          },
                          onError: () => {
                            setPlayingOptionIdx(null);
                          }
                        }
                      );
                    }}
                    disabled={tts.isPending}
                    className={`shrink-0 ${playingOptionIdx === idx ? "text-primary bg-primary/10" : ""}`}
                    data-testid={`button-speak-option-${idx}`}
                  >
                    <Volume2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
