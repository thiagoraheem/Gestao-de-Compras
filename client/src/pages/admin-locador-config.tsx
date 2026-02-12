import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const schema = z.object({
  enabled: z.boolean(),
  sendEnabled: z.boolean().default(true),
  baseUrl: z.string().url(),
  endpoints: z.object({
    combo: z.object({
      fornecedor: z.string().min(1),
      centroCusto: z.string().min(1),
      planoContas: z.string().min(1),
      empresa: z.string().min(1),
      formaPagamento: z.string().min(1),
    }),
    post: z.object({
      enviarSolicitacao: z.string().optional(),
      recebimento: z.string().optional(),
    }),
  }),
  credentials: z.object({
    login: z.string().min(1),
    senha: z.string().optional(),
  }),
});

type FormData = z.infer<typeof schema>;

type ApiConfig = {
  enabled: boolean;
  sendEnabled: boolean;
  baseUrl: string;
  endpoints: FormData["endpoints"];
  credentials: {
    login: string;
    senha: string;
  };
};

export default function AdminLocadorConfigPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<ApiConfig>({
    queryKey: ["/api/config/locador"],
    queryFn: () => apiRequest("/api/config/locador"),
  });

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      enabled: true,
      sendEnabled: true,
      baseUrl: "http://localhost:5225/api",
      endpoints: {
        combo: {
          fornecedor: "/Fornecedor",
          centroCusto: "/CostCenter",
          planoContas: "/ChartOfAccounts",
          empresa: "/Empresa",
          formaPagamento: "/FormaPagamento",
        },
        post: {
          enviarSolicitacao: "/Purchase/PurchaseRequest",
          recebimento: "/Purchase/PurchaseReceive",
        },
      },
      credentials: {
        login: "",
        senha: "",
      },
    },
  });

  useEffect(() => {
    if (!data) return;
    form.reset({
      enabled: data.enabled,
      sendEnabled: data.sendEnabled,
      baseUrl: data.baseUrl,
      endpoints: data.endpoints,
      credentials: {
        login: data.credentials.login,
        senha: "",
      },
    });
  }, [data, form]);

  const saveMutation = useMutation({
    mutationFn: async (values: FormData) => {
      const body: any = {
        enabled: values.enabled,
        sendEnabled: values.sendEnabled,
        baseUrl: values.baseUrl,
        endpoints: values.endpoints,
        credentials: {
          login: values.credentials.login,
        },
      };
      if (values.credentials.senha && values.credentials.senha.trim()) {
        body.credentials.senha = values.credentials.senha;
      }
      return apiRequest("/api/config/locador", { method: "PUT", body });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/config/locador"] });
      toast({ title: "Sucesso", description: "Configuração do Locador atualizada." });
      form.setValue("credentials.senha", "");
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Falha ao atualizar configuração.",
        variant: "destructive",
      });
    },
  });

  const reloadMutation = useMutation({
    mutationFn: async () => apiRequest("/api/config/locador/reload", { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/config/locador"] });
      toast({ title: "Recarregado", description: "Cache de configuração invalidado." });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Falha ao recarregar.",
        variant: "destructive",
      });
    },
  });

  const values = form.watch();

  return (
    <div className="h-[calc(100vh-4rem)] overflow-y-auto p-4">
      <div className="max-w-4xl mx-auto space-y-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Config Integração Locador</CardTitle>
            <div className="flex items-center gap-3">
              <Button
                variant="secondary"
                onClick={() => reloadMutation.mutate()}
                disabled={reloadMutation.isPending}
              >
                Reload
              </Button>
              <Button
                onClick={form.handleSubmit((v) => saveMutation.mutate(v))}
                disabled={saveMutation.isPending}
              >
                Salvar
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <Label>Integração habilitada</Label>
              </div>
              <Switch
                checked={values.enabled}
                onCheckedChange={(checked) => form.setValue("enabled", checked)}
                disabled={isLoading}
              />
            </div>

            <div className="flex items-center justify-between border-t pt-4">
              <div className="space-y-0.5">
                <Label>Envio de Dados para ERP</Label>
                <div className="text-sm text-muted-foreground">
                  Controla apenas o envio de informações (POST). Não afeta a recepção de dados ou consultas.
                </div>
              </div>
              <Switch
                checked={values.sendEnabled}
                onCheckedChange={(checked) => form.setValue("sendEnabled", checked)}
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2 border-t pt-4">
              <Label htmlFor="baseUrl">Base URL</Label>
              <Input id="baseUrl" {...form.register("baseUrl")} placeholder="http://localhost:5225/api" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="login">Login técnico</Label>
                <Input id="login" {...form.register("credentials.login")} placeholder="login" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="senha">Senha técnica (deixe em branco para manter)</Label>
                <Input id="senha" type="password" {...form.register("credentials.senha")} placeholder="••••••••" />
              </div>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Endpoints (paths)</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Combo Fornecedor</Label>
                  <Input {...form.register("endpoints.combo.fornecedor")} />
                </div>
                <div className="space-y-2">
                  <Label>Combo Centro de Custo</Label>
                  <Input {...form.register("endpoints.combo.centroCusto")} />
                </div>
                <div className="space-y-2">
                  <Label>Combo Plano de Contas</Label>
                  <Input {...form.register("endpoints.combo.planoContas")} />
                </div>
                <div className="space-y-2">
                  <Label>Combo Empresa</Label>
                  <Input {...form.register("endpoints.combo.empresa")} />
                </div>
                <div className="space-y-2">
                  <Label>Combo Forma de Pagamento</Label>
                  <Input {...form.register("endpoints.combo.formaPagamento")} />
                </div>
                <div className="space-y-2">
                  <Label>POST Enviar Solicitação</Label>
                  <Input {...form.register("endpoints.post.enviarSolicitacao")} />
                </div>
                <div className="space-y-2">
                  <Label>POST Recebimento</Label>
                  <Input {...form.register("endpoints.post.recebimento")} />
                </div>
              </CardContent>
            </Card>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

