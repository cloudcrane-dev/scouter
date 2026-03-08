import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft, Eye, MessageSquare, Phone, Mail, Sparkles,
  Send, RefreshCw, User, Clock,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
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
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    parts.push(<strong key={keyIdx++}>{match[1]}</strong>);
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts.length > 0 ? parts : [text];
}

function MarkdownRenderer({ content }: { content: string }) {
  const lines = content.split("\n");

  return (
    <div className="prose prose-sm dark:prose-invert max-w-none">
      {lines.map((line, i) => {
        if (line.startsWith("# ")) return <h1 key={i} className="text-xl font-bold mt-4 mb-2">{line.slice(2)}</h1>;
        if (line.startsWith("## ")) return <h2 key={i} className="text-lg font-semibold mt-3 mb-1.5">{line.slice(3)}</h2>;
        if (line.startsWith("### ")) return <h3 key={i} className="text-base font-semibold mt-2 mb-1">{line.slice(4)}</h3>;
        if (line.startsWith("**") && line.endsWith("**")) return <p key={i} className="font-semibold mt-2 mb-1">{line.slice(2, -2)}</p>;
        if (line.startsWith("- ")) {
          const text = line.slice(2);
          const boldMatch = text.match(/^\*\*(.*?)\*\*:?\s*(.*)/);
          if (boldMatch) {
            return (
              <div key={i} className="flex gap-2 ml-2 mb-1">
                <span className="text-primary mt-1.5 shrink-0">&#8226;</span>
                <span><strong>{boldMatch[1]}</strong>{boldMatch[2] ? `: ${boldMatch[2]}` : ""}</span>
              </div>
            );
          }
          return (
            <div key={i} className="flex gap-2 ml-2 mb-1">
              <span className="text-primary mt-1.5 shrink-0">&#8226;</span>
              <span>{renderInlineFormatting(text)}</span>
            </div>
          );
        }
        if (line.trim() === "") return <div key={i} className="h-2" />;
        return <p key={i} className="mb-1">{renderInlineFormatting(line)}</p>;
      })}
    </div>
  );
}

