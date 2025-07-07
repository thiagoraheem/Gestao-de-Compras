import { ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield } from 'lucide-react';

interface ManagerRouteProps {
  children: ReactNode;
}

export default function ManagerRoute({ children }: ManagerRouteProps) {
  const { user } = useAuth();

  if (!user) {
    return null;
  }

  // Allow admins and managers to access
  if (!user.isAdmin && !user.isManager) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <Shield className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <CardTitle>Acesso Restrito</CardTitle>
            <CardDescription>
              Esta página é restrita para usuários com perfil gerencial.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-sm text-gray-600">
              Entre em contato com o administrador do sistema para obter acesso.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}