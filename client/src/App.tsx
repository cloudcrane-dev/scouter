import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth";
import NotFound from "@/pages/not-found";
import HomePage from "@/pages/home";
import StudentPage from "@/pages/student";
import LeaderboardPage from "@/pages/leaderboard";
import ProfilePage from "@/pages/profile";

import { Search, User, ShieldCheck } from "lucide-react";

function BottomNav() {
  const [location, navigate] = useLocation();
  const { isAuthenticated, isLoading, user } = useAuth();
  const isHome = location === "/";
  const isProfile = location === "/profile";

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

        {!isLoading && isAuthenticated && (
          <button
            data-testid="nav-profile"
            onClick={() => navigate("/profile")}
            className="flex-1 flex flex-col items-center gap-1 py-3 text-[10px] uppercase tracking-[0.15em] transition-all duration-200 relative cursor-pointer"
          >
            {user?.pictureUrl ? (
              <img src={user.pictureUrl} alt={user.name} className={`w-4 h-4 rounded-full object-cover border transition-colors duration-200 ${isProfile ? "border-foreground/60" : "border-white/20"}`} />
            ) : (
              <User className={`w-4 h-4 transition-colors duration-200 ${isProfile ? "text-foreground" : "text-muted-foreground/50"}`} />
            )}
            <span className={`transition-colors duration-200 ${isProfile ? "text-foreground" : "text-muted-foreground/50"}`}>
              {user?.name?.split(" ")[0] ?? "profile"}
            </span>
            {isProfile && (
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-px bg-foreground nav-indicator" />
            )}
          </button>
        )}

        {!isLoading && !isAuthenticated && (
          <a
            href="/auth/google"
            data-testid="nav-login"
            className="flex-1 flex flex-col items-center gap-1 py-3 text-[10px] uppercase tracking-[0.15em] transition-all duration-200 relative group"
          >
            <ShieldCheck className="w-4 h-4 text-foreground group-hover:scale-110 transition-transform duration-200" />
            <span className="text-foreground font-semibold tracking-widest">iitj login</span>
          </a>
        )}
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
      <Route path="/profile" component={ProfilePage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <div className="scanline" />
          <div className="pb-16">
            <Router />
          </div>
          <BottomNav />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
