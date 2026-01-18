import { Link } from "wouter";
import { BookOpen, ArrowRight } from "lucide-react";
import { useTopics } from "@/hooks/use-content";
import { Button } from "@/components/ui/button";

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

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-2">
        {isLoading ? (
          // Loading skeletons
          [1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-card border rounded-xl p-6 h-48 animate-pulse bg-muted/20" />
          ))
        ) : topics && topics.length > 0 ? (
          topics.map((topic) => (
            <Link key={topic.id} href={`/topic/${topic.id}`} className="group block h-full">
              <div className="bg-card border rounded-xl p-6 h-full shadow-sm hover:shadow-md hover:border-primary/20 transition-all duration-300 flex flex-col">
                <div className="flex items-start justify-between mb-4">
                  <div className="p-3 bg-primary/5 rounded-lg text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    <BookOpen className="h-6 w-6" />
                  </div>
                </div>
                
                <h3 className="text-xl font-serif font-semibold mb-2 group-hover:text-primary transition-colors">
                  {topic.title}
                </h3>
                
                <p className="text-muted-foreground text-sm line-clamp-2 mb-6 flex-grow">
                  {topic.description || "Start reading this collection of texts..."}
                </p>
                
                <div className="flex items-center text-sm font-medium text-primary mt-auto">
                  Start Reading 
                  <ArrowRight className="ml-2 h-4 w-4 transform group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </Link>
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
