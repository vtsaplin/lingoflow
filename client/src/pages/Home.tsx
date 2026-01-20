import { MousePointer2, Volume2, BookOpen, Languages } from "lucide-react";

export default function Home() {
  return (
    <div className="max-w-3xl mx-auto py-12 px-6 sm:px-8">
      <div className="space-y-4 mb-12 text-center">
        <h1 className="text-4xl sm:text-5xl font-serif font-bold tracking-tight text-foreground">
          LingoFlow
        </h1>
        <p className="text-xl text-muted-foreground">
          Read. Listen. Practice.
        </p>
      </div>

      <div className="bg-card border rounded-xl p-6 sm:p-8 shadow-sm">
        <h2 className="text-xl font-semibold mb-6 text-foreground text-center">How to use</h2>
        
        <div className="grid grid-cols-2 gap-6">
          <div className="flex flex-col items-center text-center gap-2">
            <div className="p-3 bg-primary/10 rounded-lg text-primary">
              <BookOpen className="h-5 w-5" />
            </div>
            <h3 className="font-medium text-foreground">Choose a text</h3>
            <p className="text-muted-foreground text-sm">Pick a topic from the sidebar</p>
          </div>

          <div className="flex flex-col items-center text-center gap-2">
            <div className="p-3 bg-primary/10 rounded-lg text-primary">
              <MousePointer2 className="h-5 w-5" />
            </div>
            <h3 className="font-medium text-foreground">Click to learn</h3>
            <p className="text-muted-foreground text-sm">Words or sentences — you choose</p>
          </div>

          <div className="flex flex-col items-center text-center gap-2">
            <div className="p-3 bg-primary/10 rounded-lg text-primary">
              <Volume2 className="h-5 w-5" />
            </div>
            <h3 className="font-medium text-foreground">Listen and repeat</h3>
            <p className="text-muted-foreground text-sm">Audio plays automatically</p>
          </div>

          <div className="flex flex-col items-center text-center gap-2">
            <div className="p-3 bg-primary/10 rounded-lg text-primary">
              <Languages className="h-5 w-5" />
            </div>
            <h3 className="font-medium text-foreground">Your language</h3>
            <p className="text-muted-foreground text-sm">Translations in Russian</p>
          </div>
        </div>
      </div>

      <p className="text-center text-muted-foreground text-sm mt-8">
        Select a text from the sidebar to begin reading.
      </p>
    </div>
  );
}
