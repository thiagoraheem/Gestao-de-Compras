
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";

interface AdminOrBuyerRouteProps {
  children: React.ReactNode;
}

export default function AdminOrBuyerRoute({ children }: AdminOrBuyerRouteProps) {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    setLocation("/login");
    return null;
  }

  if (!user.isAdmin && !user.isBuyer) {
    setLocation("/not-found");
    return null;
  }

  return <>{children}</>;
}
