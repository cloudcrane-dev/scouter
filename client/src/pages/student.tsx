import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft, Eye, MessageSquare, Mail, Sparkles,
  Send, RefreshCw, User, Terminal, ShieldCheck, ExternalLink,
} from "lucide-react";
import { SiGithub, SiLinkedin, SiLeetcode, SiBehance } from "react-icons/si";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import type { Student } from "@shared/schema";

function getInitials(name: string) {
  return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
}

function renderInlineFormatting(text: string) {
  const parts: (string | JSX.Element)[] = [];
  const regex = /\*\*(.*?)\*\*/g;
  let lastIndex = 0;
  let match;
  let keyIdx = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    parts.push(<strong key={keyIdx++} className="text-foreground">{match[1]}</strong>);
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts.length > 0 ? parts : [text];
}

function MarkdownRenderer({ content }: { content: string }) {
  const lines = content.split("\n");
  return (
    <div className="space-y-1 text-xs text-muted-foreground leading-relaxed font-mono">
      {lines.map((line, i) => {
        if (line.startsWith("# ")) return <h1 key={i} className="text-sm font-bold mt-3 mb-1 text-foreground tracking-tight">{line.slice(2)}</h1>;
        if (line.startsWith("## ")) return <h2 key={i} className="text-xs font-bold mt-2 mb-1 text-foreground uppercase tracking-widest">{line.slice(3)}</h2>;
        if (line.startsWith("### ")) return <h3 key={i} className="text-xs font-semibold mt-2 mb-0.5 text-foreground">{line.slice(4)}</h3>;
        if (line.startsWith("**") && line.endsWith("**")) return <p key={i} className="font-semibold mt-2 mb-0.5 text-foreground text-xs">{line.slice(2, -2)}</p>;
        if (line.startsWith("- ")) {
          const text = line.slice(2);
          const boldMatch = text.match(/^\*\*(.*?)\*\*:?\s*(.*)/);
          if (boldMatch) {
            return (
              <div key={i} className="flex gap-2 ml-2 mb-0.5">
                <span className="text-muted-foreground mt-0.5 shrink-0 text-[10px]">&gt;</span>
                <span><strong className="text-foreground">{boldMatch[1]}</strong>{boldMatch[2] ? `: ${boldMatch[2]}` : ""}</span>
              </div>
            );
          }
          return (
            <div key={i} className="flex gap-2 ml-2 mb-0.5">
              <span className="text-muted-foreground mt-0.5 shrink-0 text-[10px]">&gt;</span>
              <span>{renderInlineFormatting(text)}</span>
            </div>
          );
        }
        if (line.trim() === "") return <div key={i} className="h-1" />;
        return <p key={i} className="mb-0.5">{renderInlineFormatting(line)}</p>;
      })}
    </div>
  );
}

