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
      const redirectPath = sessionStorage.getItem('redirectAfterLogin');
      if (redirectPath) {
        sessionStorage.removeItem('redirectAfterLogin');
        window.location.replace(redirectPath);
      } else {
        // Default redirect to kanban
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
      console.log("🟡 logoutMutation.mutationFn called - making API request");
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
      });
      console.log("🟡 Logout API response status:", response.status);
      if (!response.ok) {
        throw new Error("Logout failed");
      }
      const result = await response.json();
      console.log("🟡 Logout API response:", result);
      return result;
    },
    onSuccess: () => {
      console.log("🟢 Logout onSuccess called - clearing data and redirecting");
      
      // Clear all authentication data first
      localStorage.removeItem('auth_token');
      sessionStorage.removeItem('auth_token');
      sessionStorage.removeItem('redirectAfterLogin');
      
      // Clear all cache data and set user to null immediately
      queryClient.clear();
      queryClient.setQueryData(["/api/auth/check"], null);
      queryClient.removeQueries();
      
      // Force invalidate all queries to ensure fresh data
      queryClient.invalidateQueries();
      
      toast({
        title: "Logout realizado",
        description: "Você foi desconectado com sucesso.",
      });
      
      console.log("🟢 About to redirect to /login");
      // Immediate redirect without timeout
      window.location.href = '/login';
    },
    onError: (error) => {
      console.error("🔴 Logout onError called:", error);
      // Even if server logout fails, clear local state and redirect immediately
      localStorage.removeItem('auth_token');
      sessionStorage.removeItem('auth_token');
      sessionStorage.removeItem('redirectAfterLogin');
      
      queryClient.clear();
      queryClient.setQueryData(["/api/auth/check"], null);
      queryClient.removeQueries();
      queryClient.invalidateQueries();
      
      toast({
        title: "Logout realizado",
        description: "Você foi desconectado.",
      });
      
      console.log("🔴 About to redirect to /login (from error handler)");
      // Immediate redirect without timeout
      window.location.href = '/login';
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