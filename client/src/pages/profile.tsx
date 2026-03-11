import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft, LogOut, Plus, Trash2, Save, User, Link as LinkIcon,
  ExternalLink, ShieldCheck,
} from "lucide-react";
import { SiGithub, SiLinkedin, SiLeetcode, SiBehance } from "react-icons/si";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";

const PLATFORM_OPTIONS = [
  { value: "github", label: "GitHub", icon: SiGithub, placeholder: "https://github.com/username" },
  { value: "linkedin", label: "LinkedIn", icon: SiLinkedin, placeholder: "https://linkedin.com/in/username" },
  { value: "leetcode", label: "LeetCode", icon: SiLeetcode, placeholder: "https://leetcode.com/u/username" },
  { value: "behance", label: "Behance", icon: SiBehance, placeholder: "https://behance.net/username" },
  { value: "twitter", label: "X / Twitter", icon: null, placeholder: "https://x.com/username" },
  { value: "portfolio", label: "Portfolio", icon: null, placeholder: "https://your-portfolio.com" },
  { value: "other", label: "Other", icon: null, placeholder: "https://..." },
];

function getPlatformMeta(platform: string) {
  return PLATFORM_OPTIONS.find(p => p.value === platform) || PLATFORM_OPTIONS[PLATFORM_OPTIONS.length - 1];
}

interface LinkEntry {
  platform: string;
  url: string;
}

