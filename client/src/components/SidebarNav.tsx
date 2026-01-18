import { useState } from "react";
import { Link, useLocation } from "wouter";
import { 
  BookOpen, 
  Library, 
  Menu, 
  X,
  ChevronRight
} from "lucide-react";
import { useTopics } from "@/hooks/use-content";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";

export function SidebarNav() {
  const { data: topics, isLoading } = useTopics();
  const [location] = useLocation();
  const [open, setOpen] = useState(false);

  // Parse current ID if we're on a topic page
  const currentTopicId = location.startsWith("/topic/") 
    ? location.split("/")[2] 
    : null;

  const NavContent = () => (
    <div className="space-y-6 py-6">
      <div className="px-4">
        <Link href="/" className="flex items-center gap-2 font-serif text-2xl font-semibold text-primary">
          <Library className="h-6 w-6" />
          <span>LinguaRead</span>
        </Link>
        <p className="mt-2 text-sm text-muted-foreground">
          German-Russian Learning Reader
        </p>
      </div>

      <div className="px-2">
        <h3 className="px-2 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Library
        </h3>
        
        {isLoading ? (
          <div className="space-y-2 px-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-10 bg-muted/50 rounded-md animate-pulse" />
            ))}
          </div>
        ) : (
          <ScrollArea className="h-[calc(100vh-200px)]">
            <div className="space-y-1 px-1">
              {topics?.map((topic) => (
                <Link key={topic.id} href={`/topic/${topic.id}`}>
                  <div className={`
                    group flex items-center justify-between px-3 py-2.5 rounded-md text-sm transition-colors cursor-pointer
                    ${currentTopicId === topic.id 
                      ? "bg-primary text-primary-foreground font-medium" 
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }
                  `}>
                    <div className="flex items-center gap-3 overflow-hidden">
                      <BookOpen className={`h-4 w-4 shrink-0 ${currentTopicId === topic.id ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground"}`} />
                      <span className="truncate">{topic.title}</span>
                    </div>
                    {currentTopicId === topic.id && (
                      <ChevronRight className="h-4 w-4 opacity-50" />
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:block w-72 border-r bg-card h-screen sticky top-0">
        <NavContent />
      </aside>

      {/* Mobile Sheet */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-background/80 backdrop-blur-md border-b p-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-serif text-xl font-semibold">
          <Library className="h-5 w-5" />
          <span>LinguaRead</span>
        </Link>
        
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu className="h-6 w-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0">
            <NavContent />
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
