import { ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield } from 'lucide-react';

interface ManagerRouteProps {
  children: ReactNode;
}

export default function ManagerRoute({ children }: ManagerRouteProps) {
  const { user } = useAuth();

  if (!user || (!user.isAdmin && !user.isManager && !user.isBuyer)) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center p-8 bg-white rounded-lg shadow-md max-w-md">
          <Shield className="mx-auto h-16 w-16 text-gray-400 mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Acesso Restrito</h2>
          <p className="text-gray-600 mb-4">
            Esta página é restrita para usuários com perfil gerencial ou comprador.
          </p>
          <p className="text-sm text-gray-500">
            Entre em contato com o administrador do sistema para obter acesso.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}