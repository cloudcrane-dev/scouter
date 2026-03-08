import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft, Eye, MessageSquare, Mail, Sparkles,
  Send, RefreshCw, User, Zap,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import type { Student, Feedback } from "@shared/schema";

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
    <div className="space-y-1 text-sm text-muted-foreground leading-relaxed">
      {lines.map((line, i) => {
        if (line.startsWith("# ")) return <h1 key={i} className="text-lg font-bold mt-4 mb-1.5 text-foreground">{line.slice(2)}</h1>;
        if (line.startsWith("## ")) return <h2 key={i} className="text-base font-semibold mt-3 mb-1 text-foreground">{line.slice(3)}</h2>;
        if (line.startsWith("### ")) return <h3 key={i} className="text-sm font-semibold mt-2 mb-0.5 text-foreground">{line.slice(4)}</h3>;
        if (line.startsWith("**") && line.endsWith("**")) return <p key={i} className="font-semibold mt-2 mb-0.5 text-foreground">{line.slice(2, -2)}</p>;
        if (line.startsWith("- ")) {
          const text = line.slice(2);
          const boldMatch = text.match(/^\*\*(.*?)\*\*:?\s*(.*)/);
          if (boldMatch) {
            return (
              <div key={i} className="flex gap-2 ml-1 mb-0.5">
                <span className="text-primary mt-0.5 shrink-0 text-xs">&#9679;</span>
                <span><strong className="text-foreground">{boldMatch[1]}</strong>{boldMatch[2] ? `: ${boldMatch[2]}` : ""}</span>
              </div>
            );
          }
          return (
            <div key={i} className="flex gap-2 ml-1 mb-0.5">
              <span className="text-primary mt-0.5 shrink-0 text-xs">&#9679;</span>
              <span>{renderInlineFormatting(text)}</span>
            </div>
          );
        }
        if (line.trim() === "") return <div key={i} className="h-1.5" />;
        return <p key={i} className="mb-0.5">{renderInlineFormatting(line)}</p>;
      })}
    </div>
  );
}

