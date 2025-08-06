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
    queryFn: async () => {
      try {
        const response = await fetch("/api/auth/check");
        if (!response.ok) {
          return null;
        }
        return response.json();
      } catch {
        return null;
      }
    },
    retry: false,
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
      queryClient.invalidateQueries({ queryKey: ["/api/auth/check"] });
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
    isLoading,
    isAuthenticated: !!user,
    login: loginMutation.mutate,
    logout: logoutMutation.mutate,
    isLoggingIn: loginMutation.isPending,
  };
}