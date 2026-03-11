import { createContext, useContext } from "react";
import { useQuery } from "@tanstack/react-query";

interface AuthUser {
  id: number;
  email: string;
  name: string;
  pictureUrl: string | null;
  studentId: number | null;
  authenticated: true;
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  isAuthenticated: false,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { data, isLoading } = useQuery<AuthUser | { authenticated: false }>({
    queryKey: ["/api/me"],
    staleTime: 60000,
  });

  const user = data && "authenticated" in data && data.authenticated ? data as AuthUser : null;

  return (
    <AuthContext.Provider value={{ user, isLoading, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