export default function StudentPage() {
  const params = useParams<{ id: string }>();
  const id = parseInt(params.id || "0");
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [feedbackContent, setFeedbackContent] = useState("");
  const [authorName, setAuthorName] = useState("");

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

  const { data: analysisData, isLoading: analysisLoading, refetch: refetchAnalysis } = useQuery<{
    analysis: string;
    cached: boolean;
  }>({
    queryKey: ["/api/students", id.toString(), "analyze"],
    enabled: false,
  });

  const { data: feedbackList, isLoading: feedbackLoading } = useQuery<Feedback[]>({
    queryKey: ["/api/students", id.toString(), "feedback"],
    enabled: id > 0,
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
      toast({ title: "Analysis failed", description: "Could not generate AI analysis. Please try again.", variant: "destructive" });
    },
  });

  const feedbackMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/students/${id}/feedback`, {
        content: feedbackContent,
        authorName: authorName || null,
      });
      return res.json();
    },
    onSuccess: () => {
      setFeedbackContent("");
      queryClient.invalidateQueries({ queryKey: ["/api/students", id.toString(), "feedback"] });
      queryClient.invalidateQueries({ queryKey: ["/api/students", id.toString()] });
      queryClient.invalidateQueries({ queryKey: ["/api/leaderboard"] });
      toast({ title: "Feedback submitted", description: "Your insight has been recorded." });
    },
    onError: () => {
      toast({ title: "Failed to submit", description: "Could not submit feedback. Please try again.", variant: "destructive" });
    },
  });

  if (studentLoading) {
    return (
      <div className="min-h-screen bg-background p-4 max-w-2xl mx-auto">
        <Skeleton className="h-8 w-24 mb-6" />
        <Card className="p-6">
          <div className="flex items-center gap-4 mb-6">
            <Skeleton className="w-20 h-20 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-4 w-56" />
              <Skeleton className="h-4 w-36" />
            </div>
          </div>
        </Card>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="p-8 text-center max-w-sm">
          <User className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-40" />
          <h2 className="text-lg font-semibold mb-2">Student Not Found</h2>
          <p className="text-sm text-muted-foreground mb-4">The student you are looking for does not exist.</p>
          <Button onClick={() => navigate("/")} data-testid="button-go-home">Go Home</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/")}
          className="mb-4"
          data-testid="button-back"
        >
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>

        <Card className="p-5 mb-4">
          <div className="flex items-start gap-4">
            <Avatar className="w-16 h-16 sm:w-20 sm:h-20">
              <AvatarImage src={student.pictureUrl || undefined} alt={student.name} />
              <AvatarFallback className="text-lg font-bold bg-primary/10 text-primary">
                {getInitials(student.name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold mb-1 truncate" data-testid="text-student-name">
                {student.name}
              </h1>
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Mail className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate" data-testid="text-student-email">{student.email}</span>
                </div>
                {student.phone && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Phone className="w-3.5 h-3.5 shrink-0" />
                    <span data-testid="text-student-phone">{student.phone}</span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                <Badge variant="secondary" data-testid="badge-search-count">
                  <Eye className="w-3 h-3 mr-1" />
                  {student.searchCount} searches
                </Badge>
                <Badge variant="secondary" data-testid="badge-feedback-count">
                  <MessageSquare className="w-3 h-3 mr-1" />
                  {student.feedbackCount} feedback
                </Badge>
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-5 mb-4">
          <div className="flex items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <h2 className="font-semibold">AI Analysis</h2>
            </div>
            {analysisData && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => analyzeMutation.mutate()}
                disabled={analyzeMutation.isPending}
                data-testid="button-refresh-analysis"
              >
                <RefreshCw className={`w-3.5 h-3.5 mr-1 ${analyzeMutation.isPending ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            )}
          </div>

          {!analysisData && !analyzeMutation.isPending ? (
            <div className="text-center py-8">
              <Sparkles className="w-10 h-10 mx-auto mb-3 text-primary opacity-50" />
              <p className="text-sm text-muted-foreground mb-4">
                Generate an AI-powered analysis using web search and peer feedback
              </p>
              <Button
                onClick={() => analyzeMutation.mutate()}
                data-testid="button-generate-analysis"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Generate Analysis
              </Button>
            </div>
          ) : analyzeMutation.isPending ? (
            <div className="space-y-3 py-4">
              <div className="flex items-center gap-3 justify-center text-sm text-muted-foreground">
                <RefreshCw className="w-4 h-4 animate-spin text-primary" />
                <span>Searching the web and generating insights...</span>
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-4/6" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            </div>
          ) : analysisData ? (
            <div>
              {analysisData.cached && (
                <Badge variant="secondary" className="mb-3 text-xs">
                  <Clock className="w-3 h-3 mr-1" /> Cached result
                </Badge>
              )}
              <MarkdownRenderer content={analysisData.analysis} />
            </div>
          ) : null}
        </Card>

        <Card className="p-5 mb-4">
          <div className="flex items-center gap-2 mb-4">
            <MessageSquare className="w-4 h-4 text-primary" />
            <h2 className="font-semibold">Add Your Insight</h2>
          </div>
          <div className="space-y-3">
            <Input
              data-testid="input-author-name"
              placeholder="Your name (optional)"
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
            />
            <Textarea
              data-testid="input-feedback"
              placeholder="Share your insights about this person... e.g., strengths, skills, projects, personality"
              value={feedbackContent}
              onChange={(e) => setFeedbackContent(e.target.value)}
              className="min-h-[80px] resize-none"
            />
            <Button
              onClick={() => feedbackMutation.mutate()}
              disabled={!feedbackContent.trim() || feedbackMutation.isPending}
              className="w-full sm:w-auto"
              data-testid="button-submit-feedback"
            >
              <Send className="w-4 h-4 mr-2" />
              {feedbackMutation.isPending ? "Submitting..." : "Submit Feedback"}
            </Button>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <MessageSquare className="w-4 h-4 text-primary" />
            <h2 className="font-semibold">Peer Feedback</h2>
            {feedbackList && feedbackList.length > 0 && (
              <Badge variant="secondary" className="text-xs">{feedbackList.length}</Badge>
            )}
          </div>

          {feedbackLoading ? (
            <div className="space-y-3">
              {[1, 2].map(i => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-3 w-20" />
                </div>
              ))}
            </div>
          ) : feedbackList && feedbackList.length > 0 ? (
            <div className="space-y-3">
              {feedbackList.map((fb, index) => (
                <div key={fb.id}>
                  {index > 0 && <Separator className="mb-3" />}
                  <div data-testid={`feedback-item-${fb.id}`}>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-sm font-medium">
                        {fb.authorName || "Anonymous"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(fb.createdAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">{fb.content}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-muted-foreground">
              <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No feedback yet. Be the first to share your insights!</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
