
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";

interface AdminOrBuyerRouteProps {
  children: React.ReactNode;
}

export default function AdminOrBuyerRoute({ children }: AdminOrBuyerRouteProps) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!user.isAdmin && !user.isBuyer) {
    return <Navigate to="/not-found" replace />;
  }

  return <>{children}</>;
}
