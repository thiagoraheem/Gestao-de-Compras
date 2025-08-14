import { useState } from "react";
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
import { Loader2, Mail, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const { toast } = useToast();

  const forgotPasswordMutation = useMutation({
    mutationFn: async (email: string) => {
      await apiRequest("/api/auth/forgot-password", {
        method: "POST",
        body: { email },
      });
    },
    onSuccess: () => {
      setIsSubmitted(true);
      toast({
        title: "E-mail enviado",
        description: "Verifique sua caixa de entrada para instruções de recuperação de senha.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Falha ao enviar e-mail de recuperação",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      forgotPasswordMutation.mutate(email);
    }
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-100 flex items-center justify-center">
        <Card className="w-full max-w-md shadow-2xl border-0 bg-white/95 backdrop-blur-sm">
          <CardHeader className="space-y-6 text-center pt-8 pb-6">
            <div className="mx-auto w-16 h-16 bg-gradient-to-r from-green-400 to-green-600 rounded-full flex items-center justify-center shadow-lg">
              <Mail className="h-8 w-8 text-white" />
            </div>
            <div className="space-y-2">
              <CardTitle className="text-2xl font-bold text-green-600">
                E-mail Enviado
              </CardTitle>
              <CardDescription className="text-gray-600 text-sm leading-relaxed">
                Enviamos instruções para recuperação de senha para {email}
              </CardDescription>
            </div>
          </CardHeader>
          
          <CardContent className="px-8 text-center">
            <p className="text-sm text-gray-600 mb-6">
              Verifique sua caixa de entrada e clique no link para redefinir sua senha.
              Se não encontrar o e-mail, verifique sua pasta de spam.
            </p>
          </CardContent>

          <CardFooter className="px-8 pb-8">
            <Link href="/login" className="w-full">
              <Button variant="outline" className="w-full">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar ao Login
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
            <Mail className="h-8 w-8 text-white" />
          </div>
          <div className="space-y-2">
            <CardTitle className="text-2xl font-bold text-orange-600">
              Recuperar Senha
            </CardTitle>
            <CardDescription className="text-gray-600 text-sm leading-relaxed">
              Digite seu e-mail para receber instruções de recuperação de senha.
            </CardDescription>
          </div>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-6 px-8">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-gray-700 font-medium">
                E-mail
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="Digite seu e-mail"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={forgotPasswordMutation.isPending}
                className="h-12 border-gray-200 focus:border-orange-400 focus:ring-orange-400"
              />
            </div>
          </CardContent>

          <CardFooter className="px-8 pb-8">
            <div className="w-full space-y-4">
              <Button
                type="submit"
                className="w-full h-12 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-medium rounded-lg shadow-lg transition-all duration-200 transform hover:scale-[1.02]"
                disabled={forgotPasswordMutation.isPending || !email}
              >
                {forgotPasswordMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Enviando E-mail...
                  </>
                ) : (
                  "Enviar E-mail de Recuperação"
                )}
              </Button>

              <div className="text-center">
                <Link href="/login">
                  <Button variant="ghost" className="text-sm text-gray-500 hover:text-orange-600">
                    <ArrowLeft className="mr-2 h-4 w-4" />
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