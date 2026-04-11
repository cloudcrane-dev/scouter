import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";

export type AuthUser = {
  handle: string;
  displayName: string;
};

type AuthState = {
  loggedIn: boolean;
  user?: AuthUser;
};

export function useAuth() {
  const authQuery = useQuery<AuthState | null>({
    queryKey: ["/api/auth/me"],
    queryFn: async () => {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (res.status === 401) {
        return { loggedIn: false };
      }
      if (!res.ok) {
        throw new Error(`Auth request failed: ${res.status}`);
      }
      return res.json() as Promise<AuthState>;
    },
    retry: false,
  });

  const loginMutation = useMutation({
    mutationFn: async (handle: string) => {
      const res = await apiRequest("POST", "/api/auth/login", { handle });
      return res.json() as Promise<AuthState>;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["/api/auth/me"], data);
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/auth/logout");
      return res.json() as Promise<AuthState>;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["/api/auth/me"], data);
    },
  });

  return {
    user: authQuery.data?.user,
    isLoggedIn: Boolean(authQuery.data?.loggedIn),
    isLoading: authQuery.isLoading,
    login: loginMutation.mutateAsync,
    logout: logoutMutation.mutateAsync,
    isLoggingIn: loginMutation.isPending,
    isLoggingOut: logoutMutation.isPending,
  };
}
