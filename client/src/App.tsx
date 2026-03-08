import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import HomePage from "@/pages/home";
import StudentPage from "@/pages/student";
import LeaderboardPage from "@/pages/leaderboard";
import { Search, Trophy } from "lucide-react";

function BottomNav() {
  const [location, navigate] = useLocation();

  const isHome = location === "/";
  const isLeaderboard = location === "/leaderboard";

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-md border-t z-50 safe-area-pb" data-testid="nav-bottom">
      <div className="max-w-2xl mx-auto flex">
        <button
          data-testid="nav-search"
          onClick={() => navigate("/")}
          className={`flex-1 flex flex-col items-center gap-1 py-3 text-xs font-medium transition-colors ${
            isHome ? "text-primary" : "text-muted-foreground"
          }`}
        >
          <Search className="w-5 h-5" />
          <span>Search</span>
        </button>
        <button
          data-testid="nav-leaderboard"
          onClick={() => navigate("/leaderboard")}
          className={`flex-1 flex flex-col items-center gap-1 py-3 text-xs font-medium transition-colors ${
            isLeaderboard ? "text-primary" : "text-muted-foreground"
          }`}
        >
          <Trophy className="w-5 h-5" />
          <span>Leaderboard</span>
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
        <div className="pb-16">
          <Router />
        </div>
        <BottomNav />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
