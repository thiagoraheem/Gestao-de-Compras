import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { URGENCY_LABELS, CATEGORY_LABELS } from "@/lib/types";
import { 
  ShoppingCart, 
  FileText, 
  Calendar, 
  DollarSign, 
  User, 
  Building, 
  AlertTriangle,
  Clock,
  MessageSquare,
  History,
  Plus,
  Trash2,
  Upload,
  GitCompare,
  CheckCircle,
  TrendingUp,
  TrendingDown
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

const supplierQuotationSchema = z.object({
  supplierId: z.coerce.number().min(1, "Fornecedor é obrigatório"),
  quotedValue: z.string().min(1, "Valor cotado é obrigatório"),
  paymentConditions: z.string().min(5, "Condições de pagamento são obrigatórias"),
  deliveryDays: z.coerce.number().min(1, "Prazo de entrega é obrigatório"),
  observations: z.string().optional(),
});

const quotationSchema = z.object({
  suppliers: z.array(supplierQuotationSchema).min(1, "Pelo menos um fornecedor deve ser cotado"),
  totalValue: z.string().min(1, "Valor total é obrigatório"),
  paymentMethodId: z.coerce.number().min(1, "Forma de pagamento é obrigatória"),
  quotationNotes: z.string().optional(),
});

type SupplierQuotationData = z.infer<typeof supplierQuotationSchema>;
type QuotationFormData = z.infer<typeof quotationSchema>;

interface QuotationPhaseProps {
  request: any;
  onClose?: () => void;
  className?: string;
}

export default function QuotationPhase({ request, onClose, className }: QuotationPhaseProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isUploading, setIsUploading] = useState(false);
  const [supplierQuotations, setSupplierQuotations] = useState<SupplierQuotationData[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<{[key: number]: File[]}>({});

  // Check if user has buyer permissions
  const canQuote = user?.isBuyer || false;

  const { data: suppliers, isLoading: suppliersLoading } = useQuery<any[]>({
    queryKey: ["/api/suppliers"],
  });

  const { data: paymentMethods, isLoading: paymentMethodsLoading } = useQuery<any[]>({
    queryKey: ["/api/payment-methods"],
  });

  const { data: attachments } = useQuery<any[]>({
    queryKey: ["/api/purchase-requests", request.id, "attachments"],
  });

  const { data: quotationHistory } = useQuery<any[]>({
    queryKey: ["/api/purchase-requests", request.id, "quotation-history"],
  });

  const form = useForm<QuotationFormData>({
    resolver: zodResolver(quotationSchema),
    defaultValues: {
      suppliers: [],
      totalValue: "",
      paymentMethodId: 0,
      quotationNotes: "",
    },
  });

  const quotationMutation = useMutation({
    mutationFn: async (data: QuotationFormData) => {
      // First, update the purchase request with quotation data
      await apiRequest("PATCH", `/api/purchase-requests/${request.id}`, {
        totalValue: parseFloat(data.totalValue),
        paymentMethodId: data.paymentMethodId,
        buyerId: user?.id || 1,
        currentPhase: 'aprovacao_a2',
      });

      // Then, save supplier quotations
      for (const supplierQuotation of data.suppliers) {
        await apiRequest("POST", `/api/purchase-requests/${request.id}/quotations`, {
          supplierId: supplierQuotation.supplierId,
          quotedValue: parseFloat(supplierQuotation.quotedValue),
          paymentConditions: supplierQuotation.paymentConditions,
          deliveryDays: supplierQuotation.deliveryDays,
          observations: supplierQuotation.observations || null,
        });
      }

      // Upload quotation files if any
      if (Object.keys(uploadedFiles).length > 0) {
        setIsUploading(true);
        let fileCount = 0;
        const totalFiles = Object.values(uploadedFiles).reduce((acc, files) => acc + files.length, 0);
        
        for (const [supplierId, files] of Object.entries(uploadedFiles)) {
          for (const file of files) {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('attachmentType', 'quotation');
            formData.append('supplierId', supplierId);
            
            await apiRequest("POST", `/api/purchase-requests/${request.id}/attachments`, formData);
            fileCount++;
            setUploadProgress((fileCount / totalFiles) * 100);
          }
        }
        setIsUploading(false);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-requests"] });
      toast({
        title: "Sucesso",
        description: "Cotação enviada para aprovação A2!",
      });
      form.reset();
      setSupplierQuotations([]);
      setUploadedFiles({});
      setUploadProgress(0);
      onClose?.();
    },
    onError: (error: any) => {
      setIsUploading(false);
      toast({
        title: "Erro",
        description: error?.message || "Falha ao processar cotação",
        variant: "destructive",
      });
    },
  });

  const addSupplierQuotation = () => {
    const newQuotation: SupplierQuotationData = {
      supplierId: 0,
      quotedValue: "",
      paymentConditions: "",
      deliveryDays: 0,
      observations: "",
    };
    setSupplierQuotations([...supplierQuotations, newQuotation]);
  };

  const removeSupplierQuotation = (index: number) => {
    setSupplierQuotations(supplierQuotations.filter((_, i) => i !== index));
    // Remove uploaded files for this supplier
    const newUploadedFiles = { ...uploadedFiles };
    delete newUploadedFiles[index];
    setUploadedFiles(newUploadedFiles);
  };

  const updateSupplierQuotation = (index: number, field: keyof SupplierQuotationData, value: any) => {
    const updatedQuotations = [...supplierQuotations];
    updatedQuotations[index] = { ...updatedQuotations[index], [field]: value };
    setSupplierQuotations(updatedQuotations);
  };

  const handleFileUpload = (supplierIndex: number, files: FileList | null) => {
    if (!files) return;
    
    const validFiles = Array.from(files).filter(file => {
      const maxSize = 10 * 1024 * 1024; // 10MB
      
      if (file.size > maxSize) {
        toast({
          title: "Arquivo muito grande",
          description: "O arquivo deve ter no máximo 10MB",
          variant: "destructive",
        });
        return false;
      }
      
      return true;
    });
    
    setUploadedFiles(prev => ({
      ...prev,
      [supplierIndex]: [...(prev[supplierIndex] || []), ...validFiles]
    }));
  };

  const removeFile = (supplierIndex: number, fileIndex: number) => {
    setUploadedFiles(prev => ({
      ...prev,
      [supplierIndex]: prev[supplierIndex]?.filter((_, i) => i !== fileIndex) || []
    }));
  };

  const calculateTotalValue = () => {
    return supplierQuotations.reduce((total, quotation) => {
      const value = parseFloat(quotation.quotedValue) || 0;
      return total + value;
    }, 0);
  };

  const getBestQuotation = () => {
    if (supplierQuotations.length === 0) return null;
    return supplierQuotations.reduce((best, current) => {
      const currentValue = parseFloat(current.quotedValue) || Infinity;
      const bestValue = parseFloat(best.quotedValue) || Infinity;
      return currentValue < bestValue ? current : best;
    });
  };

  const onSubmit = (data: QuotationFormData) => {
    const formData = {
      ...data,
      suppliers: supplierQuotations,
    };
    quotationMutation.mutate(formData);
  };

  if (!canQuote) {
    return (
      <Card className={cn("w-full max-w-4xl", className)}>
        <CardContent className="p-6">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Você não tem permissão para realizar cotações. 
              Entre em contato com o administrador do sistema.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("w-full max-w-7xl", className)}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-purple-600" />
            Cotação (RFQ) - Solicitação #{request.requestNumber}
          </div>
          <Badge variant={request.urgency === 'alto' ? 'destructive' : 'secondary'}>
            {request.urgency in URGENCY_LABELS ? URGENCY_LABELS[request.urgency as keyof typeof URGENCY_LABELS] : request.urgency}
          </Badge>
        </CardTitle>
      </CardHeader>
      
      <CardContent>
        <Tabs defaultValue="request-details" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="request-details">Detalhes da Solicitação</TabsTrigger>
            <TabsTrigger value="quotations">Cotações</TabsTrigger>
            <TabsTrigger value="comparison">Comparação</TabsTrigger>
            <TabsTrigger value="finalization">Finalização</TabsTrigger>
          </TabsList>

          {/* Request Details Tab */}
          <TabsContent value="request-details" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Basic Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Informações da Solicitação
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Solicitante:</span>
                      <span className="font-medium">
                        {request.requester?.firstName && request.requester?.lastName 
                          ? `${request.requester.firstName} ${request.requester.lastName}`
                          : request.requester?.username || 'N/A'
                        }
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Building className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Centro de Custo:</span>
                      <span className="font-medium">
                        {request.costCenter?.code} - {request.costCenter?.name}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Categoria:</span>
                      <Badge variant="outline">
                        {request.category in CATEGORY_LABELS ? CATEGORY_LABELS[request.category as keyof typeof CATEGORY_LABELS] : request.category}
                      </Badge>
                    </div>
                    
                    {request.idealDeliveryDate && (
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Prazo Ideal:</span>
                        <span className="font-medium">
                          {format(new Date(request.idealDeliveryDate), 'dd/MM/yyyy', { locale: ptBR })}
                        </span>
                      </div>
                    )}
                    
                    {request.availableBudget && (
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Orçamento:</span>
                        <span className="font-medium">
                          R$ {parseFloat(request.availableBudget).toLocaleString('pt-BR', { 
                            minimumFractionDigits: 2 
                          })}
                        </span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Justification */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    Justificativa
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-32">
                    <p className="text-sm leading-relaxed">{request.justification}</p>
                  </ScrollArea>
                  
                  {request.additionalInfo && (
                    <div className="mt-4 pt-4 border-t">
                      <h4 className="text-sm font-medium mb-2">Informações Adicionais:</h4>
                      <ScrollArea className="h-20">
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {request.additionalInfo}
                        </p>
                      </ScrollArea>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Attachments */}
            {attachments && attachments.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Anexos da Solicitação ({attachments.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {attachments.map((attachment: any, index: number) => (
                      <div key={index} className="flex items-center gap-2 p-3 border rounded-lg">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{attachment.fileName}</p>
                          <p className="text-xs text-muted-foreground">
                            {attachment.fileSize ? `${(attachment.fileSize / 1024 / 1024).toFixed(2)} MB` : 'N/A'}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Quotations Tab */}
          <TabsContent value="quotations" className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">Gerenciar Cotações</h3>
              <Button onClick={addSupplierQuotation} className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Adicionar Fornecedor
              </Button>
            </div>

            {supplierQuotations.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <ShoppingCart className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">Nenhuma cotação adicionada</h3>
                  <p className="text-muted-foreground mb-4">
                    Adicione fornecedores para solicitar cotações e comparar preços.
                  </p>
                  <Button onClick={addSupplierQuotation}>
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar Primeiro Fornecedor
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {supplierQuotations.map((quotation, index) => (
                  <Card key={index}>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center justify-between">
                        <span>Cotação #{index + 1}</span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => removeSupplierQuotation(index)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm font-medium">Fornecedor *</label>
                          <Select
                            value={quotation.supplierId.toString()}
                            onValueChange={(value) => updateSupplierQuotation(index, 'supplierId', parseInt(value))}
                            disabled={suppliersLoading}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o fornecedor..." />
                            </SelectTrigger>
                            <SelectContent>
                              {suppliers && suppliers.map((supplier: any) => (
                                <SelectItem key={supplier.id} value={supplier.id.toString()}>
                                  {supplier.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <label className="text-sm font-medium">Valor Cotado *</label>
                          <div className="relative">
                            <span className="absolute left-3 top-2.5 text-sm text-muted-foreground">R$</span>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="0,00"
                              className="pl-10"
                              value={quotation.quotedValue}
                              onChange={(e) => updateSupplierQuotation(index, 'quotedValue', e.target.value)}
                            />
                          </div>
                        </div>

                        <div>
                          <label className="text-sm font-medium">Condições de Pagamento *</label>
                          <Input
                            placeholder="Ex: 30 dias, à vista, etc."
                            value={quotation.paymentConditions}
                            onChange={(e) => updateSupplierQuotation(index, 'paymentConditions', e.target.value)}
                          />
                        </div>

                        <div>
                          <label className="text-sm font-medium">Prazo de Entrega (dias) *</label>
                          <Input
                            type="number"
                            min="1"
                            placeholder="Ex: 15"
                            value={quotation.deliveryDays.toString()}
                            onChange={(e) => updateSupplierQuotation(index, 'deliveryDays', parseInt(e.target.value) || 0)}
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-sm font-medium">Observações</label>
                        <Textarea
                          rows={2}
                          placeholder="Observações adicionais sobre esta cotação..."
                          value={quotation.observations}
                          onChange={(e) => updateSupplierQuotation(index, 'observations', e.target.value)}
                        />
                      </div>

                      {/* File Upload for this supplier */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Documentos da Cotação</label>
                        <div
                          className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-4 text-center hover:border-primary/50 transition-colors cursor-pointer"
                          onClick={() => document.getElementById(`file-upload-${index}`)?.click()}
                        >
                          <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                          <p className="text-sm">Clique para fazer upload ou arraste os arquivos aqui</p>
                          <p className="text-xs text-muted-foreground">PDF, DOC, XLS, imagens até 10MB cada</p>
                        </div>
                        
                        <Input
                          id={`file-upload-${index}`}
                          type="file"
                          multiple
                          className="hidden"
                          onChange={(e) => handleFileUpload(index, e.target.files)}
                        />

                        {/* File Preview */}
                        {uploadedFiles[index] && uploadedFiles[index].length > 0 && (
                          <div className="space-y-2">
                            {uploadedFiles[index].map((file, fileIndex) => (
                              <div key={fileIndex} className="flex items-center justify-between p-2 bg-muted rounded-md">
                                <div className="flex items-center gap-2">
                                  <FileText className="h-4 w-4 text-muted-foreground" />
                                  <span className="text-sm">{file.name}</span>
                                  <Badge variant="outline" className="text-xs">
                                    {(file.size / 1024 / 1024).toFixed(2)} MB
                                  </Badge>
                                </div>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeFile(index, fileIndex)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Comparison Tab */}
          <TabsContent value="comparison" className="space-y-6">
            <h3 className="text-lg font-medium flex items-center gap-2">
              <GitCompare className="h-4 w-4" />
              Comparação de Cotações
            </h3>

            {supplierQuotations.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <GitCompare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">Nenhuma cotação para comparar</h3>
                  <p className="text-muted-foreground">
                    Adicione cotações na aba anterior para visualizar a comparação.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card>
                    <CardContent className="p-4">
                      <div className="text-center">
                        <h4 className="text-2xl font-bold text-green-600">
                          {supplierQuotations.length}
                        </h4>
                        <p className="text-sm text-muted-foreground">Cotações Recebidas</p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4">
                      <div className="text-center">
                        <h4 className="text-2xl font-bold text-blue-600">
                          R$ {getBestQuotation() ? parseFloat(getBestQuotation()!.quotedValue).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '0,00'}
                        </h4>
                        <p className="text-sm text-muted-foreground">Melhor Preço</p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4">
                      <div className="text-center">
                        <h4 className="text-2xl font-bold text-purple-600">
                          R$ {calculateTotalValue().toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </h4>
                        <p className="text-sm text-muted-foreground">Valor Total Cotado</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Comparison Table */}
                <Card>
                  <CardHeader>
                    <CardTitle>Comparativo Detalhado</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left p-3">Fornecedor</th>
                            <th className="text-left p-3">Valor</th>
                            <th className="text-left p-3">Pagamento</th>
                            <th className="text-left p-3">Entrega</th>
                            <th className="text-left p-3">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {supplierQuotations.map((quotation, index) => {
                            const supplier = suppliers?.find(s => s.id === quotation.supplierId);
                            const isBest = getBestQuotation() === quotation;
                            
                            return (
                              <tr key={index} className={cn(
                                "border-b",
                                isBest && "bg-green-50 dark:bg-green-950/20"
                              )}>
                                <td className="p-3">
                                  <div className="flex items-center gap-2">
                                    {supplier?.name || 'N/A'}
                                    {isBest && <Badge variant="default" className="text-xs">Melhor Preço</Badge>}
                                  </div>
                                </td>
                                <td className="p-3">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium">
                                      R$ {parseFloat(quotation.quotedValue || '0').toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </span>
                                    {isBest ? (
                                      <TrendingDown className="h-4 w-4 text-green-600" />
                                    ) : (
                                      <TrendingUp className="h-4 w-4 text-red-600" />
                                    )}
                                  </div>
                                </td>
                                <td className="p-3 text-sm">{quotation.paymentConditions}</td>
                                <td className="p-3 text-sm">{quotation.deliveryDays} dias</td>
                                <td className="p-3">
                                  <Badge variant={isBest ? "default" : "secondary"}>
                                    {isBest ? 'Recomendado' : 'Cotado'}
                                  </Badge>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          {/* Finalization Tab */}
          <TabsContent value="finalization" className="space-y-6">
            <h3 className="text-lg font-medium flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Finalizar Cotação
            </h3>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Resumo da Cotação</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="totalValue"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Valor Total da Cotação *</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <span className="absolute left-3 top-2.5 text-sm text-muted-foreground">R$</span>
                                <Input
                                  {...field}
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  placeholder="0,00"
                                  className="pl-10"
                                />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="paymentMethodId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Forma de Pagamento *</FormLabel>
                            <FormControl>
                              <Select
                                onValueChange={field.onChange}
                                value={field.value?.toString()}
                                disabled={paymentMethodsLoading}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecione a forma de pagamento..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {paymentMethods && paymentMethods.map((method: any) => (
                                    <SelectItem key={method.id} value={method.id.toString()}>
                                      {method.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="quotationNotes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Observações da Cotação</FormLabel>
                          <FormControl>
                            <Textarea
                              {...field}
                              rows={3}
                              placeholder="Observações gerais sobre o processo de cotação..."
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>

                {/* Upload Progress */}
                {isUploading && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Fazendo upload dos documentos...</span>
                      <span className="text-sm text-muted-foreground">{Math.round(uploadProgress)}%</span>
                    </div>
                    <Progress value={uploadProgress} className="h-2" />
                  </div>
                )}

                {/* Form Actions */}
                <div className="flex justify-end gap-3 pt-6 border-t">
                  {onClose && (
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={onClose}
                      disabled={quotationMutation.isPending || isUploading}
                    >
                      Cancelar
                    </Button>
                  )}
                  <Button 
                    type="submit" 
                    disabled={quotationMutation.isPending || isUploading || supplierQuotations.length === 0}
                    className="min-w-[180px]"
                  >
                    {quotationMutation.isPending || isUploading ? (
                      "Processando..."
                    ) : (
                      "Enviar para Aprovação A2"
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}