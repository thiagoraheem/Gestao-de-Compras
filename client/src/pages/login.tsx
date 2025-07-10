import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
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
import { Loader2, Eye, EyeOff, Wrench, Construction, Building2, Car } from "lucide-react";
import { Link } from "wouter";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const { login, isLoggingIn } = useAuth();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    login({ username, password });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-100 flex items-center justify-center relative overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 opacity-10">
          <Construction size={120} className="text-primary" />
        </div>
        <div className="absolute bottom-20 right-10 opacity-10">
          <Building2 size={100} className="text-primary" />
        </div>
        <div className="absolute top-1/2 left-5 opacity-5">
          <Car size={80} className="text-primary" />
        </div>
      </div>
      {/* Main Login Card */}
      <Card className="w-full max-w-md shadow-2xl border-0 bg-white/95 backdrop-blur-sm">
        <CardHeader className="space-y-6 text-center pt-8 pb-6">
          {/* Logo/Icon */}
          <div className="mx-auto w-16 h-16 bg-gradient-to-r from-orange-400 to-orange-600 rounded-full flex items-center justify-center shadow-lg">
            <Wrench className="h-8 w-8 text-white" />
          </div>

          {/* Title */}
          <div className="space-y-2">
            <CardTitle className="text-2xl font-bold text-orange-600">
              Sistema <i>LOCADOR</i>
            </CardTitle>
            <CardDescription className="text-gray-600 text-sm leading-relaxed">
              Módulo de Gestão de Compras.
            </CardDescription>
          </div>

          {/* Feature Icons */}
          <div className="flex justify-center items-center space-x-6 text-xs text-gray-500">
            <div className="flex items-center gap-1">
              <Construction size={14} />
              <span>Equipamentos</span>
            </div>
            <div className="flex items-center gap-1">
              <Building2 size={14} />
              <span>Imóveis</span>
            </div>
            <div className="flex items-center gap-1">
              <Car size={14} />
              <span>Veículos</span>
            </div>
          </div>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-6 px-8">
            {/* Username Field */}
            <div className="space-y-2">
              <Label htmlFor="username" className="text-gray-700 font-medium">
                Usuário
              </Label>
              <Input
                id="username"
                type="text"
                placeholder="Digite seu usuário"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                disabled={isLoggingIn}
                className="h-12 border-gray-200 focus:border-orange-400 focus:ring-orange-400"
              />
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <Label htmlFor="password" className="text-gray-700 font-medium">
                Senha
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Digite sua senha"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoggingIn}
                  className="h-12 border-gray-200 focus:border-orange-400 focus:ring-orange-400 pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  disabled={isLoggingIn}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>
          </CardContent>

          <CardFooter className="px-8 pb-8">
            <div className="w-full space-y-4">
              {/* Login Button */}
              <Button
                type="submit"
                className="w-full h-12 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-medium rounded-lg shadow-lg transition-all duration-200 transform hover:scale-[1.02]"
                disabled={isLoggingIn || !username || !password}
              >
                {isLoggingIn ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Entrando no Sistema...
                  </>
                ) : (
                  "Entrar no Sistema"
                )}
              </Button>

              {/* Forgot Password Link */}
              <div className="text-center">
                <Link href="/forgot-password">
                  <button
                    type="button"
                    className="text-sm text-gray-500 hover:text-orange-600 transition-colors underline"
                    disabled={isLoggingIn}
                  >
                    Esqueceu sua senha?
                  </button>
                </Link>
              </div>
            </div>
          </CardFooter>
        </form>

        {/* Footer */}
        <div className="pb-6 px-8 text-center text-xs text-gray-400 space-y-1">
          <p>Locador v2.0 • Gestão de Compras</p>
          <p>Equipamentos • Plataformas Elevatórias • Imóveis • Veículos</p>
        </div>
      </Card>
    </div>
  );
}
