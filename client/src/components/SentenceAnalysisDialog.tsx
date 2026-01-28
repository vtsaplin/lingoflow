import { useState, useEffect } from "react";
import { Loader2, BookOpen, Layers, Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface SentenceAnalysis {
  phrasalVerbs: Array<{
    phrase: string;
    meaning: string;
  }>;
  constructions: Array<{
    pattern: string;
    explanation: string;
  }>;
  compoundWords: Array<{
    word: string;
    parts: string;
    meaning: string;
  }>;
}

interface SentenceAnalysisDialogProps {
  sentence: string;
}

export function SentenceAnalysisDialog({ sentence }: SentenceAnalysisDialogProps) {
  const [open, setOpen] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery<SentenceAnalysis>({
    queryKey: ["analyze-sentence", sentence],
    queryFn: async () => {
      const response = await apiRequest("POST", "/api/analyze-sentence", { sentence });
      return response.json();
    },
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    setOpen(false);
  }, [sentence]);

  const hasContent = data && (
    data.phrasalVerbs.length > 0 ||
    data.constructions.length > 0 ||
    data.compoundWords.length > 0
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          data-testid="button-analyze-sentence"
        >
          <BookOpen className="h-4 w-4 mr-1" />
          Analyze
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Sentence Analysis</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground italic border-l-2 border-primary/30 pl-3">
            "{sentence}"
          </p>

          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Analyzing...</span>
            </div>
          )}

          {isError && (
            <div className="text-center py-4">
              <p className="text-sm text-destructive mb-2">Analysis failed</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                data-testid="button-retry-analysis"
              >
                Try again
              </Button>
            </div>
          )}

          {data && !hasContent && (
            <p className="text-center text-muted-foreground py-4">
              No notable grammar patterns in this sentence.
            </p>
          )}

          {data && hasContent && (
            <div className="space-y-4">
              {data.phrasalVerbs.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Languages className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">Phrasal Verbs</span>
                  </div>
                  <div className="space-y-2">
                    {data.phrasalVerbs.map((item, i) => (
                      <div key={i} className="bg-muted/50 rounded-md px-3 py-2">
                        <span className="font-medium">{item.phrase}</span>
                        <span className="text-muted-foreground mx-2">—</span>
                        <span className="text-muted-foreground">{item.meaning}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {data.constructions.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Layers className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">Grammar Patterns</span>
                  </div>
                  <div className="space-y-2">
                    {data.constructions.map((item, i) => (
                      <div key={i} className="bg-muted/50 rounded-md px-3 py-2">
                        <div className="font-medium font-mono text-sm">{item.pattern}</div>
                        <div className="text-sm text-muted-foreground mt-1">{item.explanation}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {data.compoundWords.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <BookOpen className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">Compound Words</span>
                  </div>
                  <div className="space-y-2">
                    {data.compoundWords.map((item, i) => (
                      <div key={i} className="bg-muted/50 rounded-md px-3 py-2">
                        <div>
                          <span className="font-medium">{item.word}</span>
                          <span className="text-muted-foreground mx-2">=</span>
                          <span className="font-mono text-sm">{item.parts}</span>
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">{item.meaning}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
