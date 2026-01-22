import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { setAdminStatus } from "@/lib/debug";
import { useEffect } from "react";

interface User {
  id: number;
  username: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  departmentId: number | null;
  companyId: number | null;
  department?: {
    id: number;
    name: string;
    description: string | null;
  } | null;
  company?: {
    id: number;
    name: string;
    tradingName: string | null;
    cnpj: string | null;
    logoUrl: string | null;
  } | null;
  isBuyer: boolean;
  isApproverA1: boolean;
  isApproverA2: boolean;
  isAdmin: boolean;
  isManager: boolean;
  isReceiver: boolean;
  isDirector: boolean;
  isCEO: boolean;
  forceChangePassword?: boolean;
}

export function useAuth() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: user, isLoading } = useQuery<User | null>({
    queryKey: ["/api/auth/check"],
    queryFn: async ({ signal }) => {
      try {
        const response = await fetch("/api/auth/check", {
          credentials: "include",
          signal,
        });
        if (!response.ok) {
          return null;
        }
        return response.json();
      } catch (error: any) {
        if (error.name === 'AbortError') {
          throw error;
        }
        return null;
      }
    },
    retry: false,
    staleTime: 1000 * 60 * 5, // 5 minutes - auth data doesn't change frequently
    refetchOnWindowFocus: false, // Don't refetch auth on window focus
  });

  // Update debug system when user changes
  useEffect(() => {
    setAdminStatus(user?.isAdmin || false);
  }, [user?.isAdmin]);

  const loginMutation = useMutation({
    mutationFn: async ({ username, password }: { username: string; password: string }) => {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ username, password }),
      });
      if (!response.ok) {
        throw new Error("Login failed");
      }
      return response.json();
    },
    onSuccess: () => {
      // Invalidate auth check to get fresh user data
      queryClient.invalidateQueries({ queryKey: ["/api/auth/check"] });

      // Wait a bit for auth to be updated, then invalidate other queries
      setTimeout(() => {
        queryClient.invalidateQueries({
          predicate: (query) => {
            const key = query.queryKey[0] as string;
            return key !== "/api/auth/check" && key.startsWith("/api/");
          }
        });
      }, 100);

      toast({
        title: "Login bem-sucedido",
        description: "Bem-vindo de volta!",
      });

      // Check for stored redirect path
      let redirectPath: string | null = null;
      try {
        redirectPath = sessionStorage.getItem('redirectAfterLogin');
      } catch {}
      if (redirectPath) {
        try {
          sessionStorage.removeItem('redirectAfterLogin');
        } catch {}
        window.location.replace(redirectPath);
      } else {
        window.location.replace('/kanban');
      }
    },
    onError: () => {
      toast({
        title: "Erro no login",
        description: "Usuário ou senha inválidos",
        variant: "destructive",
      });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Logout failed");
      }
      return response.json();
    },
    onSuccess: () => {
      // Immediately set user to null to trigger immediate UI update
      queryClient.setQueryData(["/api/auth/check"], null);
      // Clear all cache data
      queryClient.clear();
      // Clear any stored redirect path
      sessionStorage.removeItem('redirectAfterLogin');

      // Force immediate redirect with cache busting
      // Using replace to avoid back button issues
      const timestamp = Date.now();
      window.location.replace(`/?_=${timestamp}`);
    },
    onError: () => {
      // Even if server logout fails, clear local state and redirect
      queryClient.setQueryData(["/api/auth/check"], null);
      queryClient.clear();
      sessionStorage.removeItem('redirectAfterLogin');
      const timestamp = Date.now();
      window.location.replace(`/?_=${timestamp}`);
    },
  });

  return {
    user,
    isAuthenticated: !!user,
    isLoading,
    login: loginMutation.mutate,
    logout: logoutMutation.mutate,
    isLoginLoading: loginMutation.isPending,
    isLogoutLoading: logoutMutation.isPending,
  };
}
