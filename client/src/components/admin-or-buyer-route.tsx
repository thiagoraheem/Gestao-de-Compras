
import { useAuth } from "@/hooks/useAuth";
import { useEffect } from "react";
import { useLocation } from "wouter";

interface AdminOrBuyerRouteProps {
  children: React.ReactNode;
}

export default function AdminOrBuyerRoute({ children }: AdminOrBuyerRouteProps) {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  // Perform redirects after render to avoid navigation during render phase
  useEffect(() => {
    if (!isLoading && !user) {
      setLocation("/login");
    } else if (!isLoading && user && !user.isAdmin && !user.isBuyer) {
      setLocation("/not-found");
    }
  }, [isLoading, user, setLocation]);

  if (isLoading || !user || (!user.isAdmin && !user.isBuyer)) {
    return <div>Loading...</div>;
  }

  return <>{children}</>;
}
