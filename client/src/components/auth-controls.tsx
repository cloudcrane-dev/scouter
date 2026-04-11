import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

export default function AuthControls() {
  const [handleInput, setHandleInput] = useState("");
  const { toast } = useToast();
  const { user, isLoggedIn, login, logout, isLoggingIn, isLoggingOut } = useAuth();

  async function handleLogin() {
    if (!handleInput.trim()) {
      toast({ title: "login failed", description: "Please enter a handle.", variant: "destructive" });
      return;
    }
    try {
      await login(handleInput.trim());
      setHandleInput("");
      toast({ title: "logged in", description: "Protected actions are now enabled." });
    } catch {
      toast({ title: "login failed", description: "Unable to login right now.", variant: "destructive" });
    }
  }

  async function handleLogout() {
    try {
      await logout();
      toast({ title: "logged out", description: "Protected actions are now disabled." });
    } catch {
      toast({ title: "logout failed", description: "Unable to logout right now.", variant: "destructive" });
    }
  }

  if (isLoggedIn && user) {
    return (
      <div className="fixed top-3 right-3 z-50 flex items-center gap-2 border border-white/10 bg-background/90 backdrop-blur-sm px-2 py-1">
        <span className="text-[10px] font-mono text-muted-foreground" data-testid="text-auth-user">
          @{user.handle}
        </span>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 rounded-none text-[10px] font-mono"
          onClick={handleLogout}
          disabled={isLoggingOut}
          data-testid="button-logout"
        >
          logout
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed top-3 right-3 z-50 flex items-center gap-2 border border-white/10 bg-background/90 backdrop-blur-sm px-2 py-1">
      <Input
        value={handleInput}
        onChange={(e) => setHandleInput(e.target.value)}
        placeholder="handle"
        className="h-7 w-28 rounded-none border-white/10 text-[10px] font-mono"
        data-testid="input-login-handle"
      />
      <Button
        size="sm"
        className="h-7 rounded-none text-[10px] font-mono"
        onClick={handleLogin}
        disabled={isLoggingIn}
        data-testid="button-login"
      >
        login
      </Button>
    </div>
  );
}
