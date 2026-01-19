import { useState, useRef, useEffect, useCallback } from "react";
import { Volume2, Loader2, PlayCircle, StopCircle, X, BookOpen, Puzzle, ArrowUpDown, PenLine, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { useTTS, useTranslate, useDictionary } from "@/hooks/use-services";
import { usePracticeProgress } from "@/hooks/use-practice-progress";
import { FillMode } from "@/components/practice/FillMode";
import { OrderMode } from "@/components/practice/OrderMode";
import { WriteMode } from "@/components/practice/WriteMode";
import { createInitialPracticeState, type PracticeState, type FillModeState, type OrderModeState, type WriteModeState } from "@/components/practice/types";

type InteractionMode = "word" | "sentence";
type PracticeMode = "read" | "fill" | "order" | "write";

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
  
  const [practiceState, setPracticeState] = useState<PracticeState>(createInitialPracticeState);
  const currentTextKey = useRef(`${topicId}-${textId}`);
  
  const { setModeComplete, getCompletionCount, isTextComplete, getTextProgress } = usePracticeProgress();
  const completionCount = getCompletionCount(topicId, textId);
  const completionPercentage = Math.round((completionCount / 3) * 100);
  const textComplete = isTextComplete(topicId, textId);
  const progress = getTextProgress(topicId, textId);

  useEffect(() => {
    const newKey = `${topicId}-${textId}`;
    if (currentTextKey.current !== newKey) {
      currentTextKey.current = newKey;
      setPracticeState(createInitialPracticeState());
    }
  }, [topicId, textId]);

  useEffect(() => {
    if (practiceState.fill.validationState === "correct" && !progress.fill) {
      setModeComplete(topicId, textId, "fill");
    }
  }, [practiceState.fill.validationState, topicId, textId, setModeComplete, progress.fill]);

  useEffect(() => {
    if (practiceState.write.validationState === "correct" && !progress.write) {
      setModeComplete(topicId, textId, "write");
    }
  }, [practiceState.write.validationState, topicId, textId, setModeComplete, progress.write]);

  useEffect(() => {
    const { sentenceStates, initialized } = practiceState.order;
    if (!initialized || !progress) return;
    const sentenceCount = Object.keys(sentenceStates).length;
    if (sentenceCount === 0) return;
    const allCorrect = Object.values(sentenceStates).every(s => s.validationState === "correct");
    if (allCorrect && !progress.order) {
      setModeComplete(topicId, textId, "order");
    }
  }, [practiceState.order, topicId, textId, setModeComplete, progress]);
  
  const ttsMutation = useTTS();
  const translateMutation = useTranslate();
  const dictionaryMutation = useDictionary();

  const updateFillState = useCallback((newState: FillModeState) => {
    setPracticeState(prev => ({ ...prev, fill: newState }));
  }, []);

  const updateOrderState = useCallback((newState: OrderModeState) => {
    setPracticeState(prev => ({ ...prev, order: newState }));
  }, []);

  const updateWriteState = useCallback((newState: WriteModeState) => {
    setPracticeState(prev => ({ ...prev, write: newState }));
  }, []);

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
        <div className="max-w-3xl mx-auto">
          <div className="flex flex-col gap-1 mb-4">
            <p className="text-sm text-muted-foreground">{topicTitle}</p>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-serif font-semibold tracking-tight text-foreground">
                {title}
              </h1>
              {completionCount > 0 && (
                <div className="flex items-center gap-2">
                  {textComplete ? (
                    <div className="flex items-center gap-1.5 text-green-600 dark:text-green-500">
                      <CheckCircle2 className="h-5 w-5" />
                      <span className="text-sm font-medium">Complete</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Progress value={completionPercentage} className="w-20 h-2" />
                      <span className="text-sm text-muted-foreground">{completionCount}/3</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          
          <Tabs value={practiceMode} onValueChange={(v) => setPracticeMode(v as PracticeMode)}>
            <div className="flex items-center gap-4 mb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Study</span>
              </div>
              <div className="flex-1 flex items-center gap-2">
                <div className="w-px h-4 bg-border" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Practice</span>
              </div>
            </div>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="read" data-testid="tab-study" className="gap-2">
                <BookOpen className="h-4 w-4" />
                <span className="hidden sm:inline">Study</span>
              </TabsTrigger>
              <TabsTrigger value="fill" data-testid="tab-fill" className="gap-2 relative">
                <Puzzle className="h-4 w-4" />
                <span className="hidden sm:inline">Fill</span>
                {progress.fill && <CheckCircle2 className="h-3 w-3 text-green-600 dark:text-green-500 absolute -top-1 -right-1" />}
              </TabsTrigger>
              <TabsTrigger value="order" data-testid="tab-order" className="gap-2 relative">
                <ArrowUpDown className="h-4 w-4" />
                <span className="hidden sm:inline">Order</span>
                {progress.order && <CheckCircle2 className="h-3 w-3 text-green-600 dark:text-green-500 absolute -top-1 -right-1" />}
              </TabsTrigger>
              <TabsTrigger value="write" data-testid="tab-write" className="gap-2 relative">
                <PenLine className="h-4 w-4" />
                <span className="hidden sm:inline">Write</span>
                {progress.write && <CheckCircle2 className="h-3 w-3 text-green-600 dark:text-green-500 absolute -top-1 -right-1" />}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {practiceMode === "read" && (
          <div className="flex flex-col h-full">
            <div className="px-6 sm:px-8 py-4">
              <div className="max-w-3xl mx-auto">
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
              <div className="max-w-3xl mx-auto pb-8">
                <div className="space-y-6 font-serif prose-text text-foreground/90 text-lg leading-relaxed">
                  {paragraphs.map((para, i) => (
                    <Paragraph 
                      key={i} 
                      text={para} 
                      mode={interactionMode} 
                      onInteract={handleInteraction}
                      selectedText={selectedText}
                    />
                  ))}
                </div>
              </div>
            </ScrollArea>

            {selectedText && (
              <div className="border-t bg-card animate-in slide-in-from-bottom-4">
                <div className="max-w-3xl mx-auto px-6 sm:px-8 py-4">
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
                    {(translateMutation.isPending || dictionaryMutation.isPending) && (
                      <div className="flex items-center py-2 text-muted-foreground">
                        <Loader2 className="h-5 w-5 animate-spin mr-2" />
                        <span>{interactionMode === "word" ? "Loading dictionary..." : "Translating..."}</span>
                      </div>
                    )}

                    {translateMutation.isSuccess && (
                      <div className="animate-in fade-in">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Translation</p>
                        <p className="text-base text-foreground">
                          {translateMutation.data.translation}
                        </p>
                      </div>
                    )}

                    {dictionaryMutation.isSuccess && (
                      <div className="animate-in fade-in space-y-2">
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <span className="font-bold">{dictionaryMutation.data.word}</span>
                          {dictionaryMutation.data.partOfSpeech && (
                            <span className="text-xs text-muted-foreground italic">{dictionaryMutation.data.partOfSpeech}</span>
                          )}
                          <span className="text-muted-foreground">—</span>
                          <span className="font-medium">{dictionaryMutation.data.translation}</span>
                        </div>
                        
                        {dictionaryMutation.data.definition && (
                          <p className="text-sm text-muted-foreground">{dictionaryMutation.data.definition}</p>
                        )}

                        {dictionaryMutation.data.example_de && (
                          <p className="text-sm italic text-muted-foreground">"{dictionaryMutation.data.example_de}"</p>
                        )}
                      </div>
                    )}
                    
                    {translateMutation.isError && (
                      <p className="text-sm text-destructive">Translation failed. Please try again.</p>
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

        {practiceMode === "fill" && (
          <FillMode 
            paragraphs={paragraphs} 
            state={practiceState.fill}
            onStateChange={updateFillState}
          />
        )}
        {practiceMode === "order" && (
          <OrderMode 
            paragraphs={paragraphs} 
            state={practiceState.order}
            onStateChange={updateOrderState}
          />
        )}
        {practiceMode === "write" && (
          <WriteMode 
            paragraphs={paragraphs} 
            state={practiceState.write}
            onStateChange={updateWriteState}
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
  selectedText 
}: { 
  text: string, 
  mode: InteractionMode, 
  onInteract: (t: string, e: React.MouseEvent) => void,
  selectedText: string | null
}) {
  if (mode === "sentence") {
    const sentences = text.match(/[^.!?]+[.!?]+["']?|[^.!?]+$/g) || [text];
    return (
      <p>
        {sentences.map((sentence, idx) => (
          <span 
            key={idx}
            onClick={(e) => onInteract(sentence.trim(), e)}
            data-testid={`sentence-${idx}`}
            className={`reader-highlight px-1 mx-[-2px] py-0.5 rounded cursor-pointer ${selectedText === sentence.trim() ? 'active' : ''}`}
          >
            {sentence}
          </span>
        ))}
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

        return (
          <span 
            key={idx}
            onClick={(e) => onInteract(cleanWord, e)}
            data-testid={`word-${idx}`}
            className={`reader-highlight px-0.5 py-0.5 rounded cursor-pointer ${selectedText === cleanWord ? 'active' : ''}`}
          >
            {word}
          </span>
        );
      })}
    </p>
  );
}
