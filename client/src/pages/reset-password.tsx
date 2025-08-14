import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2, KeyRound, Eye, EyeOff, CheckCircle, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Link, useLocation } from "wouter";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isValidToken, setIsValidToken] = useState<boolean | null>(null);
  const [location] = useLocation();
  const { toast } = useToast();

  // Extract token from URL
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');

  // Validate token on component mount
  useEffect(() => {
    if (token) {
      validateToken(token);
    } else {
      setIsValidToken(false);
    }
  }, [token]);

  const validateToken = async (resetToken: string) => {
    try {
      await apiRequest("/api/auth/validate-reset-token", {
          method: "POST",
          body: { token: resetToken },
        });
      setIsValidToken(true);
    } catch (error) {
      setIsValidToken(false);
    }
  };

  const resetPasswordMutation = useMutation({
    mutationFn: async ({ password, token }: { password: string; token: string }) => {
      await apiRequest("/api/auth/reset-password", {
          method: "POST",
          body: { password, token },
        });
    },
    onSuccess: () => {
      setIsSuccess(true);
      toast({
        title: "Senha redefinida",
        description: "Sua senha foi alterada com sucesso. Faça login com sua nova senha.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Falha ao redefinir senha",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      toast({
        title: "Erro",
        description: "As senhas não coincidem",
        variant: "destructive",
      });
      return;
    }

    if (password.length < 6) {
      toast({
        title: "Erro",
        description: "A senha deve ter no mínimo 6 caracteres",
        variant: "destructive",
      });
      return;
    }

    if (token) {
      resetPasswordMutation.mutate({ password, token });
    }
  };

  // Loading state while validating token
  if (isValidToken === null) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-100 flex items-center justify-center">
        <Card className="w-full max-w-md shadow-2xl border-0 bg-white/95 backdrop-blur-sm">
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center space-y-4">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-orange-600" />
              <p className="text-gray-600">Validando token...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Invalid token state
  if (isValidToken === false) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-100 flex items-center justify-center">
        <Card className="w-full max-w-md shadow-2xl border-0 bg-white/95 backdrop-blur-sm">
          <CardHeader className="space-y-6 text-center pt-8 pb-6">
            <div className="mx-auto w-16 h-16 bg-gradient-to-r from-red-400 to-red-600 rounded-full flex items-center justify-center shadow-lg">
              <XCircle className="h-8 w-8 text-white" />
            </div>
            <div className="space-y-2">
              <CardTitle className="text-2xl font-bold text-red-600">
                Token Inválido
              </CardTitle>
              <CardDescription className="text-gray-600 text-sm leading-relaxed">
                O token de recuperação é inválido ou expirou.
              </CardDescription>
            </div>
          </CardHeader>
          
          <CardFooter className="px-8 pb-8">
            <div className="w-full space-y-4">
              <Link href="/forgot-password" className="w-full">
                <Button className="w-full h-12 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700">
                  Solicitar Novo Token
                </Button>
              </Link>
              <Link href="/login" className="w-full">
                <Button variant="outline" className="w-full">
                  Voltar ao Login
                </Button>
              </Link>
            </div>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // Success state
  if (isSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-100 flex items-center justify-center">
        <Card className="w-full max-w-md shadow-2xl border-0 bg-white/95 backdrop-blur-sm">
          <CardHeader className="space-y-6 text-center pt-8 pb-6">
            <div className="mx-auto w-16 h-16 bg-gradient-to-r from-green-400 to-green-600 rounded-full flex items-center justify-center shadow-lg">
              <CheckCircle className="h-8 w-8 text-white" />
            </div>
            <div className="space-y-2">
              <CardTitle className="text-2xl font-bold text-green-600">
                Senha Redefinida
              </CardTitle>
              <CardDescription className="text-gray-600 text-sm leading-relaxed">
                Sua senha foi alterada com sucesso.
              </CardDescription>
            </div>
          </CardHeader>
          
          <CardFooter className="px-8 pb-8">
            <Link href="/login" className="w-full">
              <Button className="w-full h-12 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700">
                Fazer Login
              </Button>
            </Link>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-100 flex items-center justify-center">
      <Card className="w-full max-w-md shadow-2xl border-0 bg-white/95 backdrop-blur-sm">
        <CardHeader className="space-y-6 text-center pt-8 pb-6">
          <div className="mx-auto w-16 h-16 bg-gradient-to-r from-orange-400 to-orange-600 rounded-full flex items-center justify-center shadow-lg">
            <KeyRound className="h-8 w-8 text-white" />
          </div>
          <div className="space-y-2">
            <CardTitle className="text-2xl font-bold text-orange-600">
              Nova Senha
            </CardTitle>
            <CardDescription className="text-gray-600 text-sm leading-relaxed">
              Digite sua nova senha para acessar o sistema.
            </CardDescription>
          </div>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-6 px-8">
            {/* Password Field */}
            <div className="space-y-2">
              <Label htmlFor="password" className="text-gray-700 font-medium">
                Nova Senha
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Digite sua nova senha"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={resetPasswordMutation.isPending}
                  className="h-12 border-gray-200 focus:border-orange-400 focus:ring-orange-400 pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  disabled={resetPasswordMutation.isPending}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>

            {/* Confirm Password Field */}
            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-gray-700 font-medium">
                Confirmar Senha
              </Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Confirme sua nova senha"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={resetPasswordMutation.isPending}
                  className="h-12 border-gray-200 focus:border-orange-400 focus:ring-orange-400 pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  disabled={resetPasswordMutation.isPending}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>

            {/* Password strength indicator */}
            <div className="text-xs text-gray-500">
              A senha deve ter no mínimo 6 caracteres.
            </div>
          </CardContent>

          <CardFooter className="px-8 pb-8">
            <div className="w-full space-y-4">
              <Button
                type="submit"
                className="w-full h-12 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-medium rounded-lg shadow-lg transition-all duration-200 transform hover:scale-[1.02]"
                disabled={resetPasswordMutation.isPending || !password || !confirmPassword}
              >
                {resetPasswordMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Redefinindo Senha...
                  </>
                ) : (
                  "Redefinir Senha"
                )}
              </Button>

              <div className="text-center">
                <Link href="/login">
                  <Button variant="ghost" className="text-sm text-gray-500 hover:text-orange-600">
                    Voltar ao Login
                  </Button>
                </Link>
              </div>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}