function PulsingOrb() {
  return (
    <div className="flex items-center justify-center gap-1.5 py-6">
      {[0, 1, 2].map(i => (
        <motion.div
          key={i}
          className="w-2 h-2 rounded-full bg-primary"
          animate={{ scale: [1, 1.4, 1], opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
        />
      ))}
    </div>
  );
}

export default function StudentPage() {
  const params = useParams<{ id: string }>();
  const id = parseInt(params.id || "0");
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [feedbackContent, setFeedbackContent] = useState("");

  const { data: student, isLoading: studentLoading } = useQuery<Student>({
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
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/students/${id}/analyze`);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["/api/students", id.toString(), "analyze"], data);
    },
    onError: () => {
      toast({ title: "Analysis failed", description: "Could not generate AI analysis.", variant: "destructive" });
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
      toast({ title: "Insight submitted", description: "Thanks for contributing!" });
    },
    onError: () => {
      toast({ title: "Failed", description: "Could not submit insight.", variant: "destructive" });
    },
  });

  if (studentLoading) {
    return (
      <div className="min-h-screen bg-background p-4 max-w-xl mx-auto pt-6">
        <Skeleton className="h-7 w-16 mb-6 rounded-lg" />
        <div className="flex items-center gap-4 mb-6">
          <Skeleton className="w-16 h-16 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-3.5 w-48" />
          </div>
        </div>
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  }

  if (!student) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <User className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-30" />
          <h2 className="text-lg font-semibold mb-1">Not Found</h2>
          <p className="text-sm text-muted-foreground mb-4">This student doesn't exist.</p>
          <Button onClick={() => navigate("/")} data-testid="button-go-home" size="sm">Go Home</Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background relative">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[400px] h-[400px] bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute top-40 right-0 w-[300px] h-[300px] bg-chart-4/5 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-xl mx-auto px-4 py-4">
        <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.2 }}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/")}
            className="mb-4 text-muted-foreground"
            data-testid="button-back"
          >
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="rounded-2xl bg-card/50 backdrop-blur-sm border border-white/5 p-5 mb-4"
        >
          <div className="flex items-center gap-4">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.1 }}
            >
              <Avatar className="w-16 h-16 ring-2 ring-primary/20">
                <AvatarImage src={student.pictureUrl || undefined} alt={student.name} />
                <AvatarFallback className="text-base font-bold bg-primary/15 text-primary">
                  {getInitials(student.name)}
                </AvatarFallback>
              </Avatar>
            </motion.div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold mb-0.5 truncate" data-testid="text-student-name">
                {student.name}
              </h1>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
                <Mail className="w-3 h-3 shrink-0" />
                <span className="truncate" data-testid="text-student-email">{student.email}</span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="secondary" className="text-xs bg-white/5 border-white/10" data-testid="badge-search-count">
                  <Eye className="w-3 h-3 mr-1" />
                  {student.searchCount}
                </Badge>
                <Badge variant="secondary" className="text-xs bg-white/5 border-white/10" data-testid="badge-feedback-count">
                  <MessageSquare className="w-3 h-3 mr-1" />
                  {student.feedbackCount}
                </Badge>
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="rounded-2xl bg-card/50 backdrop-blur-sm border border-white/5 p-5 mb-4"
        >
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <h2 className="font-semibold text-sm">AI Analysis</h2>
            </div>
            {analysisData && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => analyzeMutation.mutate()}
                disabled={analyzeMutation.isPending}
                data-testid="button-refresh-analysis"
                className="text-xs text-muted-foreground"
              >
                <RefreshCw className={`w-3 h-3 mr-1 ${analyzeMutation.isPending ? "animate-spin" : ""}`} />
                Refresh
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
                className="w-full py-4 rounded-xl bg-gradient-to-r from-primary/10 to-chart-4/10 border border-primary/20 hover:border-primary/40 flex items-center justify-center gap-2 text-sm font-medium text-primary transition-all duration-300 hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
              >
                <Zap className="w-4 h-4" />
                Generate AI Analysis
              </motion.button>
            ) : analyzeMutation.isPending ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <div className="text-center">
                  <PulsingOrb />
                  <p className="text-xs text-muted-foreground">Searching the web & generating insights...</p>
                </div>
              </motion.div>
            ) : analysisData ? (
              <motion.div
                key="result"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                {analysisData.cached && (
                  <Badge variant="secondary" className="mb-2 text-[10px] bg-white/5 border-white/10">
                    cached
                  </Badge>
                )}
                <MarkdownRenderer content={analysisData.analysis} />
              </motion.div>
            ) : null}
          </AnimatePresence>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.25 }}
          className="rounded-2xl bg-card/50 backdrop-blur-sm border border-white/5 p-5 mb-20"
        >
          <div className="flex items-center gap-2 mb-3">
            <MessageSquare className="w-4 h-4 text-primary" />
            <h2 className="font-semibold text-sm">Add Your Insight</h2>
          </div>
          <div className="flex gap-2">
            <Textarea
              data-testid="input-feedback"
              placeholder="Share what you know about this person..."
              value={feedbackContent}
              onChange={(e) => setFeedbackContent(e.target.value)}
              className="min-h-[60px] resize-none text-sm bg-white/5 border-white/10 focus:border-primary/50 rounded-xl flex-1"
              maxLength={2000}
            />
            <Button
              onClick={() => feedbackMutation.mutate()}
              disabled={!feedbackContent.trim() || feedbackMutation.isPending}
              size="icon"
              data-testid="button-submit-feedback"
              className="shrink-0 self-end"
            >
              <Send className={`w-4 h-4 ${feedbackMutation.isPending ? "animate-pulse" : ""}`} />
            </Button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
