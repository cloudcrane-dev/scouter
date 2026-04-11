import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft, Eye, MessageSquare, Mail, Sparkles,
  RefreshCw, User, Terminal, Lock, ThumbsUp, Upload, Download,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/use-auth";
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
        tavily search + gpt analysis in progress
      </div>
    </div>
  );
}

export default function StudentPage() {
  const params = useParams<{ id: string }>();
  const id = parseInt(params.id || "0");
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { isLoggedIn } = useAuth();
  const [resumeFile, setResumeFile] = useState<File | null>(null);

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

  const { data: upvoteStatus } = useQuery<{ upvoteCount: number; hasUpvoted: boolean }>({
    queryKey: ["/api/students", id.toString(), "upvote-status"],
    enabled: id > 0,
  });

  const { data: latestResumeRating } = useQuery<{
    rating: number;
    summary: string;
    improvementFactors: string[];
    fileName: string;
    createdAt: string;
  } | null>({
    queryKey: ["/api/students", id.toString(), "resume-rating", "me"],
    enabled: id > 0 && isLoggedIn,
  });

  const { data: profileResumes } = useQuery<Array<{
    id: number;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    uploadedBy: string;
    createdAt: string;
  }>>({
    queryKey: ["/api/students", id.toString(), "resumes"],
    enabled: id > 0 && isLoggedIn,
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
      toast({ title: "error", description: "analysis failed. try again.", variant: "destructive" });
    },
  });

  const upvoteMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/students/${id}/upvote`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/students", id.toString(), "upvote-status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/students", id.toString()] });
      queryClient.invalidateQueries({ queryKey: ["/api/leaderboard"] });
      toast({ title: "upvoted", description: "profile vote recorded." });
    },
    onError: () => {
      toast({ title: "error", description: "upvote failed or already used.", variant: "destructive" });
    },
  });

  const resumeRatingMutation = useMutation({
    mutationFn: async () => {
      if (!resumeFile) {
        throw new Error("No file selected");
      }
      const resumeText = (await resumeFile.text()).trim();
      const res = await apiRequest("POST", `/api/students/${id}/resume-rating`, {
        resumeText,
        fileName: resumeFile.name,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/students", id.toString(), "resume-rating", "me"] });
      toast({ title: "rated", description: "resume score generated." });
    },
    onError: () => {
      toast({ title: "error", description: "resume rating failed.", variant: "destructive" });
    },
  });

  const resumeUploadMutation = useMutation({
    mutationFn: async () => {
      if (!resumeFile) {
        throw new Error("No file selected");
      }
      const bytes = new Uint8Array(await resumeFile.arrayBuffer());
      let binary = "";
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const contentBase64 = btoa(binary);

      const res = await apiRequest("POST", `/api/students/${id}/resumes`, {
        fileName: resumeFile.name,
        mimeType: resumeFile.type || "application/octet-stream",
        sizeBytes: resumeFile.size,
        contentBase64,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/students", id.toString(), "resumes"] });
      toast({ title: "uploaded", description: "resume is now visible to other users." });
    },
    onError: () => {
      toast({ title: "error", description: "resume upload failed.", variant: "destructive" });
    },
  });

  function downloadResume(resumeId: number) {
    window.open(`/api/students/${id}/resumes/${resumeId}/download`, "_blank");
  }

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
            <div className="w-14 h-14 border border-white/15 flex items-center justify-center text-sm font-bold text-muted-foreground shrink-0 tracking-wider">
              {getInitials(student.name)}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-base font-bold tracking-tight mb-0.5 font-mono" data-testid="text-student-name" style={{ fontVariationSettings: "'wght' 700" }}>
                {student.name}
              </h1>
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mb-2 font-mono">
                <Mail className="w-3 h-3 shrink-0" />
                <span className="truncate" data-testid="text-student-email">{student.email}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1 text-[10px] text-muted-foreground font-mono" data-testid="badge-search-count">
                  <Eye className="w-3 h-3" />
                  {student.searchCount} views
                </span>
                <span className="flex items-center gap-1 text-[10px] text-muted-foreground font-mono" data-testid="badge-upvote-count">
                  <ThumbsUp className="w-3 h-3" />
                  {upvoteStatus?.upvoteCount ?? student.upvoteCount} upvotes
                </span>
              </div>
            </div>
          </div>
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
                onClick={() => analyzeMutation.mutate()}
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
            <Upload className="w-3.5 h-3.5 text-foreground" />
            <h2 className="font-semibold text-xs uppercase tracking-widest">resume rating + upvote</h2>
          </div>

          {!isLoggedIn ? (
            <div className="border border-white/10 px-3 py-3 text-xs text-muted-foreground font-mono flex items-center gap-2">
              <Lock className="w-3.5 h-3.5" />
              login required for upvoting profiles and resume rating
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => upvoteMutation.mutate()}
                  disabled={upvoteMutation.isPending || Boolean(upvoteStatus?.hasUpvoted)}
                  size="sm"
                  data-testid="button-upvote"
                  className="rounded-none text-xs font-mono"
                >
                  <ThumbsUp className="w-3.5 h-3.5 mr-1" />
                  {upvoteStatus?.hasUpvoted ? "upvoted" : "upvote profile"}
                </Button>
                <span className="text-[10px] text-muted-foreground font-mono">
                  votes: {upvoteStatus?.upvoteCount ?? student.upvoteCount}
                </span>
              </div>

              <div className="flex gap-2 items-center">
                <Input
                  type="file"
                  data-testid="input-resume-file"
                  className="rounded-none text-xs font-mono border-white/10"
                  onChange={(e) => setResumeFile(e.target.files?.[0] ?? null)}
                />
                <Button
                  onClick={() => resumeRatingMutation.mutate()}
                  disabled={!resumeFile || resumeRatingMutation.isPending}
                  size="sm"
                  data-testid="button-rate-resume"
                  className="rounded-none text-xs font-mono"
                >
                  {resumeRatingMutation.isPending ? "rating..." : "rate resume"}
                </Button>
                <Button
                  onClick={() => resumeUploadMutation.mutate()}
                  disabled={!resumeFile || resumeUploadMutation.isPending}
                  size="sm"
                  data-testid="button-upload-resume"
                  className="rounded-none text-xs font-mono"
                  variant="outline"
                >
                  {resumeUploadMutation.isPending ? "uploading..." : "upload profile resume"}
                </Button>
              </div>

              <div className="border border-white/10 p-3 font-mono space-y-2">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">profile resumes</div>
                {profileResumes && profileResumes.length > 0 ? (
                  <div className="space-y-2">
                    {profileResumes.map((resume) => (
                      <div key={resume.id} className="flex items-center justify-between gap-2 border border-white/5 p-2">
                        <div className="min-w-0">
                          <div className="text-xs truncate">{resume.fileName}</div>
                          <div className="text-[10px] text-muted-foreground">
                            by @{resume.uploadedBy} • {(resume.sizeBytes / 1024).toFixed(1)} KB
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="rounded-none text-xs font-mono"
                          onClick={() => downloadResume(resume.id)}
                          data-testid={`button-download-resume-${resume.id}`}
                        >
                          <Download className="w-3.5 h-3.5 mr-1" />
                          download
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground">no resumes uploaded yet</div>
                )}
              </div>

              {latestResumeRating && (
                <div className="border border-white/10 p-3 font-mono space-y-2">
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">latest rating</div>
                  <div className="text-sm font-bold">{latestResumeRating.rating}/100</div>
                  <p className="text-xs text-muted-foreground">{latestResumeRating.summary}</p>
                  <div className="space-y-1">
                    {latestResumeRating.improvementFactors.map((factor, idx) => (
                      <div key={idx} className="text-xs text-muted-foreground">- {factor}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
