import { BookOpen } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t bg-muted/30 py-4 px-4" data-testid="footer">
      <div className="container mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4" />
          <span className="font-medium">LingoFlow</span>
          <span className="hidden sm:inline">— German Language Learning</span>
        </div>
        <div className="text-center sm:text-right">
          <span>A2-B1 Level Reader with Practice Modes</span>
        </div>
      </div>
    </footer>
  );
}
