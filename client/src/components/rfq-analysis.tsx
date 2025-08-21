import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  GitCompare, 
  TrendingUp, 
  TrendingDown, 
  CheckCircle, 
  X, 
  Star,
  AlertTriangle,
  DollarSign,
  Calendar,
  FileText,
  Truck,
  Package,
  XCircle
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import debug from "@/lib/debug";

const approvalSchema = z.object({
  chosenSupplierId: z.string().min(1, "Selecione um fornecedor"),
  choiceReason: z.string().min(10, "Justificativa deve ter pelo menos 10 caracteres"),
  negotiatedValue: z.string().optional(),
  discountsObtained: z.string().optional(),
  unavailableItems: z.array(z.object({
    quotationItemId: z.number(),
    reason: z.string().min(1, "Motivo é obrigatório")
  })).optional().default([]),
  createNewRequest: z.boolean().optional().default(false),
});

type ApprovalFormData = z.infer<typeof approvalSchema>;

interface RFQAnalysisProps {
  quotation: any;
  quotationItems: any[];
  supplierQuotations: any[];
  onClose: () => void;
  onComplete: () => void;
}

export default function RFQAnalysis({ 
  quotation, 
  quotationItems, 
  supplierQuotations, 
  onClose, 
  onComplete 
}: RFQAnalysisProps) {
  const [selectedQuotation, setSelectedQuotation] = useState<string>("");
  const [unavailableItems, setUnavailableItems] = useState<{[key: number]: {checked: boolean, reason: string}}>({});
  const [showUnavailableDialog, setShowUnavailableDialog] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<ApprovalFormData>({
    resolver: zodResolver(approvalSchema),
    defaultValues: {
      choiceReason: "",
      negotiatedValue: "",
      discountsObtained: "",
      unavailableItems: [],
      createNewRequest: false,
    },
  });

  const receivedQuotations = supplierQuotations.filter(sq => sq.status === 'received');
  
  // Calculate statistics
  const totalValues = receivedQuotations
    .filter(sq => sq.totalValue)
    .map(sq => parseFloat(sq.totalValue));
  
  const averageValue = totalValues.length > 0 
    ? totalValues.reduce((a, b) => a + b, 0) / totalValues.length 
    : 0;
  
  const minValue = totalValues.length > 0 ? Math.min(...totalValues) : 0;
  const maxValue = totalValues.length > 0 ? Math.max(...totalValues) : 0;

  const approveMutation = useMutation({
    mutationFn: async (data: ApprovalFormData) => {
      const selectedQuote = receivedQuotations.find(sq => sq.id === parseInt(data.chosenSupplierId));
      
      const response = await fetch(`/api/purchase-requests/${quotation.purchaseRequestId}/approve-a2`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          approverId: 1, // TODO: Get from auth context
          chosenSupplierId: selectedQuote.supplierId,
          choiceReason: data.choiceReason,
          negotiatedValue: data.negotiatedValue ? parseFloat(data.negotiatedValue) : selectedQuote.totalValue,
          discountsObtained: data.discountsObtained || "",
          deliveryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to approve quotation");
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Cotação aprovada",
        description: "A cotação foi aprovada e a solicitação avançou para a próxima fase.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-requests"] });
      onComplete();
    },
    onError: (error) => {
      toast({
        title: "Erro ao aprovar",
        description: "Ocorreu um erro ao aprovar a cotação.",
        variant: "destructive",
      });
      debug.error("Error approving quotation:", error);
    },
  });

  const onSubmit = (data: ApprovalFormData) => {
    // Preparar lista de itens indisponíveis
    const unavailableItemsList = Object.entries(unavailableItems)
      .filter(([_, item]) => item.checked && item.reason.trim())
      .map(([quotationItemId, item]) => ({
        quotationItemId: parseInt(quotationItemId),
        reason: item.reason
      }));

    const formDataWithUnavailable = {
      ...data,
      unavailableItems: unavailableItemsList,
      createNewRequest: unavailableItemsList.length > 0 && data.createNewRequest
    };

    approveMutation.mutate(formDataWithUnavailable);
  };

  const handleUnavailableItemChange = (itemId: number, checked: boolean, reason: string = '') => {
    setUnavailableItems(prev => ({
      ...prev,
      [itemId]: { checked, reason }
    }));
  };

  const getUnavailableItemsCount = () => {
    return Object.values(unavailableItems).filter(item => item.checked).length;
  };

  const getVariationColor = (value: number, average: number) => {
    const variation = ((value - average) / average) * 100;
    if (variation < -5) return "text-green-600";
    if (variation > 5) return "text-red-600";
    return "text-gray-600";
  };

  const getVariationIcon = (value: number, average: number) => {
    const variation = ((value - average) / average) * 100;
    if (variation < -5) return <TrendingDown className="h-4 w-4 text-green-600" />;
    if (variation > 5) return <TrendingUp className="h-4 w-4 text-red-600" />;
    return null;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-7xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b p-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Análise de Cotações</h2>
            <p className="text-gray-600 mt-1">RFQ: {quotation.quotationNumber}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="p-6 space-y-6">
          {/* Statistics Overview */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Cotações Recebidas</p>
                    <p className="text-2xl font-bold">{receivedQuotations.length}</p>
                  </div>
                  <CheckCircle className="h-8 w-8 text-green-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Menor Valor</p>
                    <p className="text-2xl font-bold text-green-600">
                      R$ {minValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <TrendingDown className="h-8 w-8 text-green-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Valor Médio</p>
                    <p className="text-2xl font-bold">
                      R$ {averageValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <DollarSign className="h-8 w-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Maior Valor</p>
                    <p className="text-2xl font-bold text-red-600">
                      R$ {maxValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-red-600" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Comparative Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GitCompare className="h-5 w-5" />
                Comparativo de Cotações
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fornecedor</TableHead>
                      <TableHead>Valor Total</TableHead>
                      <TableHead>Variação</TableHead>
                      <TableHead>Condições de Pagamento</TableHead>
                      <TableHead>Prazo de Entrega</TableHead>
                      <TableHead>Observações</TableHead>
                      <TableHead>Recebido em</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {receivedQuotations.map((sq) => {
                      const value = parseFloat(sq.totalValue || "0");
                      const variation = averageValue > 0 ? ((value - averageValue) / averageValue) * 100 : 0;
                      const isLowest = value === minValue;

                      return (
                        <TableRow key={sq.id} className={isLowest ? "bg-green-50" : ""}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              {sq.supplier?.name || 'Fornecedor'}
                              {isLowest && <Star className="h-4 w-4 text-yellow-500 fill-current" />}
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className={`font-semibold ${isLowest ? "text-green-600" : ""}`}>
                              R$ {value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              {getVariationIcon(value, averageValue)}
                              <span className={getVariationColor(value, averageValue)}>
                                {variation > 0 ? "+" : ""}{variation.toFixed(1)}%
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm">{sq.paymentTerms || "Não informado"}</span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm">{sq.deliveryTerms || "Não informado"}</span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-gray-600">{sq.observations || "-"}</span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm">
                              {format(new Date(sq.receivedAt), "dd/MM/yyyy", { locale: ptBR })}
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Unavailable Products Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Produtos Indisponíveis
                {getUnavailableItemsCount() > 0 && (
                  <Badge variant="destructive" className="ml-2">
                    {getUnavailableItemsCount()} item(s)
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Marque os produtos que o fornecedor escolhido não possui disponível. 
                    Estes itens não aparecerão nas próximas fases e poderão gerar uma nova solicitação.
                  </AlertDescription>
                </Alert>

                <div className="space-y-3">
                  {quotationItems.map((item) => (
                    <div key={item.id} className="flex items-start space-x-3 p-4 border rounded-lg">
                      <Checkbox
                        checked={unavailableItems[item.id]?.checked || false}
                        onCheckedChange={(checked) => 
                          handleUnavailableItemChange(item.id, checked as boolean, unavailableItems[item.id]?.reason || '')
                        }
                      />
                      <div className="flex-1 space-y-2">
                        <div>
                          <span className="font-medium">{item.itemCode}</span>
                          <span className="text-gray-600 ml-2">{item.description}</span>
                        </div>
                        <div className="text-sm text-gray-500">
                          Quantidade: {item.quantity} {item.unit}
                        </div>
                        {unavailableItems[item.id]?.checked && (
                          <div className="mt-2">
                            <Input
                              placeholder="Motivo da indisponibilidade..."
                              value={unavailableItems[item.id]?.reason || ''}
                              onChange={(e) => 
                                handleUnavailableItemChange(item.id, true, e.target.value)
                              }
                              className="text-sm"
                            />
                          </div>
                        )}
                      </div>
                      {unavailableItems[item.id]?.checked && (
                        <XCircle className="h-5 w-5 text-red-500 mt-1" />
                      )}
                    </div>
                  ))}
                </div>

                {getUnavailableItemsCount() > 0 && (
                  <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        checked={form.watch('createNewRequest')}
                        onCheckedChange={(checked) => form.setValue('createNewRequest', checked as boolean)}
                      />
                      <label className="text-sm font-medium">
                        Criar nova solicitação automaticamente para os itens indisponíveis
                      </label>
                    </div>
                    <p className="text-xs text-gray-600 mt-1 ml-6">
                      Uma nova solicitação será criada contendo apenas os itens marcados como indisponíveis, 
                      já aprovada em A1 e na fase de Cotação.
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Approval Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5" />
                Aprovação de Cotação
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <FormField
                    control={form.control}
                    name="chosenSupplierId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Selecionar Fornecedor</FormLabel>
                        <FormControl>
                          <RadioGroup
                            value={field.value}
                            onValueChange={field.onChange}
                            className="grid grid-cols-1 gap-4"
                          >
                            {receivedQuotations.map((sq) => {
                              const value = parseFloat(sq.totalValue || "0");
                              const isLowest = value === minValue;

                              return (
                                <div key={sq.id} className="flex items-center space-x-3 p-4 border rounded-lg">
                                  <RadioGroupItem value={sq.id.toString()} />
                                  <div className="flex-1">
                                    <div className="flex items-center justify-between">
                                      <span className="font-medium">
                                        {sq.supplier?.name || 'Fornecedor'}
                                        {isLowest && (
                                          <Badge className="ml-2 bg-green-100 text-green-800">
                                            Menor Preço
                                          </Badge>
                                        )}
                                      </span>
                                      <span className="font-bold text-lg">
                                        R$ {value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                      </span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4 mt-2 text-sm text-gray-600">
                                      <span>Pagamento: {sq.paymentTerms || "Não informado"}</span>
                                      <span>Entrega: {sq.deliveryTerms || "Não informado"}</span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="choiceReason"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Justificativa da Escolha</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Explique os motivos para a escolha deste fornecedor..."
                            rows={4}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="negotiatedValue"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Valor Negociado (opcional)</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              step="0.01" 
                              placeholder="Se houve negociação do valor"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="discountsObtained"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Descontos Obtidos (opcional)</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="Descrição dos descontos"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      Ao aprovar esta cotação, a solicitação avançará para a fase de Pedido de Compra 
                      e não poderá ser alterada.
                    </AlertDescription>
                  </Alert>

                  <div className="flex justify-end space-x-4">
                    <Button type="button" variant="outline" onClick={onClose}>
                      Cancelar
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={approveMutation.isPending}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      {approveMutation.isPending ? "Aprovando..." : "Aprovar Cotação"}
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}