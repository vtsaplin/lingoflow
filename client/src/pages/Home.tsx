import { Link } from "wouter";
import { BookOpen, FileText, ArrowRight } from "lucide-react";
import { useTopics } from "@/hooks/use-content";

export default function Home() {
  const { data: topics, isLoading } = useTopics();

  return (
    <div className="max-w-4xl mx-auto py-12 px-6 sm:px-8">
      <div className="space-y-4 mb-12 text-center sm:text-left">
        <h1 className="text-4xl sm:text-5xl font-serif font-bold tracking-tight text-foreground">
          LingoFlow
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl leading-relaxed">
          Read. Hear. Understand.
        </p>
      </div>

      <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {isLoading ? (
          [1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-card border rounded-xl p-6 animate-pulse bg-muted/20 h-56" />
          ))
        ) : topics && topics.length > 0 ? (
          topics.map((topic) => (
            <div key={topic.id} className="bg-card border rounded-xl p-5 shadow-sm flex flex-col h-full">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 bg-primary/5 rounded-lg text-primary shrink-0">
                  <BookOpen className="h-5 w-5" />
                </div>
                <h2 className="text-lg font-serif font-semibold text-foreground line-clamp-2">
                  {topic.title}
                </h2>
              </div>
              
              <div className="space-y-1 flex-1">
                {topic.texts.map((text) => (
                  <Link key={text.id} href={`/topic/${topic.id}/text/${text.id}`}>
                    <div className="group flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                      <FileText className="h-4 w-4 text-muted-foreground group-hover:text-primary shrink-0" />
                      <span className="text-sm text-foreground group-hover:text-primary font-medium truncate flex-1">
                        {text.title}
                      </span>
                      <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:text-primary transition-all transform group-hover:translate-x-1 shrink-0" />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full py-12 text-center bg-muted/20 rounded-xl border border-dashed">
            <BookOpen className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium text-foreground">No content available</h3>
            <p className="text-muted-foreground">Check back later for new reading materials.</p>
          </div>
        )}
      </div>
    </div>
  );
}
