import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Users, TrendingUp, Eye, MessageSquare } from "lucide-react";
import type { Student } from "@shared/schema";

function getInitials(name: string) {
  return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
}

export default function HomePage() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [, navigate] = useLocation();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
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
    <div className="min-h-screen bg-background">
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/8 via-transparent to-primary/4" />
        <div className="relative max-w-2xl mx-auto px-4 pt-16 pb-12 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
            <Users className="w-3.5 h-3.5" />
            <span>{stats?.totalStudents ?? "..."} Students Indexed</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">
            IIT Jodhpur
            <span className="block text-primary mt-1">Student Scouter</span>
          </h1>
          <p className="text-muted-foreground text-base sm:text-lg mb-8 max-w-md mx-auto">
            AI-powered insights on students. Search by name or email to discover strengths, achievements, and peer feedback.
          </p>

          <div className="relative" ref={dropdownRef}>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                ref={inputRef}
                data-testid="input-search"
                type="search"
                placeholder="Search by name or email..."
                className="pl-12 pr-4 h-12 text-base rounded-xl border-2 border-muted focus:border-primary transition-colors"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setShowDropdown(true);
                }}
                onFocus={() => setShowDropdown(true)}
              />
            </div>

            {showDropdown && debouncedQuery.length >= 2 && (
              <Card className="absolute top-full mt-2 w-full z-50 max-h-80 overflow-y-auto border-2">
                {isLoading ? (
                  <div className="p-3 space-y-3">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="flex items-center gap-3 p-2">
                        <Skeleton className="w-10 h-10 rounded-full" />
                        <div className="flex-1 space-y-1.5">
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-3 w-48" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : results && results.length > 0 ? (
                  <div className="p-1.5">
                    {results.map((student) => (
                      <button
                        key={student.id}
                        data-testid={`button-student-${student.id}`}
                        className="w-full flex items-center gap-3 p-2.5 rounded-lg hover-elevate active-elevate-2 text-left transition-colors cursor-pointer"
                        onClick={() => handleSelect(student)}
                      >
                        <Avatar className="w-10 h-10">
                          <AvatarImage src={student.pictureUrl || undefined} alt={student.name} />
                          <AvatarFallback className="text-xs font-semibold bg-primary/10 text-primary">
                            {getInitials(student.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{student.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{student.email}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant="secondary" className="text-xs">
                            <Eye className="w-3 h-3 mr-1" />
                            {student.searchCount}
                          </Badge>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="p-6 text-center text-muted-foreground">
                    <Search className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">No students found for "{debouncedQuery}"</p>
                  </div>
                )}
              </Card>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pb-12">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Trending Profiles</h2>
        </div>

        {!topSearched ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <Card key={i} className="p-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="w-12 h-12 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-3 w-44" />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : topSearched.length > 0 ? (
          <div className="space-y-2">
            {topSearched.map((student, index) => (
              <Card
                key={student.id}
                data-testid={`card-trending-${student.id}`}
                className="p-4 hover-elevate cursor-pointer transition-colors"
                onClick={() => navigate(`/student/${student.id}`)}
              >
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Avatar className="w-11 h-11">
                      <AvatarImage src={student.pictureUrl || undefined} alt={student.name} />
                      <AvatarFallback className="text-xs font-semibold bg-primary/10 text-primary">
                        {getInitials(student.name)}
                      </AvatarFallback>
                    </Avatar>
                    {index < 3 && (
                      <span className="absolute -top-1 -left-1 w-5 h-5 bg-primary text-primary-foreground text-xs font-bold rounded-full flex items-center justify-center">
                        {index + 1}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{student.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{student.email}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="secondary" className="text-xs">
                      <Eye className="w-3 h-3 mr-1" />
                      {student.searchCount}
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      <MessageSquare className="w-3 h-3 mr-1" />
                      {student.feedbackCount}
                    </Badge>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="p-8 text-center text-muted-foreground">
            <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No trending profiles yet</p>
          </Card>
        )}
      </div>
    </div>
  );
}