export default function ProfilePage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [links, setLinks] = useState<LinkEntry[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  const { data: existingLinks, isLoading: linksLoading } = useQuery<{ id: number; platform: string; url: string }[]>({
    queryKey: ["/api/students", user?.studentId?.toString(), "social-links"],
    enabled: !!user?.studentId,
  });

  useEffect(() => {
    if (existingLinks) {
      setLinks(existingLinks.map(l => ({ platform: l.platform, url: l.url })));
      setHasChanges(false);
    }
  }, [existingLinks]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const validLinks = links.filter(l => l.url.trim());
      const res = await apiRequest("PUT", `/api/students/${user!.studentId}/social-links`, { links: validLinks });
      return res.json();
    },
    onSuccess: () => {
      setHasChanges(false);
      queryClient.invalidateQueries({ queryKey: ["/api/students", user?.studentId?.toString(), "social-links"] });
      queryClient.invalidateQueries({ queryKey: ["/api/students", user?.studentId?.toString()] });
      toast({ title: "saved", description: "social links updated." });
    },
    onError: () => {
      toast({ title: "error", description: "failed to save links.", variant: "destructive" });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/auth/logout");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/me"] });
      navigate("/");
    },
  });

  function addLink() {
    const usedPlatforms = new Set(links.map(l => l.platform));
    const next = PLATFORM_OPTIONS.find(p => !usedPlatforms.has(p.value));
    if (next) {
      setLinks([...links, { platform: next.value, url: "" }]);
      setHasChanges(true);
    }
  }

  function removeLink(index: number) {
    setLinks(links.filter((_, i) => i !== index));
    setHasChanges(true);
  }

  function updateLink(index: number, field: "platform" | "url", value: string) {
    const updated = [...links];
    updated[index] = { ...updated[index], [field]: value };
    setLinks(updated);
    setHasChanges(true);
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center relative z-10">
        <div className="font-mono text-xs text-muted-foreground">loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 relative z-10">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center font-mono">
          <User className="w-8 h-8 mx-auto mb-3 text-muted-foreground opacity-30" />
          <p className="text-xs text-muted-foreground mb-3">login required to manage your profile</p>
          <a
            href="/auth/google"
            data-testid="button-login-profile"
            className="inline-flex items-center gap-2 px-4 py-2 border border-white/15 hover:border-white/30 text-xs font-mono uppercase tracking-wider transition-all duration-200"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            sign in with iitj.ac.in
          </a>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative z-10">
      <div className="relative max-w-xl mx-auto px-4 py-4">
        <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.2 }}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/")}
            className="mb-4 text-muted-foreground rounded-none text-xs font-mono"
            data-testid="button-back-profile"
          >
            <ArrowLeft className="w-3 h-3 mr-1" /> back
          </Button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="border border-white/8 bg-card p-5 mb-3"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              {user?.pictureUrl ? (
                <img src={user.pictureUrl} alt={user.name} className="w-10 h-10 border border-white/15 object-cover" data-testid="img-profile-avatar" />
              ) : (
                <div className="w-10 h-10 border border-white/15 flex items-center justify-center text-xs font-bold text-muted-foreground">
                  {user?.name?.charAt(0)?.toUpperCase()}
                </div>
              )}
              <div>
                <h1 className="text-sm font-bold font-mono tracking-tight" data-testid="text-profile-name">{user?.name}</h1>
                <p className="text-[10px] text-muted-foreground font-mono" data-testid="text-profile-email">{user?.email}</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
              className="text-[10px] text-muted-foreground rounded-none font-mono"
              data-testid="button-logout"
            >
              <LogOut className="w-3 h-3 mr-1" />
              logout
            </Button>
          </div>

          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-mono">
            <ShieldCheck className="w-3 h-3 text-green-500" />
            <span>verified @iitj.ac.in account</span>
          </div>
          {user?.studentId && (
            <button
              onClick={() => navigate(`/student/${user.studentId}`)}
              className="mt-2 flex items-center gap-1.5 text-[10px] text-muted-foreground hover:text-foreground font-mono transition-colors cursor-pointer"
              data-testid="link-view-profile"
            >
              <ExternalLink className="w-3 h-3" />
              view your public profile
            </button>
          )}
        </motion.div>

        {user?.studentId ? (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="border border-white/8 bg-card p-5 mb-20"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 font-mono">
                <LinkIcon className="w-3.5 h-3.5 text-foreground" />
                <h2 className="font-semibold text-xs uppercase tracking-widest">social links</h2>
              </div>
              {links.length < PLATFORM_OPTIONS.length && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={addLink}
                  className="text-[10px] text-muted-foreground rounded-none font-mono"
                  data-testid="button-add-link"
                >
                  <Plus className="w-3 h-3 mr-1" />
                  add
                </Button>
              )}
            </div>

            {linksLoading ? (
              <p className="text-xs text-muted-foreground font-mono">loading...</p>
            ) : (
              <div className="space-y-3">
                {links.map((link, i) => {
                  const meta = getPlatformMeta(link.platform);
                  return (
                    <div key={i} className="flex items-center gap-2" data-testid={`link-entry-${i}`}>
                      <select
                        value={link.platform}
                        onChange={(e) => updateLink(i, "platform", e.target.value)}
                        className="bg-background border border-white/8 text-xs font-mono px-2 py-1.5 w-24 shrink-0"
                        data-testid={`select-platform-${i}`}
                      >
                        {PLATFORM_OPTIONS.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                      <Input
                        value={link.url}
                        onChange={(e) => updateLink(i, "url", e.target.value)}
                        placeholder={meta.placeholder}
                        className="flex-1 h-8 text-xs bg-background border-white/8 rounded-none font-mono"
                        data-testid={`input-link-url-${i}`}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeLink(i)}
                        className="shrink-0 w-8 h-8 text-muted-foreground hover:text-foreground rounded-none"
                        data-testid={`button-remove-link-${i}`}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  );
                })}

                {links.length === 0 && (
                  <p className="text-[10px] text-muted-foreground font-mono py-2">
                    no links added yet. add your github, linkedin, etc.
                  </p>
                )}

                {hasChanges && (
                  <Button
                    onClick={() => saveMutation.mutate()}
                    disabled={saveMutation.isPending}
                    className="w-full rounded-none text-xs font-mono uppercase tracking-wider mt-2"
                    data-testid="button-save-links"
                  >
                    <Save className={`w-3 h-3 mr-1.5 ${saveMutation.isPending ? "animate-pulse" : ""}`} />
                    {saveMutation.isPending ? "saving..." : "save links"}
                  </Button>
                )}
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="border border-white/8 bg-card p-5 mb-20"
          >
            <p className="text-xs text-muted-foreground font-mono">
              your email wasn't found in the student database. social links require a matching student profile.
            </p>
          </motion.div>
        )}
      </div>
    </div>
  );
}
