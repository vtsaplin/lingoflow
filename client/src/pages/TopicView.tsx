import { useRoute } from "wouter";
import { Loader2, ArrowLeft, FileText } from "lucide-react";
import { useTopic } from "@/hooks/use-content";
import { Reader } from "@/components/Reader";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export default function TopicView() {
  const [, params] = useRoute("/topic/:topicId/text/:textId");
  const topicId = params?.topicId || "";
  const textId = params?.textId || "";
  
  const { data: topic, isLoading, error } = useTopic(topicId);

  if (isLoading) {
    return (
      <div className="h-[50vh] flex flex-col items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground animate-pulse">Loading...</p>
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

  const activeText = topic.texts.find(t => t.id === textId);

  if (!activeText) {
    return (
      <div className="h-[50vh] flex flex-col items-center justify-center px-4 text-center">
        <div className="bg-muted p-4 rounded-full mb-4">
          <FileText className="h-8 w-8 text-muted-foreground" />
        </div>
        <h2 className="text-2xl font-serif font-bold mb-2">Text not found</h2>
        <p className="text-muted-foreground mb-6 max-w-md">
          Select a text from the sidebar to start reading.
        </p>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 h-full">
      <Reader 
        topicTitle={topic.title}
        title={activeText.title} 
        paragraphs={activeText.content} 
      />
    </div>
  );
}
