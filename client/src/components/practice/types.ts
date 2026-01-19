export type ValidationState = "idle" | "correct" | "incorrect";

export interface FillModeState {
  placedWords: Record<number, string | null>;
  availableWords: string[];
  validationState: ValidationState;
  incorrectGaps: number[];
  initialized: boolean;
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
}

export interface WriteModeState {
  inputs: Record<number, string>;
  validationState: ValidationState;
  incorrectGaps: number[];
  initialized: boolean;
}

export interface CardsQuestionState {
  cardId: string;
  germanWord: string;
  correctAnswer: string;
  options: string[];
  selectedAnswer: string | null;
  isCorrect: boolean | null;
}

export interface CardsModeState {
  questions: CardsQuestionState[];
  currentIndex: number;
  showResults: boolean;
  initialized: boolean;
  flashcardCount: number;
}

export interface PracticeState {
  fill: FillModeState;
  order: OrderModeState;
  write: WriteModeState;
  cards: CardsModeState;
}

export function createInitialPracticeState(): PracticeState {
  return {
    fill: {
      placedWords: {},
      availableWords: [],
      validationState: "idle",
      incorrectGaps: [],
      initialized: false,
    },
    order: {
      currentIndex: 0,
      sentenceStates: {},
      initialized: false,
    },
    write: {
      inputs: {},
      validationState: "idle",
      incorrectGaps: [],
      initialized: false,
    },
    cards: {
      questions: [],
      currentIndex: 0,
      showResults: false,
      initialized: false,
      flashcardCount: 0,
    },
  };
}
