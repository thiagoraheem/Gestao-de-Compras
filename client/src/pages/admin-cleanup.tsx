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

      return response.json();
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
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center gap-3">
        <Database className="h-8 w-8 text-red-600" />
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Limpeza de Dados</h1>
          <p className="text-gray-600">Administração do banco de dados</p>
        </div>
      </div>

      <Alert className="border-red-200 bg-red-50">
        <AlertTriangle className="h-4 w-4 text-red-600" />
        <AlertDescription className="text-red-800">
          <strong>Atenção:</strong> Esta operação é irreversível e removerá permanentemente todos os dados de solicitações de compra.
        </AlertDescription>
      </Alert>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
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
                  <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                  {item}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-600">
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
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  {item}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="text-red-600">Executar Limpeza</CardTitle>
          <CardDescription>
            Para confirmar a operação, digite exatamente: <code className="bg-gray-100 px-2 py-1 rounded">CONFIRMAR LIMPEZA</code>
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
                className="bg-red-600 hover:bg-red-700"
              >
                {cleanupMutation.isPending ? "Executando..." : "Executar Limpeza"}
              </Button>
            )}
          </div>

          {cleanupMutation.data && (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                <strong>Limpeza concluída!</strong> {cleanupMutation.data.message}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}