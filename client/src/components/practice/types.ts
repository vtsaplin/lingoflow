export type ValidationState = "idle" | "correct" | "incorrect";

export interface FillModeState {
  placedWords: Record<number, string | null>;
  availableWords: string[];
  validationState: ValidationState;
  incorrectGaps: number[];
  initialized: boolean;
  flashcardCount: number;
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

export interface WriteModeState {
  inputs: Record<number, string>;
  validationState: ValidationState;
  incorrectGaps: number[];
  initialized: boolean;
  flashcardCount: number;
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

export interface PracticeState {
  fill: FillModeState;
  order: OrderModeState;
  write: WriteModeState;
  cards: CardsModeState;
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
      placedWords: {},
      availableWords: [],
      validationState: "idle",
      incorrectGaps: [],
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
      inputs: {},
      validationState: "idle",
      incorrectGaps: [],
      initialized: false,
      flashcardCount: 0,
    },
    cards: {
      direction: "de-ru",
      deRu: createInitialCardsDirectionState(),
      ruDe: createInitialCardsDirectionState(),
    },
  };
}
