import { useState, useRef, useCallback, useLayoutEffect, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { 
  BookOpen, 
  Library, 
  Menu, 
  ChevronRight,
  ChevronDown,
  FileText,
  Podcast,
  GripVertical,
  Download,
  X,
  Check,
  Loader2,
  CheckCircle2,
  FileDown,
  Settings
} from "lucide-react";
import { SettingsDialog } from "@/components/SettingsDialog";
import { useTopics } from "@/hooks/use-content";
import { usePracticeProgress, TopicText } from "@/hooks/use-practice-progress";
import { useFlashcards } from "@/hooks/use-flashcards";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Checkbox } from "@/components/ui/checkbox";

interface SelectedText {
  topicId: string;
  textId: string;
}

const MIN_WIDTH = 200;
const MAX_WIDTH = 500;
const DEFAULT_WIDTH = 288;
const STORAGE_KEY = "lingoflow-sidebar-width";

function getSavedWidth(): number {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const width = parseInt(saved, 10);
      if (!isNaN(width) && width >= MIN_WIDTH && width <= MAX_WIDTH) {
        return width;
      }
    }
  } catch {}
  return DEFAULT_WIDTH;
}

export function SidebarNav() {
  const { data: topics, isLoading } = useTopics();
  const [location] = useLocation();
  const { getCompletionCount, isTextComplete, getTopicProgress, getGlobalProgress } = usePracticeProgress();
  const { getFlashcardCount, exportToCSV } = useFlashcards();
  const [open, setOpen] = useState(false);
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set());
  const [sidebarWidth, setSidebarWidth] = useState(getSavedWidth);
  const isResizing = useRef(false);
  const widthRef = useRef(sidebarWidth);
  
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedTexts, setSelectedTexts] = useState<SelectedText[]>([]);
  const [isDownloading, setIsDownloading] = useState(false);
  
  const scrollViewportRef = useRef<HTMLDivElement>(null);
  const savedScrollTop = useRef<number>(0);
  
  // Build list of all texts for global progress calculation (after all hooks)
  const allTexts: TopicText[] = topics?.flatMap(topic => 
    topic.texts?.map(text => ({ topicId: topic.id, textId: text.id })) || []
  ) || [];
  
  const globalProgress = getGlobalProgress(allTexts);
  const flashcardCount = getFlashcardCount();
  
  const handleExportFlashcards = () => {
    const csv = exportToCSV();
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lingoflow-saved-words-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const currentPath = location;

  const enterSelectionMode = () => {
    setSelectionMode(true);
    setSelectedTexts([]);
  };

  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedTexts([]);
  };

  const isTextSelected = (topicId: string, textId: string) => {
    return selectedTexts.some(s => s.topicId === topicId && s.textId === textId);
  };

  const isTopicFullySelected = (topicId: string) => {
    const topic = topics?.find(t => t.id === topicId);
    if (!topic || !topic.texts?.length) return false;
    return topic.texts.every(text => isTextSelected(topicId, text.id));
  };

  const isTopicPartiallySelected = (topicId: string) => {
    const topic = topics?.find(t => t.id === topicId);
    if (!topic || !topic.texts?.length) return false;
    const selectedCount = topic.texts.filter(text => isTextSelected(topicId, text.id)).length;
    return selectedCount > 0 && selectedCount < topic.texts.length;
  };

  const saveScrollPosition = () => {
    if (scrollViewportRef.current) {
      savedScrollTop.current = scrollViewportRef.current.scrollTop;
    }
  };

  useLayoutEffect(() => {
    if (scrollViewportRef.current && savedScrollTop.current > 0) {
      scrollViewportRef.current.scrollTop = savedScrollTop.current;
    }
  }, [selectedTexts]);

  const toggleTextSelection = (topicId: string, textId: string) => {
    saveScrollPosition();
    setSelectedTexts(prev => {
      const exists = prev.some(s => s.topicId === topicId && s.textId === textId);
      if (exists) {
        return prev.filter(s => !(s.topicId === topicId && s.textId === textId));
      } else {
        return [...prev, { topicId, textId }];
      }
    });
  };

  const toggleTopicSelection = (topicId: string) => {
    saveScrollPosition();
    const topic = topics?.find(t => t.id === topicId);
    if (!topic || !topic.texts?.length) return;
    
    const allSelected = isTopicFullySelected(topicId);
    
    setSelectedTexts(prev => {
      const withoutTopic = prev.filter(s => s.topicId !== topicId);
      if (allSelected) {
        return withoutTopic;
      } else {
        const topicTexts = topic.texts.map(text => ({ topicId, textId: text.id }));
        return [...withoutTopic, ...topicTexts];
      }
    });
  };

  const handleDownload = async () => {
    if (selectedTexts.length === 0) return;
    
    setIsDownloading(true);
    try {
      const response = await fetch('/api/download-combined-mp3', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texts: selectedTexts })
      });
      
      if (!response.ok) throw new Error('Download failed');
      
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `lingoflow-${selectedTexts.length}-texts.mp3`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      exitSelectionMode();
    } catch (err) {
      console.error('Download failed:', err);
    } finally {
      setIsDownloading(false);
    }
  };

  const startResizing = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", stopResizing);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing.current) return;
    const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, e.clientX));
    widthRef.current = newWidth;
    setSidebarWidth(newWidth);
  }, []);

  const stopResizing = useCallback(() => {
    isResizing.current = false;
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", stopResizing);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    try {
      localStorage.setItem(STORAGE_KEY, widthRef.current.toString());
    } catch {}
  }, [handleMouseMove]);

  const toggleTopic = (topicId: string) => {
    setExpandedTopics(prev => {
      const newSet = new Set(prev);
      if (newSet.has(topicId)) {
        newSet.delete(topicId);
      } else {
        newSet.add(topicId);
      }
      return newSet;
    });
  };

  const isTextActive = (topicId: string, textId: string) => {
    return currentPath === `/topic/${topicId}/text/${textId}`;
  };

  // Auto-expand topic when navigating to a text within it
  useEffect(() => {
    if (!topics) return;
    for (const topic of topics) {
      const hasActive = topic.texts?.some(t => isTextActive(topic.id, t.id));
      if (hasActive && !expandedTopics.has(topic.id)) {
        setExpandedTopics(prev => {
          const newSet = new Set(prev);
          newSet.add(topic.id);
          return newSet;
        });
        break;
      }
    }
  }, [currentPath, topics]);

  const NavContent = () => (
    <div className="flex flex-col h-full">
      <div className="space-y-6 py-6 flex-1 overflow-hidden flex flex-col">
        <div className="px-4">
          <Link href="/" className="flex items-center gap-2 font-serif text-2xl font-semibold text-primary">
            <Library className="h-6 w-6" />
            <span>LingoFlow</span>
          </Link>
          <p className="mt-2 text-sm text-muted-foreground">
            Read. Listen. Practice.
          </p>
          {!isLoading && allTexts.length > 0 && (
            <div className="mt-3" data-testid="global-progress">
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                <span>Overall Progress</span>
                <span className={`font-medium ${globalProgress.percentage === 100 ? 'text-green-600 dark:text-green-500' : ''}`}>{globalProgress.percentage}%</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-300 ${globalProgress.percentage === 100 ? 'bg-green-600 dark:bg-green-500' : 'bg-primary'}`}
                  style={{ width: `${globalProgress.percentage}%` }}
                />
              </div>
            </div>
          )}
          <div className="mt-3 flex items-center gap-1">
            <a 
              href="/podcast/feed.xml" 
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              data-testid="link-podcast-feed"
              title="Podcast RSS"
            >
              <Podcast className="h-4 w-4" />
            </a>
            <button 
              onClick={enterSelectionMode}
              disabled={selectionMode}
              className={`p-2 rounded-md transition-colors ${
                selectionMode 
                  ? "text-muted-foreground/40 cursor-not-allowed" 
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
              data-testid="button-enter-selection-mode"
              title="Download MP3"
            >
              <Download className="h-4 w-4" />
            </button>
            {flashcardCount > 0 && (
              <button 
                onClick={handleExportFlashcards}
                className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex items-center gap-1"
                data-testid="button-export-saved-words"
                title="Export saved words to CSV"
              >
                <FileDown className="h-4 w-4" />
                <span className="text-xs">{flashcardCount}</span>
              </button>
            )}
            <SettingsDialog />
          </div>
        </div>

        <div className="px-2 flex-1 overflow-hidden flex flex-col">
          <h3 className="px-2 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {selectionMode ? "Select texts to download" : "Library"}
          </h3>
          
          {isLoading ? (
            <div className="space-y-2 px-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-10 bg-muted/50 rounded-md animate-pulse" />
              ))}
            </div>
          ) : (
            <ScrollArea className="flex-1" viewportRef={scrollViewportRef}>
              <div className="space-y-1 px-1 pb-20">
                {topics?.map((topic) => {
                  const hasTexts = topic.texts && topic.texts.length > 0;
                  const isExpanded = expandedTopics.has(topic.id);
                  const topicFullySelected = isTopicFullySelected(topic.id);
                  const topicPartiallySelected = isTopicPartiallySelected(topic.id);
                  const textIds = topic.texts?.map(t => t.id) || [];
                  const topicProgress = getTopicProgress(topic.id, textIds);

                  return (
                    <Collapsible 
                      key={topic.id} 
                      open={selectionMode || isExpanded}
                      onOpenChange={() => !selectionMode && toggleTopic(topic.id)}
                    >
                      <div className="flex items-center overflow-hidden">
                        <div 
                          className={`w-8 flex-shrink-0 flex items-center justify-center py-2.5 ${selectionMode ? 'cursor-pointer' : 'opacity-0 pointer-events-none'}`}
                          onClick={(e) => {
                            if (!selectionMode) return;
                            e.stopPropagation();
                            toggleTopicSelection(topic.id);
                          }}
                        >
                          <Checkbox 
                            checked={topicFullySelected}
                            className={topicPartiallySelected ? "opacity-50" : ""}
                            data-testid={`checkbox-topic-${topic.id}`}
                          />
                        </div>
                        <CollapsibleTrigger asChild>
                          <div 
                            className="group flex-1 flex flex-col gap-1 px-3 py-2 rounded-md text-sm transition-colors cursor-pointer text-foreground hover:bg-muted overflow-hidden min-w-0"
                            data-testid={`topic-${topic.id}`}
                          >
                            <div className="flex items-center justify-between gap-2 overflow-hidden min-w-0">
                              <div className="flex items-center gap-3 overflow-hidden min-w-0">
                                <BookOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
                                <span className="truncate font-medium">{topic.title}</span>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                {hasTexts && !selectionMode && !isExpanded && (
                                  topicProgress.percentage === 100 ? (
                                    <CheckCircle2 
                                      className="h-4 w-4 text-green-600 dark:text-green-500" 
                                      data-testid={`topic-progress-${topic.id}`}
                                    />
                                  ) : (
                                    <span 
                                      className="text-xs text-muted-foreground"
                                      data-testid={`topic-progress-${topic.id}`}
                                    >
                                      {topicProgress.percentage}%
                                    </span>
                                  )
                                )}
                                {!selectionMode && (
                                  isExpanded ? (
                                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                  )
                                )}
                              </div>
                            </div>
                            {hasTexts && !selectionMode && isExpanded && (
                              <div className="flex items-center gap-2 ml-7 text-xs" data-testid={`topic-progress-expanded-${topic.id}`}>
                                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                                  <div 
                                    className={`h-full transition-all duration-300 ${topicProgress.percentage === 100 ? 'bg-green-600 dark:bg-green-500' : 'bg-primary'}`}
                                    style={{ width: `${topicProgress.percentage}%` }}
                                  />
                                </div>
                                <span className={`shrink-0 ${topicProgress.percentage === 100 ? 'text-green-600 dark:text-green-500 font-medium' : 'text-muted-foreground'}`}>
                                  {topicProgress.percentage}%
                                </span>
                              </div>
                            )}
                          </div>
                        </CollapsibleTrigger>
                      </div>
                      
                      {hasTexts && (
                        <CollapsibleContent>
                          <div className="ml-6 pl-3 border-l border-border space-y-1 py-1">
                            {topic.texts.map((text) => {
                              const active = isTextActive(topic.id, text.id);
                              const textSelected = isTextSelected(topic.id, text.id);
                              
                              return (
                                <div 
                                  key={text.id}
                                  onClick={() => selectionMode && toggleTextSelection(topic.id, text.id)}
                                  className={`flex items-center gap-2 py-1.5 rounded text-sm transition-colors ${
                                    selectionMode 
                                      ? `cursor-pointer ${textSelected ? "bg-primary/10 text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"}`
                                      : ""
                                  }`}
                                  data-testid={selectionMode ? `select-text-${text.id}` : `text-${text.id}`}
                                >
                                  <div className={`w-6 flex-shrink-0 flex items-center justify-center ${selectionMode ? '' : 'opacity-0'}`}>
                                    <Checkbox checked={textSelected} />
                                  </div>
                                  {selectionMode ? (
                                    <span className="truncate flex-1 min-w-0">{text.title}</span>
                                  ) : (
                                    <Link href={`/topic/${topic.id}/text/${text.id}`} className="flex-1 min-w-0">
                                      <div 
                                        className={`flex items-center gap-2 px-2 py-1 rounded overflow-hidden ${
                                          active 
                                            ? "bg-primary text-primary-foreground font-medium" 
                                            : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                                        }`}
                                      >
                                        <FileText className="h-3 w-3 shrink-0" />
                                        <span className="truncate flex-1 min-w-0">{text.title}</span>
                                        {(() => {
                                          const count = getCompletionCount(topic.id, text.id);
                                          const complete = isTextComplete(topic.id, text.id);
                                          if (complete) {
                                            return <CheckCircle2 className={`h-3.5 w-3.5 shrink-0 ${active ? "text-primary-foreground" : "text-green-600 dark:text-green-500"}`} />;
                                          } else if (count > 0) {
                                            return <span className={`text-xs shrink-0 ${active ? "text-primary-foreground/80" : "text-muted-foreground"}`}>{count}/5</span>;
                                          }
                                          return null;
                                        })()}
                                      </div>
                                    </Link>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </CollapsibleContent>
                      )}
                    </Collapsible>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </div>
      </div>
      
      {selectionMode && (
        <div className="border-t bg-muted/30 p-3">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-sm text-muted-foreground">
              {selectedTexts.length} text{selectedTexts.length !== 1 ? 's' : ''} selected
            </span>
          </div>
          <div className="flex gap-2">
            <Button 
              size="sm" 
              onClick={handleDownload}
              disabled={selectedTexts.length === 0 || isDownloading}
              className="flex-1"
              data-testid="button-download-selected"
            >
              {isDownloading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              Download
            </Button>
            <Button 
              size="sm" 
              variant="outline"
              onClick={exitSelectionMode}
              data-testid="button-cancel-selection"
            >
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <>
      <aside 
        className="hidden md:flex h-screen sticky top-0 bg-card"
        style={{ width: sidebarWidth }}
      >
        <div className="flex-1 border-r overflow-hidden">
          <NavContent />
        </div>
        <div
          className="w-2 cursor-col-resize hover:bg-primary/20 active:bg-primary/30 transition-colors flex items-center justify-center group"
          onMouseDown={startResizing}
          data-testid="sidebar-resize-handle"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors" />
        </div>
      </aside>

      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-background/80 backdrop-blur-md border-b p-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-serif text-xl font-semibold">
          <Library className="h-5 w-5" />
          <span>LingoFlow</span>
        </Link>
        
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" data-testid="button-mobile-menu">
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
