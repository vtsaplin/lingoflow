import { useState, useRef, useEffect, useMemo } from "react";
import { Volume2, Loader2, PlayCircle, StopCircle, X, BookOpen, Puzzle, ArrowUpDown, PenLine, CheckCircle2, Eraser, Bookmark, BookmarkCheck, Layers, Trash2, Mic } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { useTTS, useTranslate, useDictionary } from "@/hooks/use-services";
import { usePracticeProgress } from "@/hooks/use-practice-progress";
import { useFlashcards } from "@/hooks/use-flashcards";
import { useSavedSentences } from "@/hooks/use-saved-sentences";
import { usePracticeState } from "@/hooks/use-practice-state";
import { FillMode } from "@/components/practice/FillMode";
import { OrderMode } from "@/components/practice/OrderMode";
import { WriteMode } from "@/components/practice/WriteMode";
import { CardsMode } from "@/components/practice/CardsMode";
import { SpeakMode } from "@/components/practice/SpeakMode";

type InteractionMode = "word" | "sentence";
type PracticeMode = "read" | "cards" | "fill" | "order" | "write" | "speak";

interface ReaderProps {
  topicId: string;
  textId: string;
  topicTitle: string;
  title: string;
  paragraphs: string[];
}

export function Reader({ topicId, textId, topicTitle, title, paragraphs }: ReaderProps) {
  const [practiceMode, setPracticeMode] = useState<PracticeMode>("read");
  const [interactionMode, setInteractionMode] = useState<InteractionMode>("sentence");
  const [selectedText, setSelectedText] = useState<string | null>(null);
  const [isReadingAll, setIsReadingAll] = useState(false);
  const [slowMode, setSlowMode] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  const { 
    practiceState, 
    updateFillState, 
    updateOrderState, 
    updateWriteState,
    updateCardsState,
    resetPracticeState,
    textKey,
    activeTextKey 
  } = usePracticeState(topicId, textId);
  
  const { setModeComplete, resetModeProgress, updateFlashcardCount, updateSentenceCount, getCompletionCount, isTextComplete, getTextProgress, resetTextProgress } = usePracticeProgress();
  const completionCount = getCompletionCount(topicId, textId);
  const completionPercentage = Math.round((completionCount / 5) * 100);
  const textComplete = isTextComplete(topicId, textId);
  const progress = getTextProgress(topicId, textId);
  
  const { addFlashcard, removeFlashcard, hasFlashcard, getFlashcardByGerman, getFlashcardsForText } = useFlashcards();
  const flashcardsForText = getFlashcardsForText(topicId, textId);
  
  const { getSentencesForText, addSentence, hasSentence, getSentenceByGerman, removeSentence } = useSavedSentences();
  const savedSentencesForText = getSentencesForText(topicId, textId);
  

  const sentenceContainsFlashcardWord = (sentence: string): boolean => {
    if (flashcardsForText.length === 0) return false;
    const normalizedSentence = sentence.toLowerCase();
    return flashcardsForText.some(card => {
      const word = card.german.toLowerCase();
      const regex = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      return regex.test(normalizedSentence);
    });
  };

  const eligibleSentences = useMemo(() => {
    const allSentences: string[] = [];
    paragraphs.forEach(p => {
      const sentences = p.match(/[^.!?]+[.!?]+["']?|[^.!?]+$/g) || [];
      sentences.forEach(s => {
        const trimmed = s.trim();
        if (trimmed && sentenceContainsFlashcardWord(trimmed)) {
          allSentences.push(trimmed);
        }
      });
    });
    return allSentences;
  }, [paragraphs, flashcardsForText]);

  useEffect(() => {
    if (activeTextKey !== textKey) return;
    updateFlashcardCount(topicId, textId, flashcardsForText.length);
  }, [flashcardsForText.length, topicId, textId, updateFlashcardCount, activeTextKey, textKey]);

  useEffect(() => {
    if (activeTextKey !== textKey) return;
    updateSentenceCount(topicId, textId, eligibleSentences.length);
  }, [eligibleSentences.length, topicId, textId, updateSentenceCount, activeTextKey, textKey]);

  useEffect(() => {
    if (activeTextKey !== textKey) return;
    if (practiceState.fill.validationState === "correct" && !progress.fill) {
      setModeComplete(topicId, textId, "fill");
    }
  }, [practiceState.fill.validationState, topicId, textId, setModeComplete, progress.fill, activeTextKey, textKey]);

  useEffect(() => {
    if (activeTextKey !== textKey) return;
    if (practiceState.write.validationState === "correct" && !progress.write) {
      setModeComplete(topicId, textId, "write");
    }
  }, [practiceState.write.validationState, topicId, textId, setModeComplete, progress.write, activeTextKey, textKey]);

  useEffect(() => {
    if (activeTextKey !== textKey) return;
    if (!practiceState.cards) return;
    const { showResults, initialized, flashcardCount: stateFlashcardCount, questions } = practiceState.cards;
    if (!initialized || !showResults) return;
    // Only mark complete if the flashcard count in CardsMode state matches the current flashcard count
    // This prevents re-marking complete after progress is reset due to new flashcards
    if (stateFlashcardCount !== flashcardsForText.length) return;
    // Only mark complete if ALL questions are answered correctly (100%)
    const allCorrect = questions.length > 0 && questions.every(q => q.isCorrect === true);
    if (!allCorrect) return;
    // Check current progress state directly to avoid stale closures
    const currentProgress = getTextProgress(topicId, textId);
    if (currentProgress.cards) return;
    setModeComplete(topicId, textId, "cards");
  }, [practiceState.cards, topicId, textId, setModeComplete, activeTextKey, textKey, flashcardsForText.length, getTextProgress]);

  useEffect(() => {
    if (activeTextKey !== textKey) return;
    const { sentenceStates, initialized } = practiceState.order;
    if (!initialized || !progress) return;
    const sentenceCount = Object.keys(sentenceStates).length;
    if (sentenceCount === 0) return;
    const allCorrect = Object.values(sentenceStates).every(s => s.validationState === "correct");
    if (allCorrect && !progress.order) {
      setModeComplete(topicId, textId, "order");
    }
  }, [practiceState.order, topicId, textId, setModeComplete, progress, activeTextKey, textKey]);
  
  const ttsMutation = useTTS();
  const translateMutation = useTranslate();
  const dictionaryMutation = useDictionary();
  const playAudio = async (text: string) => {
    try {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      const speed = slowMode ? 0.7 : 1.0;
      const blob = await ttsMutation.mutateAsync({ text, speed });
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.play();
      return audio;
    } catch (err) {
      console.error("Failed to play audio", err);
      return null;
    }
  };

  const handleInteraction = async (text: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedText(text);
    
    translateMutation.reset();
    dictionaryMutation.reset();
    
    playAudio(text);
    
    if (interactionMode === "word") {
      dictionaryMutation.mutate({ word: text });
    } else {
      translateMutation.mutate({ text });
    }
  };

  const handleReadAll = async () => {
    if (isReadingAll) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      setIsReadingAll(false);
      return;
    }

    setIsReadingAll(true);
    const fullText = paragraphs.join(" ");
    
    try {
      const audio = await playAudio(fullText);
      if (audio) {
        audio.onended = () => {
          setIsReadingAll(false);
        };
      }
    } catch (err) {
      setIsReadingAll(false);
    }
  };

  const closePanel = () => {
    setSelectedText(null);
    translateMutation.reset();
    dictionaryMutation.reset();
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 sm:px-8 pt-6 pb-4 border-b">
        <div className="max-w-4xl mx-auto">
          <div className="flex flex-col gap-1 mb-4">
            <p className="text-sm text-muted-foreground">{topicTitle}</p>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-serif font-semibold tracking-tight text-foreground">
                {title}
              </h1>
              {completionCount > 0 && (
                <div className="flex items-center gap-1">
                  {textComplete ? (
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                      <CheckCircle2 className="h-4 w-4" />
                      <span className="text-xs font-medium">Complete</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-muted">
                      <Progress value={completionPercentage} className="w-12 h-1.5" />
                      <span className="text-xs font-medium text-muted-foreground">{completionCount}/5</span>
                    </div>
                  )}
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-destructive"
                        title="Reset progress"
                        data-testid="button-reset-progress"
                      >
                        <Eraser className="h-3.5 w-3.5" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Reset Progress?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will clear all exercise progress for this text. You'll need to complete Fill, Order, and Write exercises again.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => {
                            resetTextProgress(topicId, textId);
                            resetPracticeState();
                          }}
                        >
                          Reset
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              )}
            </div>
          </div>
          
          <Tabs value={practiceMode} onValueChange={(v) => setPracticeMode(v as PracticeMode)}>
            <div className="flex gap-1 mb-1 px-1">
              <div className="flex-1 text-center">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Study</span>
              </div>
              <div className="flex-[4] text-center">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Practice</span>
              </div>
            </div>
            <div className="flex gap-1">
              <TabsList className="flex-1">
                <TabsTrigger value="read" data-testid="tab-read" className="gap-2 flex-1">
                  <BookOpen className="h-4 w-4" />
                  <span className="hidden sm:inline">Read</span>
                </TabsTrigger>
              </TabsList>
              <TabsList className="flex-[5] grid grid-cols-5">
                <TabsTrigger value="cards" data-testid="tab-cards" className="gap-1.5">
                  {progress.cards ? <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-500" /> : <Layers className="h-4 w-4" />}
                  <span className="hidden sm:inline">Cards</span>
                  {flashcardsForText.length > 0 && (
                    <span className="text-xs text-muted-foreground hidden sm:inline">({flashcardsForText.length})</span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="fill" data-testid="tab-fill" className="gap-1.5">
                  {progress.fill ? <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-500" /> : <Puzzle className="h-4 w-4" />}
                  <span className="hidden sm:inline">Fill</span>
                </TabsTrigger>
                <TabsTrigger value="order" data-testid="tab-order" className="gap-1.5">
                  {progress.order ? <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-500" /> : <ArrowUpDown className="h-4 w-4" />}
                  <span className="hidden sm:inline">Order</span>
                </TabsTrigger>
                <TabsTrigger value="write" data-testid="tab-write" className="gap-1.5">
                  {progress.write ? <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-500" /> : <PenLine className="h-4 w-4" />}
                  <span className="hidden sm:inline">Write</span>
                </TabsTrigger>
                <TabsTrigger value="speak" data-testid="tab-speak" className="gap-1.5">
                  {progress.speak ? <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-500" /> : <Mic className="h-4 w-4" />}
                  <span className="hidden sm:inline">Speak</span>
                </TabsTrigger>
              </TabsList>
            </div>
          </Tabs>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {practiceMode === "read" && (
          <div className="flex flex-col h-full">
            <div className="px-6 sm:px-8 py-4">
              <div className="max-w-4xl mx-auto">
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex bg-muted p-1 rounded-lg">
                    <button
                      onClick={() => setInteractionMode("word")}
                      data-testid="mode-word"
                      className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                        interactionMode === "word" 
                          ? "bg-background shadow-sm text-foreground" 
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Word
                    </button>
                    <button
                      onClick={() => setInteractionMode("sentence")}
                      data-testid="mode-sentence"
                      className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                        interactionMode === "sentence" 
                          ? "bg-background shadow-sm text-foreground" 
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Sentence
                    </button>
                  </div>

                  <div className="flex bg-muted p-1 rounded-lg">
                    <button
                      onClick={() => setSlowMode(false)}
                      data-testid="speed-normal"
                      className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                        !slowMode 
                          ? "bg-background shadow-sm text-foreground" 
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      1x
                    </button>
                    <button
                      onClick={() => setSlowMode(true)}
                      data-testid="speed-slow"
                      className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                        slowMode 
                          ? "bg-background shadow-sm text-foreground" 
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      0.7x
                    </button>
                  </div>

                  <Button 
                    variant="outline" 
                    onClick={handleReadAll}
                    disabled={ttsMutation.isPending && isReadingAll}
                    data-testid="button-read-all"
                  >
                    {isReadingAll ? (
                      <>
                        <StopCircle className="h-4 w-4 mr-2" />
                        Stop
                      </>
                    ) : (
                      <>
                        <PlayCircle className="h-4 w-4 mr-2" />
                        Read All
                      </>
                    )}
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground mt-3">
                  Click on {interactionMode === "word" ? "words" : "sentences"} to hear pronunciation and see {interactionMode === "word" ? "definitions" : "translations"}.
                </p>
              </div>
            </div>

            <ScrollArea className="flex-1 px-6 sm:px-8">
              <div className="max-w-4xl mx-auto pb-8">
                <div className="space-y-6 font-serif prose-text text-foreground/90 text-lg leading-relaxed select-none">
                  {paragraphs.map((para, i) => (
                    <Paragraph 
                      key={i} 
                      text={para} 
                      mode={interactionMode} 
                      onInteract={handleInteraction}
                      selectedText={selectedText}
                      flashcardWords={flashcardsForText.map(f => f.german)}
                    />
                  ))}
                </div>
              </div>
            </ScrollArea>

            {selectedText && (
              <div className="border-t bg-card animate-in slide-in-from-bottom-4">
                <div className="max-w-4xl mx-auto px-6 sm:px-8 py-4">
                  <div className="flex justify-between items-start gap-4 mb-3">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      {ttsMutation.isPending && <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0 mt-1" />}
                      <p className="font-serif text-base leading-relaxed break-words">
                        "{selectedText}"
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => playAudio(selectedText)}
                        disabled={ttsMutation.isPending}
                        data-testid="button-listen"
                      >
                        {ttsMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Volume2 className="h-4 w-4" />}
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-muted-foreground"
                        onClick={closePanel}
                        data-testid="button-close-panel"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <Separator className="my-3" />

                  <div className="min-h-[60px]">
                    {interactionMode === "word" && dictionaryMutation.isPending && (
                      <div className="flex items-center py-2 text-muted-foreground">
                        <Loader2 className="h-5 w-5 animate-spin mr-2" />
                        <span>Loading dictionary...</span>
                      </div>
                    )}

                    {interactionMode === "sentence" && selectedText && (
                      <div className="animate-in fade-in space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Translation</p>
                          {(() => {
                            const isSaved = hasSentence(selectedText, topicId, textId);
                            const savedSentence = isSaved ? getSentenceByGerman(selectedText, topicId, textId) : null;
                            return isSaved && savedSentence ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeSentence(savedSentence.id)}
                                data-testid="button-delete-sentence"
                                className="shrink-0 text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-1" />
                                Удалить
                              </Button>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  if (translateMutation.isSuccess && translateMutation.data) {
                                    addSentence(selectedText, translateMutation.data.translation, topicId, textId);
                                  }
                                }}
                                disabled={!translateMutation.isSuccess}
                                data-testid="button-save-sentence"
                                className="shrink-0"
                              >
                                {translateMutation.isPending ? (
                                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                ) : (
                                  <Bookmark className="h-4 w-4 mr-1" />
                                )}
                                Сохранить
                              </Button>
                            );
                          })()}
                        </div>
                        {translateMutation.isPending && (
                          <div className="flex items-center py-1 text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            <span>Перевод...</span>
                          </div>
                        )}
                        {translateMutation.isSuccess && (
                          <p className="text-base text-foreground">
                            {translateMutation.data.translation}
                          </p>
                        )}
                        {translateMutation.isError && (
                          <p className="text-sm text-destructive">Ошибка перевода. Попробуйте ещё раз.</p>
                        )}
                      </div>
                    )}

                    {dictionaryMutation.isSuccess && (
                      <div className="animate-in fade-in space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-baseline gap-2 flex-wrap">
                            <span className="font-bold">{dictionaryMutation.data.word}</span>
                            {dictionaryMutation.data.partOfSpeech && (
                              <span className="text-xs text-muted-foreground italic">{dictionaryMutation.data.partOfSpeech}</span>
                            )}
                            <span className="text-muted-foreground">—</span>
                            <span className="font-medium">{dictionaryMutation.data.translation}</span>
                          </div>
                          {(() => {
                            const isSaved = hasFlashcard(dictionaryMutation.data.word, topicId, textId);
                            const savedFlashcard = isSaved ? getFlashcardByGerman(dictionaryMutation.data.word, topicId, textId) : null;
                            return isSaved && savedFlashcard ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeFlashcard(savedFlashcard.id)}
                                data-testid="button-delete-flashcard"
                                className="shrink-0 text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-1" />
                                Delete
                              </Button>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  addFlashcard(
                                    dictionaryMutation.data.word,
                                    dictionaryMutation.data.translation,
                                    topicId,
                                    textId
                                  );
                                }}
                                data-testid="button-save-flashcard"
                                className="shrink-0"
                              >
                                <Bookmark className="h-4 w-4 mr-1" />
                                Save
                              </Button>
                            );
                          })()}
                        </div>
                        
                        {dictionaryMutation.data.definition && (
                          <p className="text-sm text-muted-foreground">{dictionaryMutation.data.definition}</p>
                        )}

                        {dictionaryMutation.data.example_de && (
                          <p className="text-sm italic text-muted-foreground">"{dictionaryMutation.data.example_de}"</p>
                        )}
                      </div>
                    )}
                    
                    {dictionaryMutation.isError && (
                      <p className="text-sm text-destructive">Could not find definition.</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {practiceMode === "cards" && (
          <CardsMode 
            flashcards={flashcardsForText}
            state={practiceState.cards}
            onStateChange={updateCardsState}
            onResetProgress={() => resetModeProgress(topicId, textId, "cards")}
            topicId={topicId}
            textId={textId}
          />
        )}
        {practiceMode === "fill" && (
          <FillMode 
            paragraphs={paragraphs}
            flashcardWords={flashcardsForText.map(f => f.german)}
            state={practiceState.fill}
            onStateChange={updateFillState}
            onResetProgress={() => resetModeProgress(topicId, textId, "fill")}
            isCompleted={progress.fill}
          />
        )}
        {practiceMode === "order" && (
          <OrderMode 
            sentences={savedSentencesForText}
            state={practiceState.order}
            onStateChange={updateOrderState}
            onResetProgress={() => resetModeProgress(topicId, textId, "order")}
            isCompleted={progress.order}
          />
        )}
        {practiceMode === "write" && (
          <WriteMode 
            paragraphs={paragraphs}
            flashcardWords={flashcardsForText.map(f => f.german)}
            state={practiceState.write}
            onStateChange={updateWriteState}
            onResetProgress={() => resetModeProgress(topicId, textId, "write")}
            isCompleted={progress.write}
          />
        )}
        {practiceMode === "speak" && (
          <SpeakMode 
            sentences={eligibleSentences}
            topicId={topicId}
            textId={textId}
            onComplete={() => setModeComplete(topicId, textId, "speak")}
            onResetProgress={() => resetModeProgress(topicId, textId, "speak")}
            isCompleted={progress.speak}
          />
        )}
      </div>
    </div>
  );
}

function Paragraph({ 
  text, 
  mode, 
  onInteract, 
  selectedText,
  flashcardWords = []
}: { 
  text: string, 
  mode: InteractionMode, 
  onInteract: (t: string, e: React.MouseEvent) => void,
  selectedText: string | null,
  flashcardWords?: string[]
}) {
  const flashcardSet = new Set(flashcardWords.map(w => w.toLowerCase()));
  
  const sentenceContainsFlashcard = (sentence: string): boolean => {
    if (flashcardWords.length === 0) return false;
    const normalizedSentence = sentence.toLowerCase();
    return flashcardWords.some(word => {
      const regex = new RegExp(`\\b${word.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      return regex.test(normalizedSentence);
    });
  };
  
  if (mode === "sentence") {
    const sentences = text.match(/[^.!?]+[.!?]+["']?|[^.!?]+$/g) || [text];
    return (
      <p>
        {sentences.map((sentence, idx) => {
          const trimmedSentence = sentence.trim();
          const hasFlashcardWord = sentenceContainsFlashcard(trimmedSentence);
          return (
            <span 
              key={idx}
              onClick={(e) => onInteract(trimmedSentence, e)}
              data-testid={`sentence-${idx}`}
              className={`reader-highlight py-0.5 rounded cursor-pointer ${selectedText === trimmedSentence ? 'active' : ''} ${hasFlashcardWord ? 'eligible-sentence' : ''}`}
            >
              {sentence}
            </span>
          );
        })}
      </p>
    );
  }

  const words = text.split(/(\s+)/);
  return (
    <p>
      {words.map((word, idx) => {
        if (word.trim().length === 0) return <span key={idx}>{word}</span>;
        
        const cleanWord = word.replace(/[.,/#!$%^&*;:{}=\-_`~()«»„"]/g, "");
        if (!cleanWord) return <span key={idx}>{word}</span>;

        const isFlashcard = flashcardSet.has(cleanWord.toLowerCase());

        return (
          <span 
            key={idx}
            onClick={(e) => onInteract(cleanWord, e)}
            data-testid={`word-${idx}`}
            className={`reader-highlight py-0.5 rounded cursor-pointer ${selectedText === cleanWord ? 'active' : ''} ${isFlashcard ? 'flashcard-word' : ''}`}
          >
            {word}
          </span>
        );
      })}
    </p>
  );
}
