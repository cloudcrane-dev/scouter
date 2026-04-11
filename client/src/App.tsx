import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import HomePage from "@/pages/home";
import StudentPage from "@/pages/student";
import LeaderboardPage from "@/pages/leaderboard";
import AuthControls from "@/components/auth-controls";

import { Search, Trophy } from "lucide-react";

function BottomNav() {
  const [location, navigate] = useLocation();
  const isHome = location === "/";
  const isLeaderboard = location === "/leaderboard";

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-background/90 backdrop-blur-sm border-t border-white/5 z-50 safe-area-pb font-mono" data-testid="nav-bottom">
      <div className="max-w-2xl mx-auto flex">
        <button
          data-testid="nav-search"
          onClick={() => navigate("/")}
          className="flex-1 flex flex-col items-center gap-1 py-3 text-[10px] uppercase tracking-[0.15em] transition-all duration-200 relative cursor-pointer"
        >
          <Search className={`w-4 h-4 transition-colors duration-200 ${isHome ? "text-foreground" : "text-muted-foreground/50"}`} />
          <span className={`transition-colors duration-200 ${isHome ? "text-foreground" : "text-muted-foreground/50"}`}>search</span>
          {isHome && (
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-px bg-foreground nav-indicator" />
          )}
        </button>
        <button
          data-testid="nav-leaderboard"
          onClick={() => navigate("/leaderboard")}
          className="flex-1 flex flex-col items-center gap-1 py-3 text-[10px] uppercase tracking-[0.15em] transition-all duration-200 relative cursor-pointer"
        >
          <Trophy className={`w-4 h-4 transition-colors duration-200 ${isLeaderboard ? "text-foreground" : "text-muted-foreground/50"}`} />
          <span className={`transition-colors duration-200 ${isLeaderboard ? "text-foreground" : "text-muted-foreground/50"}`}>ranks</span>
          {isLeaderboard && (
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-px bg-foreground nav-indicator" />
          )}
        </button>
      </div>
    </nav>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={HomePage} />
      <Route path="/student/:id" component={StudentPage} />
      <Route path="/leaderboard" component={LeaderboardPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <AuthControls />
        <div className="scanline" />
        <div className="pb-16">
          <Router />
        </div>
        <BottomNav />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
