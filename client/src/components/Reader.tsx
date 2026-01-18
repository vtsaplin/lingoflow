import { useState, useRef } from "react";
import { Volume2, Loader2, PlayCircle, StopCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useTTS, useTranslate, useDictionary } from "@/hooks/use-services";

type Mode = "word" | "sentence";

interface ReaderProps {
  topicTitle: string;
  title: string;
  paragraphs: string[];
}

export function Reader({ topicTitle, title, paragraphs }: ReaderProps) {
  const [mode, setMode] = useState<Mode>("sentence");
  const [selectedText, setSelectedText] = useState<string | null>(null);
  const [isReadingAll, setIsReadingAll] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  const ttsMutation = useTTS();
  const translateMutation = useTranslate();
  const dictionaryMutation = useDictionary();

  const playAudio = async (text: string) => {
    try {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      const blob = await ttsMutation.mutateAsync({ text });
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
    
    if (mode === "word") {
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
      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="px-6 sm:px-8 pt-8 pb-4">
          <div className="max-w-3xl mx-auto">
            <div className="flex flex-col gap-4 mb-6">
              <div className="flex flex-col gap-1">
                <p className="text-sm text-muted-foreground">{topicTitle}</p>
                <h1 className="text-2xl sm:text-3xl font-serif font-semibold tracking-tight text-foreground">
                  {title}
                </h1>
              </div>
              
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex bg-muted p-1 rounded-lg">
                  <button
                    onClick={() => setMode("word")}
                    data-testid="mode-word"
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                      mode === "word" 
                        ? "bg-background shadow-sm text-foreground" 
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Word
                  </button>
                  <button
                    onClick={() => setMode("sentence")}
                    data-testid="mode-sentence"
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                      mode === "sentence" 
                        ? "bg-background shadow-sm text-foreground" 
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Sentence
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
            </div>
          </div>
        </div>

        <ScrollArea className="flex-1 px-6 sm:px-8">
          <div className="max-w-3xl mx-auto pb-8">
            <div className="space-y-6 font-serif prose-text text-foreground/90 text-lg leading-relaxed">
              {paragraphs.map((para, i) => (
                <Paragraph 
                  key={i} 
                  text={para} 
                  mode={mode} 
                  onInteract={handleInteraction}
                  selectedText={selectedText}
                />
              ))}
            </div>
          </div>
        </ScrollArea>
      </div>

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
                  <span>{mode === "word" ? "Loading dictionary..." : "Translating..."}</span>
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
                <div className="space-y-3 animate-in fade-in">
                  <div>
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <p className="text-lg font-bold">{dictionaryMutation.data.word}</p>
                      {dictionaryMutation.data.partOfSpeech && (
                        <span className="text-xs text-muted-foreground italic">{dictionaryMutation.data.partOfSpeech}</span>
                      )}
                    </div>
                    <p className="text-foreground mt-1 font-medium">{dictionaryMutation.data.translation}</p>
                  </div>
                  
                  {dictionaryMutation.data.definition && (
                    <div className="bg-muted/30 p-2 rounded text-sm">
                      {dictionaryMutation.data.definition}
                    </div>
                  )}

                  {(dictionaryMutation.data.example_de || dictionaryMutation.data.example_ru) && (
                    <div className="text-sm space-y-1 pt-1">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Example</p>
                      {dictionaryMutation.data.example_de && <p className="italic text-muted-foreground">"{dictionaryMutation.data.example_de}"</p>}
                      {dictionaryMutation.data.example_ru && <p>"{dictionaryMutation.data.example_ru}"</p>}
                    </div>
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
  );
}

function Paragraph({ 
  text, 
  mode, 
  onInteract, 
  selectedText 
}: { 
  text: string, 
  mode: Mode, 
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
