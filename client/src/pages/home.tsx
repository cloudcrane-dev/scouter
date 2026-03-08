import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Eye, MessageSquare, Terminal } from "lucide-react";
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

  function handleSelect(student: Student) {
    setShowDropdown(false);
    setQuery("");
    navigate(`/student/${student.id}`);
  }

  return (
    <div className="min-h-screen bg-background relative z-10">
      <div className="relative">
        <div className="max-w-xl mx-auto px-4 pt-20 pb-10 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 border border-white/10 text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-6 font-mono">
              <Terminal className="w-3 h-3" />
              <span>{stats?.totalStudents ?? "..."} nodes indexed</span>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tighter mb-1 text-foreground" style={{ fontVariationSettings: "'wght' 800" }}>
              SCOUTER
            </h1>
            <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground mb-8 font-mono">
              IIT Jodhpur // intelligence system
            </p>
          </motion.div>

          <motion.div
            className="relative"
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
                placeholder="query target..."
                className="pl-10 pr-4 h-11 text-xs bg-card border border-white/8 focus:border-white/25 rounded-none font-mono tracking-wide transition-all duration-200"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setShowDropdown(true);
                }}
                onFocus={() => { setShowDropdown(true); setIsFocused(true); }}
                onBlur={() => setIsFocused(false)}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground/40 font-mono">
                {isFocused && <span className="cursor-blink">_</span>}
              </span>
            </div>

            <AnimatePresence>
              {showDropdown && debouncedQuery.length >= 2 && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.12 }}
                  className="absolute top-full mt-1 w-full z-50 max-h-72 overflow-y-auto bg-card border border-white/8"
                >
                  {isLoading ? (
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
                          <div className="w-8 h-8 border border-white/10 flex items-center justify-center text-[10px] font-bold text-muted-foreground shrink-0">
                            {getInitials(student.name)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-mono text-xs tracking-wide truncate">{student.name}</p>
                            <p className="text-[10px] text-muted-foreground truncate font-mono">{student.email}</p>
                          </div>
                          <span className="text-[10px] text-muted-foreground font-mono shrink-0 flex items-center gap-1">
                            <Eye className="w-3 h-3" />
                            {student.searchCount}
                          </span>
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
            className="text-[10px] text-muted-foreground/40 mt-4 font-mono tracking-wide"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
          >
            search by name or email // min 2 chars
          </motion.p>
        </div>
      </div>
    </div>
  );
}
