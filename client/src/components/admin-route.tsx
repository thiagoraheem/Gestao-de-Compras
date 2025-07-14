import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "wouter";

interface AdminRouteProps {
  children: React.ReactNode;
}

export default function AdminRoute({ children }: AdminRouteProps) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user?.isAdmin) {
    return <Navigate to="/" />;
  }

  return <>{children}</>;
}