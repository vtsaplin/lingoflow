import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Volume2, Mic, MicOff, RotateCcw, ArrowRight, CheckCircle2, XCircle, Loader2, MessageCircle, HelpCircle } from "lucide-react";
import { useTTS } from "@/hooks/use-services";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface SpeakModeProps {
  sentences: string[];
  topicId: string;
  textId: string;
  textContent: string;
  topicTitle: string;
  onComplete?: () => void;
  onResetProgress?: () => void;
  isCompleted?: boolean;
}

type DialogueState = "loading" | "error" | "listening" | "recording" | "processing" | "evaluating" | "result";

const TOTAL_QUESTIONS = 5;

interface DialogueQuestion {
  question: string;
  context: string;
  expectedTopics: string[];
}

interface EvaluationResult {
  isAppropriate: boolean;
  feedback: string;
  suggestedResponse?: string;
}

export function SpeakMode({ 
  textContent, 
  topicTitle, 
  onComplete, 
  onResetProgress, 
  isCompleted 
}: SpeakModeProps) {
  const [currentQuestion, setCurrentQuestion] = useState<DialogueQuestion | null>(null);
  const [questionNumber, setQuestionNumber] = useState(1);
  const [state, setState] = useState<DialogueState>("loading");
  const [evaluation, setEvaluation] = useState<EvaluationResult | null>(null);
  const [userTranscript, setUserTranscript] = useState<string>("");
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [shouldAutoPlay, setShouldAutoPlay] = useState(true);
  const [previousQuestions, setPreviousQuestions] = useState<string[]>([]);
  const [showHint, setShowHint] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);
  const processingRef = useRef(false);
  
  const ttsMutation = useTTS();

  const generateQuestionMutation = useMutation({
    mutationFn: async ({ textContent, topicTitle, previousQuestions }: { 
      textContent: string; 
      topicTitle: string;
      previousQuestions: string[];
    }) => {
      const response = await apiRequest("POST", "/api/generate-dialogue", {
        textContent,
        topicTitle,
        questionCount: 1,
        previousQuestions
      });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.questions && Array.isArray(data.questions) && data.questions.length > 0) {
        setCurrentQuestion(data.questions[0]);
        setError(null);
        setState("listening");
        setShouldAutoPlay(true);
      } else {
        setError("Could not generate a question");
        setState("error");
      }
    },
    onError: () => {
      setError("Failed to generate question");
      setState("error");
    }
  });

  const evaluateResponseMutation = useMutation({
    mutationFn: async ({ question, userResponse, expectedTopics }: { 
      question: string; 
      userResponse: string; 
      expectedTopics: string[] 
    }) => {
      const response = await apiRequest("POST", "/api/evaluate-response", {
        question,
        userResponse,
        expectedTopics
      });
      return response.json();
    }
  });

  const loadQuestion = useCallback(() => {
    if (textContent && topicTitle && !generateQuestionMutation.isPending) {
      setError(null);
      setState("loading");
      generateQuestionMutation.mutate({ textContent, topicTitle, previousQuestions });
    }
  }, [textContent, topicTitle, previousQuestions, generateQuestionMutation]);

  useEffect(() => {
    if (textContent && topicTitle && state === "loading" && !currentQuestion && !generateQuestionMutation.isPending) {
      generateQuestionMutation.mutate({ textContent, topicTitle, previousQuestions: [] });
    }
  }, [textContent, topicTitle, state, currentQuestion, generateQuestionMutation]);

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

  const playCurrentQuestion = useCallback(async () => {
    if (!currentQuestion || isPlaying) return;
    
    stopCurrentAudio();
    
    try {
      setIsPlaying(true);
      setError(null);
      const blob = await ttsMutation.mutateAsync({ text: currentQuestion.question });
      
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
  }, [currentQuestion, isPlaying, stopCurrentAudio, ttsMutation]);

  useEffect(() => {
    if (state === "listening" && currentQuestion && shouldAutoPlay) {
      playCurrentQuestion();
      setShouldAutoPlay(false);
    }
  }, [state, currentQuestion, shouldAutoPlay, playCurrentQuestion]);

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
        mediaRecorderRef.current = null;
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
    if (processingRef.current || !mountedRef.current || !currentQuestion) return;
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

      const response = await fetch("/api/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audio: base64Audio }),
        signal: controller.signal,
      });

      if (!mountedRef.current) return;

      if (!response.ok) {
        throw new Error("Transcription failed");
      }

      const data = await response.json();
      const transcript = data?.transcript || "";
      
      if (!mountedRef.current) return;
      
      if (!transcript || transcript.trim() === "") {
        setError("Could not recognize speech. Please try again.");
        setState("listening");
        return;
      }
      
      setUserTranscript(transcript);
      setState("evaluating");
      
      try {
        const evalResult = await evaluateResponseMutation.mutateAsync({
          question: currentQuestion.question,
          userResponse: transcript,
          expectedTopics: currentQuestion.expectedTopics || []
        });
        
        if (!mountedRef.current) return;
        
        if (evalResult && typeof evalResult.isAppropriate === "boolean") {
          setEvaluation(evalResult);
          setState("result");
        } else {
          setError("Could not evaluate response. Please try again.");
          setState("listening");
        }
      } catch (evalErr) {
        if (!mountedRef.current) return;
        setError("Evaluation failed. Please try again.");
        console.error("Evaluation error:", evalErr);
        setState("listening");
      }
    } catch (err) {
      if (!mountedRef.current) return;
      if ((err as Error).name === "AbortError") return;
      setError("Speech recognition error. Please try again.");
      console.error("Transcription error:", err);
      setState("listening");
    } finally {
      processingRef.current = false;
      abortControllerRef.current = null;
    }
  };

  const nextQuestion = () => {
    stopCurrentAudio();
    if (currentQuestion) {
      setPreviousQuestions(prev => [...prev, currentQuestion.question]);
    }
    setCurrentQuestion(null);
    setEvaluation(null);
    setUserTranscript("");
    setQuestionNumber(prev => prev + 1);
    setShouldAutoPlay(true);
    setShowHint(false);
    setState("loading");
    generateQuestionMutation.mutate({ 
      textContent, 
      topicTitle, 
      previousQuestions: currentQuestion ? [...previousQuestions, currentQuestion.question] : previousQuestions 
    });
  };

  const retryQuestion = () => {
    stopCurrentAudio();
    setEvaluation(null);
    setUserTranscript("");
    setShouldAutoPlay(true);
    setState("listening");
  };

  const handleReset = () => {
    stopCurrentAudio();
    setCurrentQuestion(null);
    setEvaluation(null);
    setUserTranscript("");
    setQuestionNumber(1);
    setPreviousQuestions([]);
    setShowHint(false);
    setState("loading");
    if (onResetProgress) {
      onResetProgress();
    }
    generateQuestionMutation.mutate({ textContent, topicTitle, previousQuestions: [] });
  };

  const markComplete = () => {
    if (onComplete) {
      onComplete();
    }
  };

  if (state === "loading" || generateQuestionMutation.isPending) {
    return (
      <div className="flex flex-col h-full items-center justify-center px-6 py-12">
        <Loader2 className="h-12 w-12 text-muted-foreground mb-4 animate-spin" />
        <p className="text-muted-foreground text-center">Generating question...</p>
      </div>
    );
  }

  if (state === "error" || !currentQuestion) {
    return (
      <div className="flex flex-col h-full items-center justify-center px-6 py-12">
        <MessageCircle className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground text-center">
          {error || "Could not generate a question for this text."}
        </p>
        <Button 
          variant="outline" 
          className="mt-4"
          onClick={loadQuestion}
          disabled={generateQuestionMutation.isPending}
          data-testid="button-retry-dialogue"
        >
          <RotateCcw className="h-4 w-4 mr-2" />
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto px-6 sm:px-8 py-6">
        <div className="max-w-3xl mx-auto">
          <p className="text-sm text-muted-foreground mb-4">
            Question {questionNumber} of {TOTAL_QUESTIONS}. Listen and answer in German.
          </p>
          
          <div className="flex items-start gap-4 mb-6">
            <Button
              variant="outline"
              size="icon"
              onClick={playCurrentQuestion}
              disabled={isPlaying}
              data-testid="button-play-question"
            >
              {isPlaying ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Volume2 className="h-4 w-4" />
              )}
            </Button>
            <div className="flex-1">
              <p className="font-serif text-lg leading-relaxed text-foreground/90">
                {currentQuestion.question}
              </p>
              {currentQuestion.context && (
                <div className="mt-2">
                  {showHint ? (
                    <p className="text-sm text-muted-foreground italic">
                      {currentQuestion.context}
                    </p>
                  ) : (
                    <button
                      onClick={() => setShowHint(true)}
                      className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                      data-testid="button-show-hint"
                    >
                      <HelpCircle className="h-3.5 w-3.5" />
                      Show hint
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {state === "listening" && (
            <div className="flex flex-col items-center gap-4 py-8">
              {!isPlaying && (
                <p className="text-sm text-muted-foreground animate-pulse">
                  Your turn — press the button and respond
                </p>
              )}
              <Button
                size="lg"
                onClick={startRecording}
                disabled={isPlaying}
                data-testid="button-start-recording"
              >
                <Mic className="h-5 w-5 mr-2" />
                {isPlaying ? "Playing..." : "Start Recording"}
              </Button>
            </div>
          )}

          {state === "recording" && (
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="flex items-center gap-2 text-red-500 dark:text-red-400">
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
            <div className="flex flex-col items-center gap-4 py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-muted-foreground">Recognizing speech...</p>
            </div>
          )}

          {state === "evaluating" && (
            <div className="flex flex-col items-center gap-4 py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-muted-foreground">Evaluating your response...</p>
            </div>
          )}

          {state === "result" && evaluation && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Your answer:</p>
                <p className="font-serif text-lg italic text-foreground/90">"{userTranscript}"</p>
              </div>

              <div className="bg-muted/50 rounded-lg p-4">
                <p className="text-sm">{evaluation.feedback}</p>
                {evaluation.suggestedResponse && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <p className="text-sm text-muted-foreground">Suggested response:</p>
                    <p className="text-sm font-medium mt-1">"{evaluation.suggestedResponse}"</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {error && (
            <p className="text-destructive text-center py-4">{error}</p>
          )}
        </div>
      </div>

      <div className="border-t bg-card px-6 sm:px-8 py-4">
        <div className="max-w-3xl mx-auto">
          {state === "result" && evaluation && (
            <div className="flex items-center gap-2 mb-4">
              {evaluation.isAppropriate ? (
                <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="font-medium">Good response!</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                  <XCircle className="h-5 w-5" />
                  <span className="font-medium">Try a different answer</span>
                </div>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {state === "result" && (
              <>
                <Button variant="outline" onClick={retryQuestion} data-testid="button-retry">
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Retry
                </Button>
                {questionNumber < TOTAL_QUESTIONS ? (
                  <Button onClick={nextQuestion} data-testid="button-next">
                    Next Question
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                ) : (
                  <Button onClick={markComplete} data-testid="button-finish">
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Finish
                  </Button>
                )}
              </>
            )}
            <Button variant="outline" onClick={handleReset} data-testid="button-reset">
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
