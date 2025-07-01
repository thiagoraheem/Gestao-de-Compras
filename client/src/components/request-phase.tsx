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
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { URGENCY_LEVELS, CATEGORY_OPTIONS, URGENCY_LABELS, CATEGORY_LABELS } from "@/lib/types";
import { CloudUpload, FileText, X, Check, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

const requestSchema = z.object({
  costCenterId: z.coerce.number().min(1, "Centro de custo é obrigatório"),
  category: z.string().min(1, "Categoria é obrigatória"),
  urgency: z.string().min(1, "Urgência é obrigatória"),
  justification: z.string().min(10, "Justificativa deve ter pelo menos 10 caracteres"),
  idealDeliveryDate: z.string().optional(),
  availableBudget: z.string().optional(),
  additionalInfo: z.string().optional(),
});

type RequestFormData = z.infer<typeof requestSchema>;

interface RequestPhaseProps {
  onClose?: () => void;
  className?: string;
}

export default function RequestPhase({ onClose, className }: RequestPhaseProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isUploading, setIsUploading] = useState(false);

  const { data: costCenters, isLoading: costCentersLoading } = useQuery<any[]>({
    queryKey: ["/api/cost-centers"],
  });

  const form = useForm<RequestFormData>({
    resolver: zodResolver(requestSchema),
    defaultValues: {
      costCenterId: 0,
      category: "",
      urgency: "",
      justification: "",
      idealDeliveryDate: "",
      availableBudget: "",
      additionalInfo: "",
    },
  });

  const createRequestMutation = useMutation({
    mutationFn: async (data: RequestFormData) => {
      const requestData = {
        ...data,
        requesterId: 1, // TODO: Get from auth context
        costCenterId: Number(data.costCenterId),
        availableBudget: data.availableBudget ? parseFloat(data.availableBudget) : undefined,
        idealDeliveryDate: data.idealDeliveryDate || undefined,
      };
      
      // Create the request first
      const response = await apiRequest("POST", "/api/purchase-requests", requestData);
      const createdRequest = response as any;
      
      // If there are files, upload them
      if (uploadedFiles.length > 0 && createdRequest?.id) {
        setIsUploading(true);
        for (let i = 0; i < uploadedFiles.length; i++) {
          const file = uploadedFiles[i];
          const formData = new FormData();
          formData.append('file', file);
          formData.append('attachmentType', 'requisition');
          
          await apiRequest("POST", `/api/purchase-requests/${createdRequest.id}/attachments`, formData);
          setUploadProgress(((i + 1) / uploadedFiles.length) * 100);
        }
        setIsUploading(false);
      }
      
      return createdRequest;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-requests"] });
      toast({
        title: "Sucesso",
        description: "Solicitação criada com sucesso!",
      });
      form.reset();
      setUploadedFiles([]);
      setUploadProgress(0);
      onClose?.();
    },
    onError: (error: any) => {
      setIsUploading(false);
      toast({
        title: "Erro",
        description: error?.message || "Falha ao criar solicitação",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: RequestFormData) => {
    if (uploadedFiles.length === 0) {
      toast({
        title: "Arquivo obrigatório",
        description: "É necessário fazer upload da planilha de requisição",
        variant: "destructive",
      });
      return;
    }
    createRequestMutation.mutate(data);
  };

  const handleFileUpload = (files: FileList | null) => {
    if (!files) return;
    
    const validFiles = Array.from(files).filter(file => {
      const validTypes = [
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/csv'
      ];
      const maxSize = 10 * 1024 * 1024; // 10MB
      
      if (!validTypes.includes(file.type) && !file.name.match(/\.(xlsx?|csv)$/i)) {
        toast({
          title: "Tipo de arquivo inválido",
          description: "Apenas arquivos XLS, XLSX e CSV são permitidos",
          variant: "destructive",
        });
        return false;
      }
      
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
    
    setUploadedFiles(prev => [...prev, ...validFiles]);
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const isFormValid = form.formState.isValid && uploadedFiles.length > 0;

  return (
    <Card className={cn("w-full max-w-4xl", className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Nova Solicitação de Compra
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Required Fields Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-foreground flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                Campos Obrigatórios
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="costCenterId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Centro de Custo *</FormLabel>
                      <FormControl>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value?.toString()}
                          disabled={costCentersLoading}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o centro de custo..." />
                          </SelectTrigger>
                          <SelectContent>
                            {costCenters && (costCenters as any[]).map((center: any) => (
                              <SelectItem key={center.id} value={center.id.toString()}>
                                {center.code} - {center.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Categoria de Compra *</FormLabel>
                      <FormControl>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione a categoria..." />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(CATEGORY_OPTIONS).map(([key, value]) => (
                              <SelectItem key={value} value={value}>
                                {CATEGORY_LABELS[value]}
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
                name="urgency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Grau de Urgência *</FormLabel>
                    <FormControl>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o grau de urgência..." />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(URGENCY_LEVELS).map(([key, value]) => (
                            <SelectItem key={value} value={value}>
                              {URGENCY_LABELS[value]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* File Upload Section */}
              <div className="space-y-2">
                <FormLabel>Upload de Planilha (Requisição de Compra) *</FormLabel>
                <div className="space-y-3">
                  <div
                    className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center hover:border-primary/50 transition-colors cursor-pointer"
                    onClick={() => document.getElementById('file-upload')?.click()}
                  >
                    <CloudUpload className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Clique para fazer upload ou arraste os arquivos aqui</p>
                      <p className="text-xs text-muted-foreground">XLS, XLSX, CSV até 10MB cada</p>
                    </div>
                  </div>
                  
                  <Input
                    id="file-upload"
                    type="file"
                    multiple
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                    onChange={(e) => handleFileUpload(e.target.files)}
                  />

                  {/* File Preview */}
                  {uploadedFiles.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium">Arquivos selecionados:</h4>
                      {uploadedFiles.map((file, index) => (
                        <div key={index} className="flex items-center justify-between p-2 bg-muted rounded-md">
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
                            onClick={() => removeFile(index)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <FormField
                control={form.control}
                name="justification"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Justificativa *</FormLabel>
                    <FormControl>
                      <Textarea 
                        {...field} 
                        rows={4}
                        placeholder="Descreva detalhadamente a necessidade e justificativa para esta compra..."
                        className="resize-none"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Optional Fields Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-foreground">Informações Adicionais</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="idealDeliveryDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Prazo Ideal de Entrega</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="availableBudget"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Orçamento Disponível</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <span className="absolute left-3 top-2.5 text-sm text-muted-foreground">R$</span>
                          <Input 
                            {...field} 
                            placeholder="0,00" 
                            className="pl-10"
                            type="number"
                            step="0.01"
                            min="0"
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="additionalInfo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mais Informações</FormLabel>
                    <FormControl>
                      <Textarea 
                        {...field} 
                        rows={3}
                        placeholder="Informações adicionais relevantes para a compra..."
                        className="resize-none"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Upload Progress */}
            {isUploading && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Fazendo upload dos arquivos...</span>
                  <span className="text-sm text-muted-foreground">{Math.round(uploadProgress)}%</span>
                </div>
                <Progress value={uploadProgress} className="h-2" />
              </div>
            )}

            {/* Form Actions */}
            <div className="flex justify-between items-center pt-6 border-t">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {isFormValid ? (
                  <>
                    <Check className="h-4 w-4 text-green-600" />
                    <span>Formulário válido e pronto para envio</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="h-4 w-4 text-yellow-600" />
                    <span>Preencha todos os campos obrigatórios</span>
                  </>
                )}
              </div>
              
              <div className="flex gap-3">
                {onClose && (
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={onClose}
                    disabled={createRequestMutation.isPending || isUploading}
                  >
                    Cancelar
                  </Button>
                )}
                <Button 
                  type="submit" 
                  disabled={createRequestMutation.isPending || isUploading || !isFormValid}
                  className="min-w-[140px]"
                >
                  {createRequestMutation.isPending || isUploading ? (
                    "Processando..."
                  ) : (
                    "Criar Solicitação"
                  )}
                </Button>
              </div>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}