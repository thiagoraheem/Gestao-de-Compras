import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Trash2, AlertTriangle, CheckCircle, Database } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface CleanupResponse {
  message: string;
  details: {
    removed: string[];
    maintained: string[];
  };
}

export default function AdminCleanupPage() {
  const [confirmationText, setConfirmationText] = useState("");
  const [showConfirmation, setShowConfirmation] = useState(false);
  const { toast } = useToast();

  const cleanupMutation = useMutation({
    mutationFn: async (confirmationText: string): Promise<CleanupResponse> => {
      const response = await fetch("/api/admin/cleanup-purchase-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmationText }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Erro ao realizar limpeza");
      }

      return await response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Limpeza realizada com sucesso!",
        description: data.message,
      });
      setConfirmationText("");
      setShowConfirmation(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Erro na limpeza",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleCleanup = () => {
    if (confirmationText === "CONFIRMAR LIMPEZA") {
      cleanupMutation.mutate(confirmationText);
    }
  };

  return (
    <div className="container mx-auto py-8 space-y-6 bg-background">
      <div className="flex items-center gap-3">
        <Database className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold text-foreground">Limpeza de Dados</h1>
          <p className="text-muted-foreground">Administração do banco de dados</p>
        </div>
      </div>

      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription className="text-red-800">
          <strong>Atenção:</strong> Esta operação é irreversível e removerá permanentemente todos os dados de solicitações de compra.
        </AlertDescription>
      </Alert>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Dados que serão removidos
            </CardTitle>
            <CardDescription>
              Os seguintes dados serão permanentemente deletados:
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {[
                "Solicitações de compra",
                "Itens de solicitação",
                "Cotações e RFQs",
                "Itens de cotação",
                "Cotações de fornecedores",
                "Pedidos de compra",
                "Recebimentos",
                "Histórico de aprovações",
                "Anexos e documentos"
              ].map((item, index) => (
                <li key={index} className="flex items-center gap-2 text-sm">
                  <span className="w-2 h-2 bg-destructive rounded-full"></span>
                  {item}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
              <CheckCircle className="h-5 w-5" />
              Dados que serão mantidos
            </CardTitle>
            <CardDescription>
              Os seguintes cadastros básicos serão preservados:
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {[
                "Usuários e permissões",
                "Departamentos",
                "Centros de custo",
                "Fornecedores",
                "Métodos de pagamento",
                "Locais de entrega",
                "Configurações do sistema"
              ].map((item, index) => (
                <li key={index} className="flex items-center gap-2 text-sm">
                  <span className="w-2 h-2 bg-emerald-500 dark:bg-emerald-400 rounded-full"></span>
                  {item}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card className="border-destructive/50 dark:border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive">Executar Limpeza</CardTitle>
          <CardDescription>
            Para confirmar a operação, digite exatamente: <code className="bg-muted px-2 py-1 rounded">CONFIRMAR LIMPEZA</code>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Input
              type="text"
              placeholder="Digite: CONFIRMAR LIMPEZA"
              value={confirmationText}
              onChange={(e) => setConfirmationText(e.target.value)}
              className="max-w-md"
            />
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setShowConfirmation(!showConfirmation)}
            >
              {showConfirmation ? "Cancelar" : "Preparar Limpeza"}
            </Button>

            {showConfirmation && (
              <Button
                variant="destructive"
                onClick={handleCleanup}
                disabled={confirmationText !== "CONFIRMAR LIMPEZA" || cleanupMutation.isPending}
              >
                {cleanupMutation.isPending ? "Executando..." : "Executar Limpeza"}
              </Button>
            )}
          </div>

          {cleanupMutation.data && (
            <Alert>
              <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <AlertDescription className="text-foreground">
                <strong>Limpeza concluída!</strong> {cleanupMutation.data.message}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
