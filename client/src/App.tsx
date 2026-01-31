import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import TopicView from "@/pages/TopicView";
import { SidebarNav } from "@/components/SidebarNav";
import { Footer } from "@/components/Footer";

function Router() {
  return (
    <div className="h-screen bg-background flex flex-col md:flex-row overflow-hidden">
      <SidebarNav />
      <div className="flex-1 pt-16 md:pt-0 flex flex-col min-h-0 overflow-hidden">
        <main className="flex-1 overflow-auto">
          <Switch>
            <Route path="/" component={Home} />
            <Route path="/topic/:topicId/text/:textId" component={TopicView} />
            <Route component={NotFound} />
          </Switch>
        </main>
        <Footer />
      </div>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
