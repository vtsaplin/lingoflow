import { Link } from "wouter";
import { BookOpen, FileText, ArrowRight } from "lucide-react";
import { useTopics } from "@/hooks/use-content";

export default function Home() {
  const { data: topics, isLoading } = useTopics();

  return (
    <div className="max-w-4xl mx-auto py-12 px-6 sm:px-8">
      <div className="space-y-4 mb-12 text-center sm:text-left">
        <h1 className="text-4xl sm:text-5xl font-serif font-bold tracking-tight text-foreground">
          Welcome to LinguaRead
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl leading-relaxed">
          Improve your German vocabulary through immersive reading. Click any word for a definition or sentence for translation.
        </p>
      </div>

      <div className="space-y-8">
        {isLoading ? (
          [1, 2].map((i) => (
            <div key={i} className="bg-card border rounded-xl p-6 animate-pulse bg-muted/20 h-48" />
          ))
        ) : topics && topics.length > 0 ? (
          topics.map((topic) => (
            <div key={topic.id} className="bg-card border rounded-xl p-6 shadow-sm">
              <div className="flex items-start gap-4 mb-4">
                <div className="p-3 bg-primary/5 rounded-lg text-primary">
                  <BookOpen className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-xl font-serif font-semibold text-foreground">
                    {topic.title}
                  </h2>
                  {topic.description && (
                    <p className="text-muted-foreground text-sm mt-1">
                      {topic.description}
                    </p>
                  )}
                </div>
              </div>
              
              <div className="space-y-2 ml-1">
                {topic.texts.map((text) => (
                  <Link key={text.id} href={`/topic/${topic.id}/text/${text.id}`}>
                    <div className="group flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                      <FileText className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                      <span className="text-foreground group-hover:text-primary font-medium flex-1">
                        {text.title}
                      </span>
                      <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:text-primary transition-all transform group-hover:translate-x-1" />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))
        ) : (
          <div className="py-12 text-center bg-muted/20 rounded-xl border border-dashed">
            <BookOpen className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium text-foreground">No content available</h3>
            <p className="text-muted-foreground">Check back later for new reading materials.</p>
          </div>
        )}
      </div>
    </div>
  );
}
