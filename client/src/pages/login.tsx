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
import { ModeToggle } from "@/components/mode-toggle";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const { login, isLoginLoading } = useAuth();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    login({ username, password });
  };

  return (
    <div
      className="min-h-[100dvh] flex items-center justify-center relative overflow-hidden bg-background"
      style={{
        backgroundImage:
          "linear-gradient(135deg, var(--login-bg-start), var(--login-bg-middle), var(--login-bg-end))",
      }}
    >
      <div className="absolute top-4 right-4 z-10">
        <ModeToggle />
      </div>
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
      <Card className="w-full max-w-md shadow-2xl bg-card backdrop-blur-sm">
        <CardHeader className="space-y-6 text-center pt-8 pb-6">
          {/* Logo/Icon */}
          <div className="mx-auto w-16 h-16 rounded-full flex items-center justify-center shadow-lg bg-primary">
            <Wrench className="h-8 w-8 text-primary-foreground" />
          </div>

          {/* Title */}
          <div className="space-y-2">
            <CardTitle className="text-2xl font-bold text-primary">
              Sistema <i>LOCADOR</i>
            </CardTitle>
            <CardDescription className="text-muted-foreground text-sm leading-relaxed">
              Módulo de Gestão de Compras.
            </CardDescription>
          </div>

          {/* Feature Icons */}
          <div className="flex justify-center items-center space-x-6 text-xs text-muted-foreground">
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
              <Label htmlFor="username" className="font-medium text-foreground">
                Usuário
              </Label>
              <Input
                id="username"
                type="text"
                placeholder="Digite seu usuário"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                disabled={isLoginLoading}
                className="h-12 border-input focus:border-ring focus:ring-ring"
              />
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <Label htmlFor="password" className="font-medium text-foreground">
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
                  disabled={isLoginLoading}
                  className="h-12 border-input focus:border-ring focus:ring-ring pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  disabled={isLoginLoading}
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
                className="w-full h-12 font-medium rounded-lg shadow-lg transition-all duration-200 transform hover:scale-[1.02] bg-primary text-primary-foreground hover:bg-primary/90 dark:bg-secondary dark:text-secondary-foreground dark:hover:bg-secondary/80"
                disabled={isLoginLoading || !username || !password}
              >
                {isLoginLoading ? (
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
                  className="text-sm text-muted-foreground hover:text-primary transition-colors underline"
                  disabled={isLoginLoading}
                >
                  Esqueceu sua senha?
                </button>
                </Link>
              </div>
            </div>
          </CardFooter>
        </form>

        {/* Footer */}
        <div className="pb-6 px-8 text-center text-xs text-muted-foreground space-y-1">
          <p>Locador v2.0 • Gestão de Compras</p>
          <p>Equipamentos • Plataformas Elevatórias • Imóveis • Veículos</p>
        </div>
      </Card>
    </div>
  );
}