function TerminalLoader() {
  const [dots, setDots] = useState("");
  useEffect(() => {
    const interval = setInterval(() => {
      setDots(d => d.length >= 3 ? "" : d + ".");
    }, 400);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="py-6 font-mono text-xs text-muted-foreground">
      <div className="flex items-center gap-2">
        <span className="text-foreground">$</span>
        <span>scanning web{dots}</span>
        <span className="cursor-blink">_</span>
      </div>
      <div className="mt-1 text-[10px] text-muted-foreground/50">
        web search + social profiles + gpt analysis in progress
      </div>
    </div>
  );
}

const PLATFORM_ICONS: Record<string, { icon: any; label: string }> = {
  github: { icon: SiGithub, label: "GitHub" },
  linkedin: { icon: SiLinkedin, label: "LinkedIn" },
  leetcode: { icon: SiLeetcode, label: "LeetCode" },
  behance: { icon: SiBehance, label: "Behance" },
  twitter: { icon: null, label: "X" },
  portfolio: { icon: null, label: "Portfolio" },
  other: { icon: null, label: "Link" },
};

interface StudentWithLinks extends Student {
  socialLinks?: { platform: string; url: string }[];
  claimed?: boolean;
}

export default function StudentPage() {
  const params = useParams<{ id: string }>();
  const id = parseInt(params.id || "0");
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { isAuthenticated, user } = useAuth();
  const [feedbackContent, setFeedbackContent] = useState("");

  const { data: student, isLoading: studentLoading } = useQuery<StudentWithLinks>({
    queryKey: ["/api/students", id.toString()],
    enabled: id > 0,
  });

  const viewedRef = useRef(false);
  useEffect(() => {
    if (id > 0 && !viewedRef.current) {
      viewedRef.current = true;
      apiRequest("POST", `/api/students/${id}/view`).catch(() => {});
    }
  }, [id]);

  const { data: analysisData } = useQuery<{ analysis: string; cached: boolean }>({
    queryKey: ["/api/students", id.toString(), "analyze"],
    enabled: false,
  });

  const analyzeMutation = useMutation({
    mutationFn: async (force = false) => {
      const url = force ? `/api/students/${id}/analyze?force=true` : `/api/students/${id}/analyze`;
      const res = await apiRequest("POST", url);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["/api/students", id.toString(), "analyze"], data);
      queryClient.invalidateQueries({ queryKey: ["/api/search-limit"] });
    },
    onError: (error: any) => {
      const msg = error?.message?.includes("429")
        ? "daily scan limit reached. try again tomorrow."
        : "analysis failed. try again.";
      toast({ title: "error", description: msg, variant: "destructive" });
    },
  });

  const feedbackMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/students/${id}/feedback`, {
        content: feedbackContent,
        authorName: null,
      });
      return res.json();
    },
    onSuccess: () => {
      setFeedbackContent("");
      queryClient.invalidateQueries({ queryKey: ["/api/students", id.toString(), "feedback"] });
      queryClient.invalidateQueries({ queryKey: ["/api/students", id.toString()] });
      queryClient.invalidateQueries({ queryKey: ["/api/leaderboard"] });
      toast({ title: "transmitted", description: "insight recorded." });
    },
    onError: () => {
      toast({ title: "error", description: "transmission failed.", variant: "destructive" });
    },
  });

  if (studentLoading) {
    return (
      <div className="min-h-screen p-4 max-w-xl mx-auto pt-6 relative z-10">
        <Skeleton className="h-6 w-16 mb-6 rounded-none" />
        <div className="space-y-3">
          <Skeleton className="h-4 w-36 rounded-none" />
          <Skeleton className="h-3 w-48 rounded-none" />
          <Skeleton className="h-32 w-full rounded-none" />
        </div>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 relative z-10">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center font-mono">
          <User className="w-8 h-8 mx-auto mb-3 text-muted-foreground opacity-30" />
          <p className="text-xs text-muted-foreground mb-1">404 // node not found</p>
          <Button onClick={() => navigate("/")} data-testid="button-go-home" size="sm" className="rounded-none text-xs mt-2">
            &lt; return
          </Button>
        </motion.div>
      </div>
    );
  }

  const socialLinks = student.socialLinks || [];

  return (
    <div className="min-h-screen relative z-10">
      <div className="relative max-w-xl mx-auto px-4 py-4">
        <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.2 }}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/")}
            className="mb-4 text-muted-foreground rounded-none text-xs font-mono"
            data-testid="button-back"
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
          <div className="flex items-start gap-4">
            {student.pictureUrl ? (
              <img
                src={student.pictureUrl}
                alt={student.name}
                data-testid="img-student-avatar"
                className="w-14 h-14 border border-white/15 object-cover shrink-0"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden"); }}
              />
            ) : null}
            <div className={`w-14 h-14 border border-white/15 flex items-center justify-center text-sm font-bold text-muted-foreground shrink-0 tracking-wider ${student.pictureUrl ? "hidden" : ""}`}>
              {getInitials(student.name)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <h1 className="text-base font-bold tracking-tight font-mono" data-testid="text-student-name" style={{ fontVariationSettings: "'wght' 700" }}>
                  {student.name}
                </h1>
                {student.claimed && (
                  <span data-testid="badge-verified" aria-label="Verified profile">
                    <ShieldCheck className="w-3.5 h-3.5 text-green-500 shrink-0" />
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mb-1 font-mono">
                <Mail className="w-3 h-3 shrink-0" />
                <span className="truncate" data-testid="text-student-email">{student.email}</span>
              </div>
              {student.rollNumber && (
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mb-2 font-mono">
                  <Terminal className="w-3 h-3 shrink-0" />
                  <span data-testid="text-student-roll">{student.rollNumber}</span>
                </div>
              )}
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1 text-[10px] text-muted-foreground font-mono" data-testid="badge-search-count">
                  <Eye className="w-3 h-3" />
                  {student.searchCount} views
                </span>
                <span className="flex items-center gap-1 text-[10px] text-muted-foreground font-mono" data-testid="badge-feedback-count">
                  <MessageSquare className="w-3 h-3" />
                  {student.feedbackCount} insights
                </span>
              </div>
            </div>
          </div>

          {student.claimed && socialLinks.length > 0 && (
            <div className="mt-3 pt-3 border-t border-white/5">
              <div className="flex flex-wrap gap-2">
                {socialLinks.map((link, i) => {
                  const meta = PLATFORM_ICONS[link.platform] || PLATFORM_ICONS.other;
                  const Icon = meta.icon;
                  return (
                    <a
                      key={i}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      data-testid={`social-link-${link.platform}`}
                      className="inline-flex items-center gap-1.5 px-2 py-1 border border-white/8 hover:border-white/20 text-[10px] text-muted-foreground hover:text-foreground font-mono transition-all duration-150"
                    >
                      {Icon ? <Icon className="w-3 h-3" /> : <ExternalLink className="w-3 h-3" />}
                      {meta.label}
                    </a>
                  );
                })}
              </div>
            </div>
          )}

          {!isAuthenticated && (
            <div className="mt-3 pt-3 border-t border-white/5">
              <a
                href="/auth/google"
                data-testid="button-claim-profile"
                className="inline-flex items-center gap-1.5 text-[10px] text-muted-foreground hover:text-foreground font-mono transition-colors"
              >
                <ShieldCheck className="w-3 h-3" />
                {student.claimed ? "login with @iitj.ac.in" : "is this you? login with @iitj.ac.in to claim"}
              </a>
            </div>
          )}

          {!student.claimed && isAuthenticated && user?.studentId === id && (
            <div className="mt-3 pt-3 border-t border-white/5">
              <button
                onClick={() => navigate("/profile")}
                data-testid="button-setup-profile"
                className="inline-flex items-center gap-1.5 text-[10px] text-muted-foreground hover:text-foreground font-mono transition-colors cursor-pointer"
              >
                <ShieldCheck className="w-3 h-3" />
                add your social links to claim this profile
              </button>
            </div>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="border border-white/8 bg-card p-5 mb-3"
        >
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2 font-mono">
              <Sparkles className="w-3.5 h-3.5 text-foreground" />
              <h2 className="font-semibold text-xs uppercase tracking-widest">analysis</h2>
            </div>
            {analysisData && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => analyzeMutation.mutate(true)}
                disabled={analyzeMutation.isPending}
                data-testid="button-refresh-analysis"
                className="text-[10px] text-muted-foreground rounded-none font-mono"
              >
                <RefreshCw className={`w-3 h-3 mr-1 ${analyzeMutation.isPending ? "animate-spin" : ""}`} />
                rescan
              </Button>
            )}
          </div>

          <AnimatePresence mode="wait">
            {!analysisData && !analyzeMutation.isPending ? (
              <motion.button
                key="generate"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => analyzeMutation.mutate()}
                data-testid="button-generate-analysis"
                className="w-full py-3 border border-white/10 hover:border-white/25 flex items-center justify-center gap-2 text-xs font-mono text-muted-foreground hover:text-foreground transition-all duration-200 active:scale-[0.99] cursor-pointer tracking-wider uppercase"
              >
                <Terminal className="w-3.5 h-3.5" />
                $ run analysis
              </motion.button>
            ) : analyzeMutation.isPending ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <TerminalLoader />
              </motion.div>
            ) : analysisData ? (
              <motion.div
                key="result"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                {analysisData.cached && (
                  <span className="inline-block text-[9px] font-mono text-muted-foreground/50 border border-white/5 px-1.5 py-0.5 mb-2 uppercase tracking-widest">
                    cached
                  </span>
                )}
                <MarkdownRenderer content={analysisData.analysis} />
              </motion.div>
            ) : null}
          </AnimatePresence>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="border border-white/8 bg-card p-5 mb-20"
        >
          <div className="flex items-center gap-2 mb-3 font-mono">
            <MessageSquare className="w-3.5 h-3.5 text-foreground" />
            <h2 className="font-semibold text-xs uppercase tracking-widest">add insight</h2>
          </div>
          <div className="flex gap-2">
            <Textarea
              data-testid="input-feedback"
              placeholder="transmit intel..."
              value={feedbackContent}
              onChange={(e) => setFeedbackContent(e.target.value)}
              className="min-h-[56px] resize-none text-xs bg-background border-white/8 focus:border-white/20 rounded-none flex-1 font-mono"
              maxLength={2000}
            />
            <Button
              onClick={() => feedbackMutation.mutate()}
              disabled={!feedbackContent.trim() || feedbackMutation.isPending}
              size="icon"
              data-testid="button-submit-feedback"
              className="shrink-0 self-end rounded-none"
            >
              <Send className={`w-3.5 h-3.5 ${feedbackMutation.isPending ? "animate-pulse" : ""}`} />
            </Button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
