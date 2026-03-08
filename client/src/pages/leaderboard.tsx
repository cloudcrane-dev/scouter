import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy, Eye, MessageSquare, ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";
import type { Student } from "@shared/schema";

function getInitials(name: string) {
  return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
}

export default function LeaderboardPage() {
  const [sortBy, setSortBy] = useState<"searches" | "feedback">("searches");
  const [, navigate] = useLocation();

  const { data: leaderboard, isLoading } = useQuery<Student[]>({
    queryKey: ["/api/leaderboard", `?sort=${sortBy}&limit=20`],
  });

  return (
    <div className="min-h-screen relative z-10">
      <div className="relative max-w-xl mx-auto px-4 py-4">
        <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.2 }}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/")}
            className="mb-4 text-muted-foreground rounded-none text-xs font-mono"
            data-testid="button-back-leaderboard"
          >
            <ArrowLeft className="w-3 h-3 mr-1" /> back
          </Button>
        </motion.div>

        <motion.div
          className="text-center mb-6"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <Trophy className="w-6 h-6 mx-auto mb-2 text-foreground" />
          <h1 className="text-xl font-bold tracking-tighter font-mono uppercase" style={{ fontVariationSettings: "'wght' 800" }}>
            Leaderboard
          </h1>
          <p className="text-[10px] text-muted-foreground mt-1 font-mono uppercase tracking-[0.2em]">
            ranked by activity
          </p>
        </motion.div>

        <motion.div
          className="flex items-center justify-center gap-0 mb-5 max-w-xs mx-auto border border-white/8"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <button
            onClick={() => setSortBy("searches")}
            data-testid="button-sort-searches"
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 text-[10px] font-mono uppercase tracking-widest transition-all duration-200 cursor-pointer border-r border-white/8 ${
              sortBy === "searches"
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Eye className="w-3 h-3" />
            views
          </button>
          <button
            onClick={() => setSortBy("feedback")}
            data-testid="button-sort-feedback"
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 text-[10px] font-mono uppercase tracking-widest transition-all duration-200 cursor-pointer ${
              sortBy === "feedback"
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <MessageSquare className="w-3 h-3" />
            intel
          </button>
        </motion.div>

        {isLoading ? (
          <div className="space-y-0">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="border-b border-white/5 p-3">
                <div className="flex items-center gap-3">
                  <Skeleton className="w-5 h-5 rounded-none" />
                  <Skeleton className="w-8 h-8 rounded-none" />
                  <div className="flex-1 space-y-1">
                    <Skeleton className="h-3 w-28 rounded-none" />
                    <Skeleton className="h-2.5 w-40 rounded-none" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : leaderboard && leaderboard.length > 0 ? (
          <div className="border border-white/8 mb-20">
            {leaderboard.map((student, index) => (
              <motion.div
                key={student.id}
                data-testid={`card-leaderboard-${student.id}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + index * 0.03 }}
                className="group px-3 py-2.5 cursor-pointer transition-all duration-150 hover:bg-white/3 border-b border-white/5 last:border-b-0"
                onClick={() => navigate(`/student/${student.id}`)}
              >
                <div className="flex items-center gap-3">
                  <span className={`w-6 text-center font-mono text-xs shrink-0 ${
                    index === 0 ? "text-foreground font-bold" :
                    index === 1 ? "text-foreground/80 font-semibold" :
                    index === 2 ? "text-foreground/60 font-semibold" :
                    "text-muted-foreground/50"
                  }`}>
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div className="w-8 h-8 border border-white/10 flex items-center justify-center text-[9px] font-bold text-muted-foreground shrink-0">
                    {getInitials(student.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-xs tracking-wide group-hover:text-foreground transition-colors duration-150">{student.name}</p>
                    <p className="text-[10px] text-muted-foreground truncate font-mono">{student.email}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 text-[10px] text-muted-foreground font-mono">
                    <span className="flex items-center gap-1">
                      <Eye className="w-3 h-3" />
                      {student.searchCount}
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageSquare className="w-3 h-3" />
                      {student.feedbackCount}
                    </span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="border border-white/8 p-8 text-center text-muted-foreground font-mono">
            <p className="text-xs">no data available</p>
          </div>
        )}
      </div>
    </div>
  );
}
