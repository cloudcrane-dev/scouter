import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Users, TrendingUp, Eye, MessageSquare, Zap } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { Student } from "@shared/schema";

function getInitials(name: string) {
  return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
}

export default function HomePage() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [, navigate] = useLocation();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 250);
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

  const { data: results, isLoading } = useQuery<Student[]>({
    queryKey: ["/api/students/search", `?q=${debouncedQuery}`],
    enabled: debouncedQuery.length >= 2,
  });

  const { data: stats } = useQuery<{ totalStudents: number }>({
    queryKey: ["/api/stats"],
  });

  const { data: topSearched } = useQuery<Student[]>({
    queryKey: ["/api/leaderboard", "?sort=searches&limit=5"],
  });

  function handleSelect(student: Student) {
    setShowDropdown(false);
    setQuery("");
    navigate(`/student/${student.id}`);
  }

  return (
    <div className="min-h-screen bg-background relative">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute top-40 -left-20 w-[300px] h-[300px] bg-chart-2/5 rounded-full blur-3xl" />
        <div className="absolute top-60 -right-20 w-[250px] h-[250px] bg-chart-4/5 rounded-full blur-3xl" />
      </div>

      <div className="relative">
        <div className="max-w-xl mx-auto px-4 pt-14 pb-10 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-medium mb-5">
              <Zap className="w-3 h-3" />
              <span>{stats?.totalStudents ?? "..."} Students Indexed</span>
            </div>
          </motion.div>

          <motion.h1
            className="text-3xl sm:text-4xl font-bold tracking-tight mb-2"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <span className="bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              Student
            </span>{" "}
            <span className="bg-gradient-to-r from-primary to-chart-4 bg-clip-text text-transparent">
              Scouter
            </span>
          </motion.h1>

          <motion.p
            className="text-muted-foreground text-sm mb-8 max-w-sm mx-auto"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            AI-powered insights for IIT Jodhpur students
          </motion.p>

          <motion.div
            className="relative"
            ref={dropdownRef}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <div className={`relative transition-all duration-300 ${isFocused ? "scale-[1.02]" : "scale-100"}`}>
              <Search className={`absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 transition-colors duration-200 ${isFocused ? "text-primary" : "text-muted-foreground"}`} />
              <Input
                ref={inputRef}
                data-testid="input-search"
                type="search"
                placeholder="Search by name or email..."
                className="pl-11 pr-4 h-12 text-sm rounded-xl bg-card/80 backdrop-blur-sm border border-white/10 focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all duration-200"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setShowDropdown(true);
                }}
                onFocus={() => { setShowDropdown(true); setIsFocused(true); }}
                onBlur={() => setIsFocused(false)}
              />
            </div>

            <AnimatePresence>
              {showDropdown && debouncedQuery.length >= 2 && (
                <motion.div
                  initial={{ opacity: 0, y: -4, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.98 }}
                  transition={{ duration: 0.15 }}
                  className="absolute top-full mt-2 w-full z-50 max-h-72 overflow-y-auto rounded-xl bg-card/95 backdrop-blur-xl border border-white/10 shadow-2xl"
                >
                  {isLoading ? (
                    <div className="p-3 space-y-2">
                      {[1, 2, 3].map(i => (
                        <div key={i} className="flex items-center gap-3 p-2">
                          <Skeleton className="w-9 h-9 rounded-full" />
                          <div className="flex-1 space-y-1.5">
                            <Skeleton className="h-3.5 w-28" />
                            <Skeleton className="h-3 w-40" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : results && results.length > 0 ? (
                    <div className="p-1.5">
                      {results.map((student, idx) => (
                        <motion.button
                          key={student.id}
                          data-testid={`button-student-${student.id}`}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.04 }}
                          className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-white/5 active:bg-white/10 text-left transition-colors duration-150 cursor-pointer"
                          onClick={() => handleSelect(student)}
                        >
                          <Avatar className="w-9 h-9">
                            <AvatarImage src={student.pictureUrl || undefined} alt={student.name} />
                            <AvatarFallback className="text-xs font-semibold bg-primary/15 text-primary">
                              {getInitials(student.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{student.name}</p>
                            <p className="text-xs text-muted-foreground truncate">{student.email}</p>
                          </div>
                          <Badge variant="secondary" className="text-xs shrink-0 bg-white/5 border-white/10">
                            <Eye className="w-3 h-3 mr-1" />
                            {student.searchCount}
                          </Badge>
                        </motion.button>
                      ))}
                    </div>
                  ) : (
                    <div className="p-8 text-center text-muted-foreground">
                      <Search className="w-7 h-7 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">No match for "{debouncedQuery}"</p>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </div>

      <div className="relative max-w-xl mx-auto px-4 pb-20">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-3.5 h-3.5 text-primary" />
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Trending</h2>
          </div>

          {!topSearched ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="rounded-xl bg-card/50 p-3.5">
                  <div className="flex items-center gap-3">
                    <Skeleton className="w-10 h-10 rounded-full" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3.5 w-28" />
                      <Skeleton className="h-3 w-40" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : topSearched.length > 0 ? (
            <div className="space-y-2">
              {topSearched.map((student, index) => (
                <motion.div
                  key={student.id}
                  data-testid={`card-trending-${student.id}`}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 + index * 0.07 }}
                  className="group rounded-xl bg-card/50 hover:bg-card/80 border border-transparent hover:border-white/5 p-3.5 cursor-pointer transition-all duration-200"
                  onClick={() => navigate(`/student/${student.id}`)}
                >
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <Avatar className="w-10 h-10 ring-2 ring-transparent group-hover:ring-primary/20 transition-all duration-300">
                        <AvatarImage src={student.pictureUrl || undefined} alt={student.name} />
                        <AvatarFallback className="text-xs font-semibold bg-primary/15 text-primary">
                          {getInitials(student.name)}
                        </AvatarFallback>
                      </Avatar>
                      {index < 3 && (
                        <span className={`absolute -top-1 -right-1 w-4.5 h-4.5 text-[10px] font-bold rounded-full flex items-center justify-center ${
                          index === 0 ? "bg-yellow-500 text-yellow-950" :
                          index === 1 ? "bg-gray-400 text-gray-950" :
                          "bg-amber-600 text-amber-950"
                        }`}>
                          {index + 1}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm group-hover:text-primary transition-colors duration-200">{student.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{student.email}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 opacity-60 group-hover:opacity-100 transition-opacity duration-200">
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Eye className="w-3 h-3" />
                        {student.searchCount}
                      </span>
                      <span className="text-muted-foreground/30">|</span>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MessageSquare className="w-3 h-3" />
                        {student.feedbackCount}
                      </span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl bg-card/30 p-8 text-center text-muted-foreground">
              <Users className="w-8 h-8 mx-auto mb-2 opacity-20" />
              <p className="text-sm">No trending profiles yet</p>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
