import { useMemo, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, RotateCcw, Layers } from "lucide-react";
import type { Flashcard } from "@/hooks/use-flashcards";
import type { CardsModeState, CardsQuestionState } from "./types";

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
  onResetProgress?: () => void;
  topicId: string;
  textId: string;
}

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function generateQuestions(flashcards: Flashcard[]): CardsQuestionState[] {
  if (flashcards.length === 0) return [];
  
  const uniqueTranslations = Array.from(new Set(flashcards.map(f => f.translation)));
  
  return shuffleArray(flashcards).map(card => {
    const wrongOptions = uniqueTranslations
      .filter(t => t !== card.translation)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);
    
    const options = shuffleArray([card.translation, ...wrongOptions]);
    
    return {
      cardId: card.id,
      germanWord: card.german,
      correctAnswer: card.translation,
      options,
      selectedAnswer: null,
      isCorrect: null
    };
  });
}

export function CardsMode({ flashcards, state, onStateChange, onResetProgress, topicId, textId }: CardsModeProps) {
  const uniqueTranslationCount = useMemo(() => 
    new Set(flashcards.map(f => f.translation)).size,
    [flashcards]
  );

  useEffect(() => {
    const flashcardCountChanged = state.initialized && flashcards.length > state.flashcardCount;
    
    if (!state.initialized && flashcards.length >= 4 && uniqueTranslationCount >= 4) {
      onStateChange({
        questions: generateQuestions(flashcards),
        currentIndex: 0,
        showResults: false,
        initialized: true,
        flashcardCount: flashcards.length
      });
    } else if (flashcardCountChanged && flashcards.length >= 4 && uniqueTranslationCount >= 4) {
      const existingCardIds = new Set(state.questions.map(q => q.cardId));
      const newFlashcards = flashcards.filter(f => !existingCardIds.has(f.id));
      
      if (newFlashcards.length > 0) {
        const uniqueTranslations = Array.from(new Set(flashcards.map(f => f.translation)));
        const newQuestions = newFlashcards.map(card => {
          const wrongOptions = uniqueTranslations
            .filter(t => t !== card.translation)
            .sort(() => Math.random() - 0.5)
            .slice(0, 3);
          const options = shuffleArray([card.translation, ...wrongOptions]);
          return {
            cardId: card.id,
            germanWord: card.german,
            correctAnswer: card.translation,
            options,
            selectedAnswer: null,
            isCorrect: null
          };
        });
        
        const updatedQuestions = [...state.questions, ...newQuestions];
        const firstNewIndex = state.questions.length;
        
        onStateChange({
          ...state,
          questions: updatedQuestions,
          currentIndex: state.showResults ? firstNewIndex : state.currentIndex,
          showResults: false,
          flashcardCount: flashcards.length
        });
      }
    }
  }, [state.initialized, state.flashcardCount, flashcards, uniqueTranslationCount, onStateChange, state.questions]);

  if (flashcards.length === 0) {
    return (
      <div className="flex flex-col h-full items-center justify-center px-6 py-12">
        <Layers className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground text-center">
          No flashcards saved for this text yet.
        </p>
        <p className="text-sm text-muted-foreground text-center mt-2">
          Switch to Study mode and click on words to save them to your flashcards.
        </p>
      </div>
    );
  }
  
  if (uniqueTranslationCount < 4) {
    return (
      <div className="flex flex-col h-full items-center justify-center px-6 py-12">
        <Layers className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground text-center">
          You need at least 4 flashcards with different translations to practice.
        </p>
        <p className="text-sm text-muted-foreground text-center mt-2">
          Currently saved: {flashcards.length} card{flashcards.length !== 1 ? "s" : ""} ({uniqueTranslationCount} unique)
        </p>
      </div>
    );
  }

  const { questions, currentIndex, showResults } = state;
  const autoAdvanceTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (autoAdvanceTimerRef.current) {
        clearTimeout(autoAdvanceTimerRef.current);
      }
    };
  }, []);

  const handleNext = useCallback(() => {
    if (currentIndex < questions.length - 1) {
      onStateChange({
        ...state,
        currentIndex: currentIndex + 1
      });
    } else {
      onStateChange({
        ...state,
        showResults: true
      });
    }
  }, [currentIndex, questions.length, onStateChange, state]);

  const handleSelectAnswer = (answer: string) => {
    if (questions[currentIndex]?.selectedAnswer !== null) return;
    
    const isCorrect = answer === questions[currentIndex].correctAnswer;
    const newQuestions = [...questions];
    newQuestions[currentIndex] = {
      ...newQuestions[currentIndex],
      selectedAnswer: answer,
      isCorrect
    };
    onStateChange({
      ...state,
      questions: newQuestions
    });
    
    playSound(isCorrect);
    
    autoAdvanceTimerRef.current = setTimeout(() => {
      if (currentIndex < questions.length - 1) {
        onStateChange({
          ...state,
          questions: newQuestions,
          currentIndex: currentIndex + 1
        });
      } else {
        onStateChange({
          ...state,
          questions: newQuestions,
          showResults: true
        });
      }
    }, 1200);
  };

  const handleReset = () => {
    onStateChange({
      questions: generateQuestions(flashcards),
      currentIndex: 0,
      showResults: false,
      initialized: true,
      flashcardCount: flashcards.length
    });
    onResetProgress?.();
  };

  const correctCount = questions.filter(q => q.isCorrect === true).length;
  const currentQuestion = questions[currentIndex];

  if (showResults) {
    const percentage = questions.length > 0 ? Math.round((correctCount / questions.length) * 100) : 0;
    return (
      <div className="flex flex-col h-full items-center justify-center px-6 py-12">
        <div className="text-center">
          <div className={`text-6xl font-bold mb-4 ${percentage >= 70 ? "text-green-500" : percentage >= 50 ? "text-yellow-500" : "text-destructive"}`}>
            {percentage}%
          </div>
          <p className="text-xl text-foreground mb-2">
            {correctCount} of {questions.length} correct
          </p>
          <p className="text-muted-foreground mb-6">
            {percentage >= 90 ? "Excellent!" : percentage >= 70 ? "Good job!" : percentage >= 50 ? "Keep practicing!" : "Try again!"}
          </p>
          <Button onClick={handleReset} data-testid="button-restart-cards">
            <RotateCcw className="h-4 w-4 mr-2" />
            Practice Again
          </Button>
        </div>
      </div>
    );
  }

  if (!currentQuestion) return null;

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 sm:px-8 py-4 border-b">
        <div className="max-w-md mx-auto">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              Card {currentIndex + 1} of {questions.length}
            </span>
            <span className="text-sm text-muted-foreground">
              {correctCount} correct
            </span>
          </div>
          <div className="w-full bg-muted rounded-full h-1.5 mt-2">
            <div 
              className="bg-primary h-1.5 rounded-full transition-all"
              style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
            />
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-8">
        <div className="text-center mb-8">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">German</p>
          <p className="text-3xl font-serif font-bold text-foreground">
            {currentQuestion.germanWord}
          </p>
        </div>

        <div className="w-full max-w-md space-y-3">
          <p className="text-xs text-muted-foreground uppercase tracking-wider text-center mb-4">
            Select the correct translation
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
              <Button
                key={idx}
                variant="outline"
                className={buttonClass}
                onClick={() => handleSelectAnswer(option)}
                disabled={showFeedback}
                data-testid={`button-option-${idx}`}
              >
                <span className="flex-1">{option}</span>
                {showFeedback && isCorrectOption && (
                  <CheckCircle2 className="h-5 w-5 text-green-500 ml-2" />
                )}
                {showFeedback && isSelected && !isCorrectOption && (
                  <XCircle className="h-5 w-5 text-destructive ml-2" />
                )}
              </Button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
