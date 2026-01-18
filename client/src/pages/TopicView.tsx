import { useEffect } from "react";
import { useRoute } from "wouter";
import { Loader2, ArrowLeft, FileText } from "lucide-react";
import { useTopic } from "@/hooks/use-content";
import { Reader } from "@/components/Reader";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export default function TopicView() {
  const [match, params] = useRoute("/topic/:id");
  const topicId = params?.id || "";
  
  const { data: topic, isLoading, error } = useTopic(topicId);

  if (isLoading) {
    return (
      <div className="h-[50vh] flex flex-col items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground animate-pulse">Loading text...</p>
      </div>
    );
  }

  if (error || !topic) {
    return (
      <div className="h-[50vh] flex flex-col items-center justify-center px-4 text-center">
        <div className="bg-destructive/10 p-4 rounded-full mb-4">
          <FileText className="h-8 w-8 text-destructive" />
        </div>
        <h2 className="text-2xl font-serif font-bold mb-2">Topic not found</h2>
        <p className="text-muted-foreground mb-6 max-w-md">
          The topic you are looking for might have been moved or deleted.
        </p>
        <Link href="/">
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Library
          </Button>
        </Link>
      </div>
    );
  }

  // We assume the topic has texts, and for this MVP we just show the first text
  // In a full app, we might list texts within a topic first
  const activeText = topic.texts[0];

  if (!activeText) {
    return (
      <div className="max-w-3xl mx-auto py-12 px-6">
        <div className="text-center py-12 bg-muted/20 rounded-xl border border-dashed">
          <p className="text-muted-foreground">This topic is empty.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <Reader 
        title={activeText.title} 
        paragraphs={activeText.content} 
      />
    </div>
  );
}
