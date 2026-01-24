export type ValidationState = "idle" | "correct" | "incorrect";

export interface FillSentenceState {
  placedWords: Record<number, string | null>;
  availableWords: string[];
  validationState: ValidationState;
  incorrectGaps: number[];
}

export interface FillModeState {
  currentIndex: number;
  sentenceStates: Record<number, FillSentenceState>;
  initialized: boolean;
  flashcardCount: number; // Kept for backward compatibility with stored state
}

export interface OrderSentenceState {
  shuffledWords: string[];
  orderedWords: string[];
  validationState: ValidationState;
}

export interface OrderModeState {
  currentIndex: number;
  sentenceStates: Record<number, OrderSentenceState>;
  initialized: boolean;
  flashcardCount: number;
}

export interface WriteSentenceState {
  inputs: Record<number, string>;
  validationState: ValidationState;
  incorrectGaps: number[];
}

export interface WriteModeState {
  currentIndex: number;
  sentenceStates: Record<number, WriteSentenceState>;
  initialized: boolean;
}

export type CardsDirection = "de-ru" | "ru-de";

export interface CardsQuestionState {
  cardId: string;
  questionWord: string;
  correctAnswer: string;
  options: string[];
  selectedAnswer: string | null;
  isCorrect: boolean | null;
}

export interface CardsDirectionState {
  questions: CardsQuestionState[];
  currentIndex: number;
  showResults: boolean;
  initialized: boolean;
  flashcardCount: number;
}

export interface CardsModeState {
  direction: CardsDirection;
  deRu: CardsDirectionState;
  ruDe: CardsDirectionState;
}

export interface SpeakQuestionState {
  question: string;
  context: string;
  expectedTopics: string[];
  suggestedResponse?: string;
  userTranscript?: string;
  isCorrect?: boolean;
}

export interface SpeakModeState {
  currentQuestionIndex: number;
  questions: SpeakQuestionState[];
  previousQuestions: string[];
  initialized: boolean;
}

export interface PracticeState {
  fill: FillModeState;
  order: OrderModeState;
  write: WriteModeState;
  cards: CardsModeState;
  speak: SpeakModeState;
}

function createInitialCardsDirectionState(): CardsDirectionState {
  return {
    questions: [],
    currentIndex: 0,
    showResults: false,
    initialized: false,
    flashcardCount: 0,
  };
}

export function createInitialPracticeState(): PracticeState {
  return {
    fill: {
      currentIndex: 0,
      sentenceStates: {},
      initialized: false,
      flashcardCount: 0,
    },
    order: {
      currentIndex: 0,
      sentenceStates: {},
      initialized: false,
      flashcardCount: 0,
    },
    write: {
      currentIndex: 0,
      sentenceStates: {},
      initialized: false,
    },
    cards: {
      direction: "de-ru",
      deRu: createInitialCardsDirectionState(),
      ruDe: createInitialCardsDirectionState(),
    },
    speak: {
      currentQuestionIndex: 0,
      questions: [],
      previousQuestions: [],
      initialized: false,
    },
  };
}
