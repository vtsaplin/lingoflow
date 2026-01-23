import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { Volume2, Mic, MicOff, RotateCcw, ArrowRight, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { useTTS } from "@/hooks/use-services";
import { api } from "@shared/routes";

interface SpeakModeProps {
  sentences: string[];
  topicId: string;
  textId: string;
  onComplete?: () => void;
  onResetProgress?: () => void;
  isCompleted?: boolean;
}

type SentenceState = "listening" | "recording" | "processing" | "result";

interface ComparisonResult {
  expected: string;
  actual: string;
  isCorrect: boolean;
  wordResults: { word: string; correct: boolean }[];
}

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[.,!?;:"""''„‚«»\-–—]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function compareTexts(expected: string, actual: string): ComparisonResult {
  const normalizedExpected = normalizeText(expected);
  const normalizedActual = normalizeText(actual);
  
  const expectedWords = normalizedExpected.split(" ");
  const actualWords = normalizedActual.split(" ");
  
  const wordResults = expectedWords.map((word, i) => ({
    word,
    correct: actualWords[i]?.toLowerCase() === word.toLowerCase(),
  }));
  
  const isCorrect = normalizedExpected === normalizedActual;
  
  return { expected, actual, isCorrect, wordResults };
}

export function SpeakMode({ sentences, topicId, textId, onComplete, onResetProgress, isCompleted }: SpeakModeProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [state, setState] = useState<SentenceState>("listening");
  const [comparison, setComparison] = useState<ComparisonResult | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [shouldAutoPlay, setShouldAutoPlay] = useState(true);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);
  const processingRef = useRef(false);
  
  const ttsMutation = useTTS();
  
  const currentSentence = sentences[currentIndex] || "";
  const progressValue = sentences.length > 0 ? ((currentIndex) / sentences.length) * 100 : 0;

  const stopCurrentAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  const stopCurrentRecording = useCallback(() => {
    if (mediaRecorderRef.current) {
      try {
        mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
      } catch {}
      mediaRecorderRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    processingRef.current = false;
    setIsRecording(false);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stopCurrentAudio();
      stopCurrentRecording();
    };
  }, [stopCurrentAudio, stopCurrentRecording]);

  const playCurrentSentence = useCallback(async () => {
    if (!currentSentence || isPlaying) return;
    
    stopCurrentAudio();
    
    try {
      setIsPlaying(true);
      setError(null);
      const blob = await ttsMutation.mutateAsync({ text: currentSentence });
      
      if (!mountedRef.current) return;
      
      const url = URL.createObjectURL(blob);
      audioUrlRef.current = url;
      const audio = new Audio(url);
      audioRef.current = audio;
      
      audio.onended = () => {
        if (mountedRef.current) {
          setIsPlaying(false);
        }
      };
      
      audio.onerror = () => {
        if (mountedRef.current) {
          setIsPlaying(false);
          setError("Playback error");
        }
      };
      
      await audio.play();
    } catch (err) {
      if (!mountedRef.current) return;
      setIsPlaying(false);
      setError("Speech synthesis error");
      console.error("TTS error:", err);
    }
  }, [currentSentence, isPlaying, stopCurrentAudio, ttsMutation]);

  useEffect(() => {
    if (state === "listening" && currentSentence && shouldAutoPlay) {
      playCurrentSentence();
      setShouldAutoPlay(false);
    }
  }, [state, currentSentence, shouldAutoPlay, playCurrentSentence]);

  const startRecording = async () => {
    if (isRecording || processingRef.current || mediaRecorderRef.current) return;
    
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      if (!mountedRef.current) {
        stream.getTracks().forEach(t => t.stop());
        return;
      }
      
      const recorder = new MediaRecorder(stream, {
        mimeType: "audio/webm;codecs=opus",
      });
      
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        if (!mountedRef.current) return;
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        await processRecording(blob);
      };
      
      recorder.start(100);
      setIsRecording(true);
      setState("recording");
    } catch (err) {
      setError("Could not access microphone");
      console.error("Microphone error:", err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setState("processing");
    }
  };

  const processRecording = async (blob: Blob) => {
    if (processingRef.current || !mountedRef.current) return;
    processingRef.current = true;
    
    try {
      const reader = new FileReader();
      const base64Audio = await new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(",")[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      if (!mountedRef.current) return;

      const controller = new AbortController();
      abortControllerRef.current = controller;

      const validated = api.services.transcribe.input.parse({ audio: base64Audio });
      const response = await fetch(api.services.transcribe.path, {
        method: api.services.transcribe.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
        signal: controller.signal,
      });

      if (!mountedRef.current) return;

      if (!response.ok) {
        throw new Error("Transcription failed");
      }

      const data = api.services.transcribe.responses[200].parse(await response.json());
      
      if (!mountedRef.current) return;
      
      const result = compareTexts(currentSentence, data.transcript);
      setComparison(result);
      setState("result");
    } catch (err) {
      if (!mountedRef.current) return;
      if ((err as Error).name === "AbortError") return;
      setError("Speech recognition error");
      console.error("Transcription error:", err);
      setState("listening");
    } finally {
      processingRef.current = false;
      abortControllerRef.current = null;
    }
  };

  const nextSentence = () => {
    if (currentIndex < sentences.length - 1) {
      stopCurrentAudio();
      setCurrentIndex(currentIndex + 1);
      setComparison(null);
      setShouldAutoPlay(true);
      setState("listening");
    }
  };

  const resetCurrent = () => {
    stopCurrentAudio();
    setComparison(null);
    setShouldAutoPlay(true);
    setState("listening");
  };

  if (sentences.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
        <Mic className="h-12 w-12 mb-4 opacity-50" />
        <p className="text-lg font-medium">No sentences for practice</p>
        <p className="text-sm mt-2">Save words to flashcards in reading mode</p>
      </div>
    );
  }

  const isComplete = currentIndex >= sentences.length - 1 && state === "result";

  useEffect(() => {
    if (isComplete && !isCompleted && onComplete) {
      onComplete();
    }
  }, [isComplete, isCompleted, onComplete]);

  const handleReset = () => {
    setCurrentIndex(0);
    setComparison(null);
    setShouldAutoPlay(true);
    setState("listening");
    if (onResetProgress) {
      onResetProgress();
    }
  };

  return (
    <div className="flex flex-col gap-6 p-4 max-w-2xl mx-auto">
      <div className="flex items-center gap-4">
        <span className="text-sm text-muted-foreground">
          Sentence {currentIndex + 1} of {sentences.length}
        </span>
        <Progress value={progressValue} className="flex-1" />
      </div>

      <Card className="bg-card">
        <CardContent className="p-6">
          <div className="flex items-start gap-4 mb-6">
            <Button
              variant="outline"
              size="icon"
              onClick={playCurrentSentence}
              disabled={isPlaying}
              data-testid="button-play-sentence"
            >
              <Volume2 className="h-4 w-4" />
            </Button>
            <p className="text-xl leading-relaxed flex-1">{currentSentence}</p>
          </div>

          {state === "listening" && (
            <div className="flex flex-col items-center gap-4">
              <p className="text-muted-foreground">Listen to the sentence and click to record</p>
              <Button
                size="lg"
                onClick={startRecording}
                disabled={isPlaying}
                data-testid="button-start-recording"
              >
                <Mic className="h-5 w-5 mr-2" />
                Start Recording
              </Button>
            </div>
          )}

          {state === "recording" && (
            <div className="flex flex-col items-center gap-4">
              <div className="flex items-center gap-2 text-red-500">
                <span className="animate-pulse">●</span>
                <span>Recording...</span>
              </div>
              <Button
                size="lg"
                variant="destructive"
                onClick={stopRecording}
                data-testid="button-stop-recording"
              >
                <MicOff className="h-5 w-5 mr-2" />
                Stop
              </Button>
            </div>
          )}

          {state === "processing" && (
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-muted-foreground">Recognizing speech...</p>
            </div>
          )}

          {state === "result" && comparison && (
            <div className="space-y-4">
              <div className={`flex items-center gap-2 ${comparison.isCorrect ? "text-green-600" : "text-amber-600"}`}>
                {comparison.isCorrect ? (
                  <>
                    <CheckCircle2 className="h-5 w-5" />
                    <span className="font-medium">Excellent!</span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-5 w-5" />
                    <span className="font-medium">Try again</span>
                  </>
                )}
              </div>

              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Your answer:</p>
                <p className="text-lg">
                  {comparison.wordResults.map((wr, i) => (
                    <span
                      key={i}
                      className={wr.correct ? "text-green-600" : "text-red-500 underline decoration-wavy"}
                    >
                      {wr.word}{" "}
                    </span>
                  ))}
                </p>
                {comparison.actual && (
                  <p className="text-sm text-muted-foreground italic">"{comparison.actual}"</p>
                )}
              </div>

              <div className="flex gap-2 pt-4">
                <Button variant="outline" onClick={resetCurrent} data-testid="button-retry">
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Retry
                </Button>
                {!isComplete && (
                  <Button onClick={nextSentence} data-testid="button-next">
                    Next
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                )}
                {isComplete && (
                  <>
                    <Button variant="default" disabled>
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Complete
                    </Button>
                    <Button variant="outline" onClick={handleReset} data-testid="button-reset-speak">
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Start Over
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}

          {error && (
            <p className="text-red-500 text-center mt-4">{error}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
