import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Settings, Plus, Edit, History, AlertCircle, CheckCircle, DollarSign } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/currency";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

const configSchema = z.object({
  valueThreshold: z.string().min(1, "Valor limite é obrigatório"),
  reason: z.string().min(10, "Justificativa deve ter pelo menos 10 caracteres"),
});

type ConfigFormData = z.infer<typeof configSchema>;

interface ApprovalConfiguration {
  id: number;
  valueThreshold: string;
  isActive: boolean;
  effectiveDate: string;
  createdBy: number;
  reason: string;
  createdAt: string;
  updatedAt: string;
  creator?: {
    firstName: string;
    lastName: string;
  };
}

interface ConfigurationHistory {
  id: number;
  configurationId: number;
  oldValueThreshold: string;
  newValueThreshold: string;
  reason: string;
  changedBy: number;
  changedAt: string;
  changer?: {
    firstName: string;
    lastName: string;
  };
}

export default function ApprovalConfigPage() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<ConfigFormData>({
    resolver: zodResolver(configSchema),
    defaultValues: {
      valueThreshold: "",
      reason: "",
    },
  });

  // Fetch current configuration
  const { data: currentConfig, isLoading: configLoading } = useQuery<ApprovalConfiguration>({
    queryKey: ["/api/approval-rules/config"],
    queryFn: () => apiRequest("/api/approval-rules/config"),
  });

  // Fetch configuration history
  const { data: configHistory = [], isLoading: historyLoading } = useQuery<ConfigurationHistory[]>({
    queryKey: ["/api/approval-rules/config/history"],
    queryFn: () => apiRequest("/api/approval-rules/config/history"),
  });

  // Create new configuration mutation
  const createConfigMutation = useMutation({
    mutationFn: async (data: ConfigFormData) => {
      return apiRequest("/api/approval-rules/config", {
        method: "POST",
        body: {
          valueThreshold: parseFloat(data.valueThreshold.replace(/[^\d,]/g, '').replace(',', '.')),
          reason: data.reason,
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/approval-rules/config"] });
      queryClient.invalidateQueries({ queryKey: ["/api/approval-rules/config/history"] });
      toast({
        title: "Sucesso",
        description: "Configuração de aprovação atualizada com sucesso!",
      });
      setIsCreateDialogOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao atualizar configuração",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ConfigFormData) => {
    createConfigMutation.mutate(data);
  };

  const formatThresholdValue = (value: string) => {
    // Remove non-numeric characters except comma and dot
    const numericValue = value.replace(/[^\d,]/g, '').replace(',', '.');
    const parsed = parseFloat(numericValue);
    return isNaN(parsed) ? 0 : parsed;
  };

  return (
    <div className="container mx-auto py-8 space-y-6 bg-background">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Settings className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold text-foreground">Configuração de Aprovação</h1>
            <p className="text-muted-foreground">Gerenciar limites de valor para aprovação A2</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setIsHistoryDialogOpen(true)}
            className="flex items-center gap-2"
          >
            <History className="h-4 w-4" />
            Histórico
          </Button>
          <Button
            onClick={() => setIsCreateDialogOpen(true)}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Nova Configuração
          </Button>
        </div>
      </div>

      {/* Current Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Configuração Atual
          </CardTitle>
        </CardHeader>
        <CardContent>
          {configLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ) : currentConfig ? (
            <div className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Valor Limite</label>
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {formatCurrency(parseFloat(currentConfig.valueThreshold))}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Status</label>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant={currentConfig.isActive ? "default" : "secondary"}>
                      {currentConfig.isActive ? "Ativa" : "Inativa"}
                    </Badge>
                    {currentConfig.isActive && (
                      <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                    )}
                  </div>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground">Justificativa</label>
                <p className="text-foreground mt-1">{currentConfig.reason}</p>
              </div>

              <div className="grid md:grid-cols-2 gap-4 text-sm text-muted-foreground">
                <div>
                  <span className="font-medium">Criado por:</span>{" "}
                  {currentConfig.creator 
                    ? `${currentConfig.creator.firstName} ${currentConfig.creator.lastName}`
                    : "Sistema"
                  }
                </div>
                <div>
                  <span className="font-medium">Data efetiva:</span>{" "}
                  {formatDistanceToNow(new Date(currentConfig.effectiveDate), {
                    addSuffix: true,
                    locale: ptBR,
                  })}
                </div>
              </div>

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Regra atual:</strong> Solicitações com valor{" "}
                  <strong>até {formatCurrency(parseFloat(currentConfig.valueThreshold))}</strong>{" "}
                  requerem <span className="text-green-600 dark:text-green-400 font-medium">aprovação simples</span>.
                  Valores <strong>acima</strong> requerem{" "}
                  <span className="text-orange-600 dark:text-orange-400 font-medium">dupla aprovação</span> (Diretor + CEO).
                </AlertDescription>
              </Alert>
            </div>
          ) : (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Nenhuma configuração encontrada. Crie uma nova configuração para definir os limites de aprovação.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Create Configuration Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Configuração de Aprovação</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="valueThreshold"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor Limite (R$)</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Ex: 2500,00"
                        onChange={(e) => {
                          const value = e.target.value;
                          // Format as currency while typing
                          const formatted = value.replace(/\D/g, '').replace(/(\d)(\d{2})$/, '$1,$2');
                          field.onChange(formatted);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                    <p className="text-xs text-muted-foreground">
                      Solicitações acima deste valor requerão dupla aprovação
                    </p>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="reason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Justificativa</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Descreva o motivo para esta alteração..."
                        rows={3}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={createConfigMutation.isPending}
                >
                  {createConfigMutation.isPending ? "Salvando..." : "Salvar"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* History Dialog */}
      <Dialog open={isHistoryDialogOpen} onOpenChange={setIsHistoryDialogOpen}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Histórico de Configurações</DialogTitle>
          </DialogHeader>
          <div className="max-h-96 overflow-y-auto">
            {historyLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : configHistory.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Valor Anterior</TableHead>
                    <TableHead>Novo Valor</TableHead>
                    <TableHead>Alterado por</TableHead>
                    <TableHead>Justificativa</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {configHistory.map((history) => (
                    <TableRow key={history.id}>
                      <TableCell className="text-sm">
                        {formatDistanceToNow(new Date(history.changedAt), {
                          addSuffix: true,
                          locale: ptBR,
                        })}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {formatCurrency(parseFloat(history.oldValueThreshold))}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="default">
                          {formatCurrency(parseFloat(history.newValueThreshold))}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {history.changer
                          ? `${history.changer.firstName} ${history.changer.lastName}`
                          : "Sistema"
                        }
                      </TableCell>
                      <TableCell className="text-sm max-w-xs truncate">
                        {history.reason}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Nenhum histórico de alterações encontrado.
                </AlertDescription>
              </Alert>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
