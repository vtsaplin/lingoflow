import { MousePointer2, Volume2, BookOpen, Languages, Layers, PenLine, ArrowRightLeft, Mic, ListChecks } from "lucide-react";

export default function Home() {
  return (
    <div className="max-w-4xl mx-auto py-12 px-6 sm:px-8">
      <div className="space-y-4 mb-12 text-center">
        <h1 className="text-4xl sm:text-5xl font-serif font-bold tracking-tight text-foreground">
          LingoFlow
        </h1>
        <p className="text-xl text-muted-foreground">
          Read. Listen. Practice.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="bg-card border rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-5 text-foreground">Study Mode</h2>
          
          <div className="space-y-4">
            <div className="flex gap-3">
              <div className="p-2.5 bg-primary/10 rounded-lg text-primary shrink-0 h-fit">
                <BookOpen className="h-4 w-4" />
              </div>
              <div>
                <h3 className="font-medium text-foreground text-sm">Choose a text</h3>
                <p className="text-muted-foreground text-xs">Pick a topic from the sidebar</p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="p-2.5 bg-primary/10 rounded-lg text-primary shrink-0 h-fit">
                <MousePointer2 className="h-4 w-4" />
              </div>
              <div>
                <h3 className="font-medium text-foreground text-sm">Click to learn</h3>
                <p className="text-muted-foreground text-xs">Tap words for definitions, sentences for translations</p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="p-2.5 bg-primary/10 rounded-lg text-primary shrink-0 h-fit">
                <Volume2 className="h-4 w-4" />
              </div>
              <div>
                <h3 className="font-medium text-foreground text-sm">Listen and repeat</h3>
                <p className="text-muted-foreground text-xs">Audio plays automatically when you click</p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="p-2.5 bg-primary/10 rounded-lg text-primary shrink-0 h-fit">
                <Languages className="h-4 w-4" />
              </div>
              <div>
                <h3 className="font-medium text-foreground text-sm">Your language</h3>
                <p className="text-muted-foreground text-xs">All translations in Russian</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-card border rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-5 text-foreground">Practice Modes</h2>
          
          <div className="space-y-4">
            <div className="flex gap-3">
              <div className="p-2.5 bg-primary/10 rounded-lg text-primary shrink-0 h-fit">
                <Layers className="h-4 w-4" />
              </div>
              <div>
                <h3 className="font-medium text-foreground text-sm">Cards</h3>
                <p className="text-muted-foreground text-xs">Flashcard quiz with your saved words</p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="p-2.5 bg-primary/10 rounded-lg text-primary shrink-0 h-fit">
                <ListChecks className="h-4 w-4" />
              </div>
              <div>
                <h3 className="font-medium text-foreground text-sm">Fill</h3>
                <p className="text-muted-foreground text-xs">Fill in missing words from a word bank</p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="p-2.5 bg-primary/10 rounded-lg text-primary shrink-0 h-fit">
                <ArrowRightLeft className="h-4 w-4" />
              </div>
              <div>
                <h3 className="font-medium text-foreground text-sm">Order</h3>
                <p className="text-muted-foreground text-xs">Arrange words to form correct sentences</p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="p-2.5 bg-primary/10 rounded-lg text-primary shrink-0 h-fit">
                <PenLine className="h-4 w-4" />
              </div>
              <div>
                <h3 className="font-medium text-foreground text-sm">Write</h3>
                <p className="text-muted-foreground text-xs">Type the missing words with hints</p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="p-2.5 bg-primary/10 rounded-lg text-primary shrink-0 h-fit">
                <Mic className="h-4 w-4" />
              </div>
              <div>
                <h3 className="font-medium text-foreground text-sm">Speak</h3>
                <p className="text-muted-foreground text-xs">Practice speaking with AI dialogue</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <p className="text-center text-muted-foreground text-sm mt-8">
        Select a text from the sidebar to begin reading.
      </p>
    </div>
  );
}
