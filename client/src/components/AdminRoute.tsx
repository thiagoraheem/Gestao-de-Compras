import { useAuth } from "@/hooks/useAuth";
import { AlertCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface AdminRouteProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export default function AdminRoute({ children, fallback }: AdminRouteProps) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user?.isAdmin) {
    return fallback || (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <AlertCircle className="h-6 w-6 text-red-600" />
            </div>
            <CardTitle className="text-red-600">Acesso Negado</CardTitle>
            <CardDescription>
              Esta área é restrita a administradores do sistema.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 text-center">
              Entre em contato com um administrador se você acredita que deveria ter acesso a esta funcionalidade.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}