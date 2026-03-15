import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Eye, Terminal, Shield, MessageSquare, Trophy, CheckCircle, Smile } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { Student } from "@shared/schema";
import { PERSONALITY_TRAITS } from "@shared/schema";

type LeaderboardEntry = Student & { verified?: boolean };
type PersonalityEntry = {
  id: number; name: string; email: string; rollNumber: string | null;
  pictureUrl: string | null; searchCount: number; feedbackCount: number; profileStrength: number | null;
  raterCount: number; verified: boolean;
  dominantTrait: { key: string; label: string; emoji: string; score: number } | null;
  traitScore: number;
};

function getInitials(name: string) {
  return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
}

export default function HomePage() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [limitHit, setLimitHit] = useState(false);
  const [sortBy, setSortBy] = useState<"searches" | "strength" | "personality">("strength");
  const [leaderboardLimit, setLeaderboardLimit] = useState(20);
  const [traitFilter, setTraitFilter] = useState<string | null>(null);
  const [, navigate] = useLocation();
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 500);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
        setIsFocused(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const { data: searchLimit } = useQuery<{ used: number; limit: number; remaining: number }>({
    queryKey: ["/api/search-limit"],
    refetchInterval: 30000,
  });

  const { data: results, isLoading: searchLoading, error } = useQuery<Student[]>({
    queryKey: ["/api/students/search", `?q=${debouncedQuery}`],
    enabled: debouncedQuery.length >= 2 && !limitHit,
    retry: false,
  });

  useEffect(() => {
    if (error && (error as any)?.message?.includes("429")) {
      setLimitHit(true);
    }
  }, [error]);

  const { data: stats } = useQuery<{ totalStudents: number; dau: number; mau: number; vau: number }>({
    queryKey: ["/api/stats"],
    refetchInterval: 60000,
  });

  const leaderboardQs = sortBy === "personality" && traitFilter
    ? `?sort=${sortBy}&trait=${traitFilter}&limit=${leaderboardLimit}`
    : `?sort=${sortBy}&limit=${leaderboardLimit}`;
  const { data: leaderboard, isLoading: leaderboardLoading } = useQuery<(LeaderboardEntry | PersonalityEntry)[]>({
    queryKey: ["/api/leaderboard", leaderboardQs],
  });

  function handleSelect(student: Student) {
    setShowDropdown(false);
    setQuery("");
    navigate(`/student/${student.id}`);
  }

  const remaining = searchLimit?.remaining ?? 200;
  const limit = searchLimit?.limit ?? 200;
  const pct = (remaining / limit) * 100;
  const isSearching = debouncedQuery.length >= 2 || query.length >= 1;
  const hasMore = (leaderboard?.length ?? 0) >= leaderboardLimit;

  return (
    <div className="min-h-screen relative z-10">
      <div className="max-w-xl mx-auto px-4 pt-16 pb-24 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="flex flex-wrap items-center justify-center gap-2 mb-6"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 border border-white/10 text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-mono">
            <Terminal className="w-3 h-3" />
            <span>{stats?.totalStudents ?? "..."} nodes indexed</span>
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 border border-white/6 text-[10px] font-mono text-muted-foreground/70 uppercase tracking-widest">
            <span className="text-foreground font-semibold">{stats?.dau ?? "—"}</span>
            <span>dau</span>
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 border border-white/6 text-[10px] font-mono text-muted-foreground/70 uppercase tracking-widest">
            <span className="text-foreground font-semibold">{stats?.mau ?? "—"}</span>
            <span>mau</span>
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 border border-white/6 text-[10px] font-mono text-muted-foreground/70 uppercase tracking-widest">
            <span className="text-foreground font-semibold">{stats?.vau ?? "—"}</span>
            <span>verified</span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tighter mb-1 text-foreground" style={{ fontVariationSettings: "'wght' 800" }}>
            IIT JODHPUR
          </h1>
          <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground mb-6 font-mono">
            student intelligence system
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="mb-6"
        >
          <div className="inline-flex items-center gap-3 px-4 py-2 border border-white/8 bg-card font-mono" data-testid="search-limit-counter">
            <Shield className="w-3.5 h-3.5 text-muted-foreground" />
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground">scans left</span>
              <span className={`text-xs font-bold ${remaining <= 20 ? "text-foreground" : "text-muted-foreground"}`}>
                {remaining}/{limit}
              </span>
            </div>
            <div className="w-20 h-1 bg-white/5 overflow-hidden">
              <motion.div
                className={`h-full ${remaining <= 20 ? "bg-foreground" : "bg-white/30"}`}
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
          </div>
        </motion.div>

        <motion.div
          className="relative text-left"
          ref={dropdownRef}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <div className={`relative transition-all duration-300 ${isFocused ? "scale-[1.01]" : "scale-100"}`}>
            <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors duration-200 ${isFocused ? "text-foreground" : "text-muted-foreground"}`} />
            <Input
              data-testid="input-search"
              type="search"
              placeholder="target name, email or roll number..."
              className="pl-10 pr-4 h-11 text-xs bg-card border border-white/8 focus:border-white/25 rounded-none font-mono tracking-wide transition-all duration-200"
              value={query}
              disabled={limitHit}
              onChange={(e) => {
                setQuery(e.target.value);
                setShowDropdown(true);
              }}
              onFocus={() => { setShowDropdown(true); setIsFocused(true); }}
              onBlur={() => setIsFocused(false)}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground/40 font-mono">
              {isFocused && !limitHit && <span className="cursor-blink">_</span>}
            </span>
          </div>

          <AnimatePresence>
            {limitHit && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-2 px-3 py-2 border border-white/10 bg-card text-[10px] font-mono text-muted-foreground uppercase tracking-wider text-center"
              >
                search quota exhausted // resets at midnight
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {showDropdown && debouncedQuery.length >= 2 && !limitHit && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.12 }}
                className="absolute top-full mt-1 w-full z-50 max-h-72 overflow-y-auto bg-card border border-white/8"
              >
                {searchLoading ? (
                  <div className="p-3 space-y-2">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="flex items-center gap-3 p-2">
                        <Skeleton className="w-8 h-8 rounded-none" />
                        <div className="flex-1 space-y-1.5">
                          <Skeleton className="h-3 w-28" />
                          <Skeleton className="h-2.5 w-40" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : results && results.length > 0 ? (
                  <div>
                    {results.map((student, idx) => (
                      <motion.button
                        key={student.id}
                        data-testid={`button-student-${student.id}`}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.03 }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/3 active:bg-white/5 text-left transition-colors duration-100 cursor-pointer border-b border-white/5 last:border-b-0"
                        onClick={() => handleSelect(student)}
                      >
                        {student.pictureUrl ? (
                          <img
                            src={student.pictureUrl}
                            alt={student.name}
                            data-testid={`img-student-${student.id}`}
                            className="w-8 h-8 border border-white/10 object-cover shrink-0"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden"); }}
                          />
                        ) : null}
                        <div className={`w-8 h-8 border border-white/10 flex items-center justify-center text-[10px] font-bold text-muted-foreground shrink-0 ${student.pictureUrl ? "hidden" : ""}`}>
                          {getInitials(student.name)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-mono text-xs tracking-wide truncate">{student.name}</p>
                          <p className="text-[10px] text-muted-foreground truncate font-mono">{student.email}</p>
                        </div>
                        {student.profileStrength != null ? (
                          <span className="text-[10px] font-mono shrink-0 tabular-nums font-semibold text-foreground/70" data-testid={`text-strength-${student.id}`}>
                            {student.profileStrength}<span className="text-muted-foreground/50 font-normal text-[9px]">/100</span>
                          </span>
                        ) : (
                          <span className="text-[10px] text-muted-foreground font-mono shrink-0 flex items-center gap-1">
                            <Eye className="w-3 h-3" />
                            {student.searchCount}
                          </span>
                        )}
                      </motion.button>
                    ))}
                  </div>
                ) : (
                  <div className="p-6 text-center text-muted-foreground font-mono">
                    <p className="text-[11px]">no results for "{debouncedQuery}"</p>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        <motion.p
          className="text-[10px] text-muted-foreground/40 mt-4 mb-8 font-mono tracking-wide text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
        >
          search by name, email or roll number // min 2 chars
        </motion.p>

        {/* Leaderboard — hides while searching */}
        <AnimatePresence>
          {!isSearching && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.25 }}
            >
              {/* Header + Sort */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 font-mono">
                  <Trophy className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">top ranked</span>
                </div>
                <div className="flex items-center border border-white/8 overflow-hidden">
                  {(["strength", "searches", "personality"] as const).map((tab, i) => (
                    <button
                      key={tab}
                      onClick={() => { setSortBy(tab); setLeaderboardLimit(20); if (tab !== "personality") setTraitFilter(null); }}
                      data-testid={`button-sort-${tab}`}
                      className={`flex items-center gap-1 px-2.5 py-1.5 text-[9px] font-mono uppercase tracking-widest transition-all duration-200 cursor-pointer ${i > 0 ? "border-l border-white/8" : ""} ${
                        sortBy === tab ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {tab === "searches" && <Eye className="w-2.5 h-2.5" />}
                      {tab === "personality" && <Smile className="w-2.5 h-2.5" />}
                      {tab === "strength" ? "strength" : tab === "searches" ? "views" : "vibe"}
                    </button>
                  ))}
                </div>
              </div>

              {sortBy === "personality" && (
                <div className="flex items-center gap-1 mt-2 flex-wrap">
                  <button
                    onClick={() => setTraitFilter(null)}
                    data-testid="trait-filter-all"
                    className={`px-2 py-1 text-[10px] font-mono transition-all duration-150 cursor-pointer border ${
                      !traitFilter ? "border-foreground/40 text-foreground bg-white/5" : "border-white/8 text-muted-foreground/50 hover:text-muted-foreground hover:border-white/15"
                    }`}
                  >all</button>
                  {PERSONALITY_TRAITS.map(t => (
                    <button
                      key={t.key}
                      onClick={() => setTraitFilter(traitFilter === t.key ? null : t.key)}
                      data-testid={`trait-filter-${t.key}`}
                      title={t.label}
                      className={`px-1.5 py-1 text-sm transition-all duration-150 cursor-pointer border ${
                        traitFilter === t.key ? "border-foreground/40 bg-white/5 scale-110" : "border-white/8 opacity-50 hover:opacity-100 hover:border-white/15"
                      }`}
                    >{t.emoji}</button>
                  ))}
                </div>
              )}

              {/* Rows */}
              <div className="border border-white/8">
                {leaderboardLoading ? (
                  [...Array(5)].map((_, i) => (
                    <div key={i} className="flex items-center gap-3 px-3 py-2.5 border-b border-white/5 last:border-b-0">
                      <Skeleton className="w-5 h-3 rounded-none shrink-0" />
                      <Skeleton className="w-7 h-7 rounded-none shrink-0" />
                      <div className="flex-1 space-y-1">
                        <Skeleton className="h-3 w-28" />
                        <Skeleton className="h-2 w-36" />
                      </div>
                      <Skeleton className="w-8 h-3" />
                    </div>
                  ))
                ) : leaderboard && leaderboard.length > 0 ? (
                  leaderboard.map((student, index) => {
                    const pe = sortBy === "personality" ? (student as PersonalityEntry) : null;
                    const le = sortBy !== "personality" ? (student as LeaderboardEntry) : null;
                    return (
                    <motion.div
                      key={student.id}
                      data-testid={`card-leaderboard-${student.id}`}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.02 }}
                      className="group flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors duration-150 hover:bg-white/3 border-b border-white/5 last:border-b-0"
                      onClick={() => navigate(`/student/${student.id}`)}
                    >
                      <span className={`w-5 text-right font-mono text-[10px] shrink-0 tabular-nums ${
                        index === 0 ? "text-foreground font-bold" :
                        index === 1 ? "text-foreground/75 font-semibold" :
                        index === 2 ? "text-foreground/55 font-semibold" :
                        "text-muted-foreground/40"
                      }`}>
                        {index + 1}
                      </span>
                      {student.pictureUrl ? (
                        <img
                          src={student.pictureUrl}
                          alt={student.name}
                          data-testid={`img-leaderboard-${student.id}`}
                          className="w-7 h-7 border border-white/10 object-cover shrink-0"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = "none";
                            (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden");
                          }}
                        />
                      ) : null}
                      <div className={`w-7 h-7 border border-white/10 flex items-center justify-center text-[9px] font-bold text-muted-foreground shrink-0 ${student.pictureUrl ? "hidden" : ""}`}>
                        {getInitials(student.name)}
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <div className="flex items-center gap-1">
                          <p className="font-mono text-xs tracking-wide group-hover:text-foreground transition-colors duration-150 truncate">{student.name}</p>
                          {(le?.verified || pe?.verified) && (
                            <CheckCircle className="w-2.5 h-2.5 text-blue-400 shrink-0" title="Verified IITJ student" />
                          )}
                        </div>
                        {pe && pe.dominantTrait ? (
                          <p className="text-[10px] text-muted-foreground font-mono">
                            {pe.dominantTrait.emoji} {pe.dominantTrait.label}
                          </p>
                        ) : (
                          <p className="text-[10px] text-muted-foreground truncate font-mono">{student.rollNumber ?? student.email}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2.5 shrink-0 text-[10px] text-muted-foreground font-mono">
                        {pe ? (
                          <span className="flex items-center gap-0.5 font-bold text-foreground tabular-nums text-xs">
                            {pe.traitScore.toFixed(1)}
                            <span className="text-[8px] text-muted-foreground font-normal">/5</span>
                          </span>
                        ) : sortBy === "strength" && student.profileStrength != null ? (
                          <span className="flex items-center gap-0.5 font-bold text-foreground tabular-nums text-xs">
                            {student.profileStrength}
                            <span className="text-[8px] text-muted-foreground font-normal">/100</span>
                          </span>
                        ) : (
                          <>
                            <span className="flex items-center gap-0.5">
                              <Eye className="w-2.5 h-2.5" />
                              {student.searchCount}
                            </span>
                            <span className="flex items-center gap-0.5">
                              <MessageSquare className="w-2.5 h-2.5" />
                              {student.feedbackCount}
                            </span>
                          </>
                        )}
                      </div>
                    </motion.div>
                    );
                  })
                ) : (
                  <div className="p-8 text-center text-muted-foreground font-mono text-[11px]">
                    no data yet
                  </div>
                )}
              </div>

              {/* Load more */}
              {hasMore && (
                <button
                  data-testid="button-load-more"
                  onClick={() => setLeaderboardLimit(l => l + 20)}
                  className="w-full mt-px py-2.5 border border-white/8 border-t-0 text-[10px] font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground hover:bg-white/3 transition-all duration-200 cursor-pointer"
                >
                  load more
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
