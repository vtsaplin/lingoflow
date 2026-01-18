import React, { useState, useRef, useEffect } from "react";
import { Volume2, Languages, Book, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { useTTS, useTranslate, useDictionary } from "@/hooks/use-services";

type Mode = "word" | "sentence";

interface ReaderProps {
  title: string;
  paragraphs: string[];
}

export function Reader({ title, paragraphs }: ReaderProps) {
  const [mode, setMode] = useState<Mode>("sentence");
  const [selectedText, setSelectedText] = useState<string | null>(null);
  const [popoverPosition, setPopoverPosition] = useState<{ x: number; y: number } | null>(null);
  
  const ttsMutation = useTTS();
  const translateMutation = useTranslate();
  const dictionaryMutation = useDictionary();

  // Helper to play audio
  const playAudio = async (text: string) => {
    try {
      const blob = await ttsMutation.mutateAsync({ text });
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.play();
    } catch (err) {
      console.error("Failed to play audio", err);
    }
  };

  const handleInteraction = (text: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedText(text);
    
    // Reset mutations
    translateMutation.reset();
    dictionaryMutation.reset();
    
    // Auto-trigger appropriate action based on mode
    if (mode === "word") {
      dictionaryMutation.mutate({ word: text });
    } else {
      translateMutation.mutate({ text });
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-12 px-6 sm:px-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl sm:text-4xl font-serif font-semibold tracking-tight text-foreground">
          {title}
        </h1>
        
        <div className="flex bg-muted p-1 rounded-lg">
          <button
            onClick={() => setMode("word")}
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
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
              mode === "sentence" 
                ? "bg-background shadow-sm text-foreground" 
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Sentence
          </button>
        </div>
      </div>

      <div className="space-y-6 font-serif prose-text text-foreground/90">
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

      {/* Floating Action Menu / Results Display */}
      {selectedText && (
        <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-4">
          <div className="bg-card border shadow-xl rounded-xl p-4 w-80 sm:w-96">
            <div className="flex justify-between items-start mb-4">
              <h3 className="font-serif text-lg font-medium leading-tight line-clamp-2 pr-4">
                "{selectedText}"
              </h3>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 -mr-2 -mt-2 text-muted-foreground"
                onClick={() => setSelectedText(null)}
              >
                &times;
              </Button>
            </div>

            <div className="flex gap-2 mb-4">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => playAudio(selectedText)}
                disabled={ttsMutation.isPending}
                className="flex-1"
              >
                {ttsMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Volume2 className="h-4 w-4 mr-2" />}
                Listen
              </Button>
              
              {mode === "sentence" && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => translateMutation.mutate({ text: selectedText })}
                  disabled={translateMutation.isPending}
                  className={`flex-1 ${translateMutation.isSuccess ? 'bg-primary/5 border-primary/20' : ''}`}
                >
                  <Languages className="h-4 w-4 mr-2" />
                  Translate
                </Button>
              )}

              {mode === "word" && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => dictionaryMutation.mutate({ word: selectedText })}
                  disabled={dictionaryMutation.isPending}
                  className={`flex-1 ${dictionaryMutation.isSuccess ? 'bg-primary/5 border-primary/20' : ''}`}
                >
                  <Book className="h-4 w-4 mr-2" />
                  Define
                </Button>
              )}
            </div>

            <Separator className="my-4" />

            {/* Results Area */}
            <div className="min-h-[60px]">
              {translateMutation.isPending || dictionaryMutation.isPending ? (
                <div className="flex items-center justify-center py-4 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  <span>Fetching...</span>
                </div>
              ) : null}

              {translateMutation.isSuccess && (
                <div className="animate-in fade-in">
                  <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider text-[10px] mb-1">Translation</p>
                  <p className="text-base text-foreground font-medium">
                    {translateMutation.data.translation}
                  </p>
                </div>
              )}

              {dictionaryMutation.isSuccess && (
                <div className="space-y-3 animate-in fade-in">
                  <div>
                    <div className="flex items-baseline gap-2">
                      <p className="text-lg font-bold">{dictionaryMutation.data.word}</p>
                      {dictionaryMutation.data.partOfSpeech && (
                        <span className="text-xs text-muted-foreground italic">{dictionaryMutation.data.partOfSpeech}</span>
                      )}
                    </div>
                    <p className="text-foreground mt-1">{dictionaryMutation.data.translation}</p>
                  </div>
                  
                  {dictionaryMutation.data.definition && (
                    <div className="bg-muted/30 p-2 rounded text-sm">
                      {dictionaryMutation.data.definition}
                    </div>
                  )}

                  {(dictionaryMutation.data.example_de || dictionaryMutation.data.example_ru) && (
                    <div className="text-sm space-y-1 pt-1">
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

// Sub-component to handle text segmentation
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
    // Simple sentence splitting (heuristic)
    const sentences = text.match(/[^.!?]+[.!?]+["']?|[^.!?]+$/g) || [text];
    return (
      <p>
        {sentences.map((sentence, idx) => (
          <span 
            key={idx}
            onClick={(e) => onInteract(sentence.trim(), e)}
            className={`reader-highlight px-1 mx-[-2px] py-0.5 rounded ${selectedText === sentence.trim() ? 'active' : ''}`}
          >
            {sentence}
          </span>
        ))}
      </p>
    );
  }

  // Word mode
  const words = text.split(/(\s+)/); // Keep spaces
  return (
    <p>
      {words.map((word, idx) => {
        // Only highlight actual words, not whitespace
        if (word.trim().length === 0) return <span key={idx}>{word}</span>;
        
        // Skip punctuation-only tokens if desired, but for now keep it simple
        const cleanWord = word.replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, "");
        if (!cleanWord) return <span key={idx}>{word}</span>;

        return (
          <span 
            key={idx}
            onClick={(e) => onInteract(cleanWord, e)}
            className={`reader-highlight px-0.5 py-0.5 rounded ${selectedText === cleanWord ? 'active' : ''}`}
          >
            {word}
          </span>
        );
      })}
    </p>
  );
}
