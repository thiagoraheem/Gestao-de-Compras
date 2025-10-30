import React, { useState, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  DollarSign,
  FileText,
  CheckCircle,
  X,
  Upload,
  Package,
  Calculator,
  Download,
  Trash2,
  Clock,
  Eye,
  History,
  Truck,
} from "lucide-react";
import debug from "@/lib/debug";

const updateSupplierQuotationSchema = z.object({
  items: z.array(
    z.object({
      quotationItemId: z.number(),
      unitPrice: z.string().optional(),
      deliveryDays: z.string().optional(),
      brand: z.string().optional(),
      model: z.string().optional(),
      observations: z.string().optional(),
      discountPercentage: z.string().optional(),
      discountValue: z.string().optional(),
      isAvailable: z.boolean().default(true),
      unavailabilityReason: z.string().optional(),
      availableQuantity: z.string().optional(),
      confirmedUnit: z.string().optional(),
      quantityAdjustmentReason: z.string().optional(),
    })
    .refine((data) => {
      // Se o produto estiver disponível, o preço unitário é obrigatório
      if (data.isAvailable) {
        return data.unitPrice && data.unitPrice.trim().length > 0;
      }
      return true; // Para produtos indisponíveis, não validamos o preço
    }, {
      message: "Preço unitário é obrigatório para produtos disponíveis",
      path: ["unitPrice"],
    })
    .refine((data) => {
      // Se o produto estiver indisponível, o motivo da indisponibilidade é obrigatório
      if (!data.isAvailable) {
        return data.unavailabilityReason && data.unavailabilityReason.trim().length > 0;
      }
      return true; // Para produtos disponíveis, não validamos o motivo
    }, {
      message: "Motivo da indisponibilidade é obrigatório para produtos indisponíveis",
      path: ["unavailabilityReason"],
    })
    .refine((data) => {
      // Se quantidade disponível for diferente da solicitada, motivo é obrigatório
      if (data.availableQuantity && data.availableQuantity.trim().length > 0) {
        const availableQty = parseFloat(data.availableQuantity);
        if (!isNaN(availableQty) && availableQty > 0) {
          return true; // Quantidade válida
        }
      }
      return true; // Sem quantidade disponível especificada
    }, {
      message: "Quantidade disponível deve ser um número válido",
      path: ["availableQuantity"],
    })
  ),
  paymentTerms: z.string().optional(),
  deliveryTerms: z.string().optional(),
  warrantyPeriod: z.string().optional(),
  observations: z.string().optional(),
  discountType: z.enum(["none", "percentage", "fixed"]).default("none"),
  discountValue: z.string().optional(),
  includesFreight: z.boolean().default(false),
  freightValue: z.string().optional(),
});

type UpdateSupplierQuotationData = z.infer<
  typeof updateSupplierQuotationSchema
>;

interface QuotationItem {
  id: number;
  itemCode: string;
  description: string;
  quantity: string;
  unit: string;
  specifications?: string;
  deliveryDeadline?: string;
}

interface SupplierQuotationItem {
  id: number;
  quotationItemId: number;
  unitPrice: string;
  deliveryDays: number;
  brand?: string;
  model?: string;
  observations?: string;
  discountPercentage?: string;
  discountValue?: string;
  originalTotalPrice?: string;
  discountedTotalPrice?: string;
  isAvailable?: boolean;
  unavailabilityReason?: string;
  availableQuantity?: string;
  confirmedUnit?: string;
  quantityAdjustmentReason?: string;
  fulfillmentPercentage?: number;
}

interface ExistingSupplierQuotation {
  id: number;
  items: SupplierQuotationItem[];
  paymentTerms?: string;
  deliveryTerms?: string;
  warrantyPeriod?: string;
  observations?: string;
  status?: string;
  receivedAt?: string;
  totalValue?: string;
  discountType?: string;
  discountValue?: string;
  subtotalValue?: string;
  finalValue?: string;
  includesFreight?: boolean;
  freightValue?: string;
}

interface SupplierAttachment {
  id: number;
  fileName: string;
  filePath: string;
  fileType: string;
  fileSize: number;
  uploadedAt: string;
  attachmentType: string;
}

interface UpdateSupplierQuotationProps {
  isOpen: boolean;
  onClose: () => void;
  quotationId: number;
  supplierId: number;
  supplierName: string;
  onSuccess?: () => void;
}

export default function UpdateSupplierQuotation({
  isOpen,
  onClose,
  quotationId,
  supplierId,
  supplierName,
  onSuccess,
}: UpdateSupplierQuotationProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [viewMode, setViewMode] = useState<'edit' | 'view'>('edit');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch quotation items
  const { data: quotationItems = [], isLoading: isLoadingItems } = useQuery<
    QuotationItem[]
  >({
    queryKey: [`/api/quotations/${quotationId}/items`],
    enabled: !!quotationId && isOpen,
  });

  // Fetch existing supplier quotation items
  const { data: existingSupplierQuotation } =
    useQuery<ExistingSupplierQuotation | null>({
      queryKey: [
        `/api/quotations/${quotationId}/supplier-quotations/${supplierId}`,
      ],
      enabled: !!quotationId && !!supplierId && isOpen,
    });

  // Fetch existing attachments
  const { data: existingAttachments = [] } = useQuery<SupplierAttachment[]>({
    queryKey: [`/api/quotations/${quotationId}/supplier-quotations/${supplierId}/attachments`],
    enabled: !!quotationId && !!supplierId && isOpen,
  });

  const form = useForm<UpdateSupplierQuotationData>({
    resolver: zodResolver(updateSupplierQuotationSchema),
    defaultValues: {
      items: [],
      paymentTerms: "",
      deliveryTerms: "",
      warrantyPeriod: "",
      observations: "",
      discountType: "none",
      discountValue: "",
      includesFreight: false,
      freightValue: "",
    },
  });

  // Initialize form with quotation items
  useEffect(() => {
    if (quotationItems.length > 0) {
      const formItems = quotationItems.map((item) => ({
        quotationItemId: item.id,
        unitPrice: "",
        deliveryDays: "",
        brand: "",
        model: "",
        observations: "",
        discountPercentage: "",
        discountValue: "",
        isAvailable: true,
        unavailabilityReason: "",
        availableQuantity: "",
        confirmedUnit: "",
        quantityAdjustmentReason: "",
      }));

      form.setValue("items", formItems);
    }
  }, [quotationItems, form]);

  // Determine view mode based on quotation status
  useEffect(() => {
    if (existingSupplierQuotation) {
      setViewMode(existingSupplierQuotation.status === 'received' ? 'view' : 'edit');
    }
  }, [existingSupplierQuotation]);

  // Load existing supplier quotation data
  useEffect(() => {
    if (existingSupplierQuotation && existingSupplierQuotation.items) {
      const formItems = quotationItems.map((item) => {
        const existingItem = existingSupplierQuotation.items.find(
          (si: SupplierQuotationItem) => si.quotationItemId === item.id,
        );

        return {
          quotationItemId: item.id,
          unitPrice: existingItem?.unitPrice || "",
          deliveryDays: existingItem?.deliveryDays?.toString() || "",
          brand: existingItem?.brand || "",
          model: existingItem?.model || "",
          observations: existingItem?.observations || "",
          discountPercentage: existingItem?.discountPercentage || "",
          discountValue: existingItem?.discountValue || "",
          isAvailable: existingItem?.isAvailable !== false,
          unavailabilityReason: existingItem?.unavailabilityReason || "",
          availableQuantity: existingItem?.availableQuantity || "",
          confirmedUnit: existingItem?.confirmedUnit || "",
          quantityAdjustmentReason: existingItem?.quantityAdjustmentReason || "",
        };
      });

      form.setValue("items", formItems);
      form.setValue(
        "paymentTerms",
        existingSupplierQuotation.paymentTerms || "",
      );
      form.setValue(
        "deliveryTerms",
        existingSupplierQuotation.deliveryTerms || "",
      );
      form.setValue(
        "warrantyPeriod",
        existingSupplierQuotation.warrantyPeriod || "",
      );
      form.setValue(
        "observations",
        existingSupplierQuotation.observations || "",
      );
      form.setValue(
        "discountType",
        (existingSupplierQuotation.discountType as "none" | "percentage" | "fixed") || "none",
      );
      form.setValue(
        "discountValue",
        existingSupplierQuotation.discountValue || "",
      );
      form.setValue(
        "includesFreight",
        existingSupplierQuotation.includesFreight || false,
      );
      form.setValue(
        "freightValue",
        existingSupplierQuotation.freightValue || "",
      );
    }
  }, [existingSupplierQuotation, quotationItems, form]);

  const updateMutation = useMutation({
    mutationFn: async (data: UpdateSupplierQuotationData) => {
      // Calculate total value from items (only available items)
      const totalValue = data.items.reduce((sum, item) => {
        if (!item.unitPrice || !item.isAvailable) return sum;

        const correspondingQuotationItem = quotationItems.find(
          (qi) => qi.id === item.quotationItemId,
        );
        const quantity = parseFloat(
          correspondingQuotationItem?.quantity || "0",
        );
        const unitPrice = parseNumberFromCurrency(item.unitPrice);

        return sum + quantity * unitPrice;
      }, 0);

      const processedItems = data.items.map((item) => {
        const correspondingQuotationItem = quotationItems.find(
          (qi) => qi.id === item.quotationItemId,
        );
        const quantity = parseFloat(correspondingQuotationItem?.quantity || "0");
        const unitPrice = parseNumberFromCurrency(item.unitPrice);
        const originalTotalPrice = quantity * unitPrice;

        // Calculate discounted total price
        let discountedTotalPrice = originalTotalPrice;
        let discountPercentage = null;
        let discountValue = null;

        if (item.discountPercentage) {
          discountPercentage = parseFloat(item.discountPercentage);
          discountedTotalPrice = originalTotalPrice * (1 - discountPercentage / 100);
        } else if (item.discountValue) {
          discountValue = parseNumberFromCurrency(item.discountValue);
          discountedTotalPrice = Math.max(0, originalTotalPrice - discountValue);
        }

        return {
          quotationItemId: item.quotationItemId,
          unitPrice,
          deliveryDays: item.deliveryDays ? parseInt(item.deliveryDays) : null,
          brand: item.brand || null,
          model: item.model || null,
          observations: item.observations || null,
          discountPercentage,
          discountValue,
          originalTotalPrice,
          discountedTotalPrice,
          isAvailable: item.isAvailable,
          unavailabilityReason: item.unavailabilityReason || null,
          availableQuantity: item.availableQuantity ? parseFloat(item.availableQuantity) : null,
          confirmedUnit: item.confirmedUnit || null,
          quantityAdjustmentReason: item.quantityAdjustmentReason || null,
        };
      });

      // Calculate final values
      const subtotalValue = calculateSubtotal();
      const finalValue = calculateFinalTotal();

      return apiRequest(
        `/api/quotations/${quotationId}/update-supplier-quotation`,
        {
          method: "POST",
          body: {
            supplierId,
            items: processedItems,
            totalValue: finalValue,
            subtotalValue,
            finalValue,
            discountType: data.discountType,
            discountValue: data.discountValue ? (
              data.discountType === "percentage" 
                ? parseFloat(data.discountValue)
                : parseNumberFromCurrency(data.discountValue)
            ) : null,
            includesFreight: data.includesFreight,
            freightValue: data.freightValue ? parseNumberFromCurrency(data.freightValue) : null,
            paymentTerms: data.paymentTerms || null,
            deliveryTerms: data.deliveryTerms || null,
            warrantyPeriod: data.warrantyPeriod || null,
            observations: data.observations || null,
          },
        },
      );
    },
    onSuccess: async () => {
      let uploadSuccess = true;
      
      // Upload files if any
      if (selectedFiles.length > 0) {
        try {
          await uploadFiles();
        } catch (error) {
          uploadSuccess = false;
          debug.error("Upload failed:", error);
        }
      }

      // Show success message only if everything succeeded
      if (uploadSuccess) {
        toast({
          title: "Sucesso",
          description: selectedFiles.length > 0 
            ? "Cotação do fornecedor atualizada e arquivos enviados com sucesso!" 
            : "Cotação do fornecedor atualizada com sucesso!",
        });
      } else {
        toast({
          title: "Parcialmente concluído",
          description: "Cotação foi atualizada, mas houve erro no upload dos arquivos.",
          variant: "destructive",
        });
      }

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({
        queryKey: [`/api/quotations/${quotationId}/supplier-quotations`],
      });
      queryClient.invalidateQueries({
        queryKey: [`/api/quotations/${quotationId}/supplier-comparison`],
      });

      form.reset();
      setSelectedFiles([]);
      onClose();
      onSuccess?.();
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error?.message || "Não foi possível atualizar a cotação.",
        variant: "destructive",
      });
    },
  });

  const uploadFiles = async () => {
    if (selectedFiles.length === 0) return;

    setIsUploading(true);
    setUploadProgress(0);

    try {
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        
        // Validate file before upload
        if (!validateFile(file)) {
          throw new Error(`Arquivo ${file.name} não é válido`);
        }

        debug.log("Uploading file:", {
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
          supplierId,
          quotationId
        });

        const formData = new FormData();
        formData.append("file", file);
        formData.append("attachmentType", "supplier_proposal");
        formData.append("supplierId", supplierId.toString());

        const response = await apiRequest(
          `/api/quotations/${quotationId}/upload-supplier-file`,
          {
            method: "POST",
            body: formData,
          },
        );

        debug.log("Upload response:", response);
        setUploadProgress(((i + 1) / selectedFiles.length) * 100);
      }

      toast({
        title: "Sucesso",
        description: `${selectedFiles.length} arquivo(s) enviado(s) com sucesso!`,
      });
    } catch (error: any) {
      debug.error("Upload error:", error);
      toast({
        title: "Erro no upload",
        description: error?.message || "Alguns arquivos não puderam ser enviados.",
        variant: "destructive",
      });
      throw error; // Re-throw to be caught by the calling function
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const validateFile = (file: File): boolean => {
    // Check file size (10MB limit)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      toast({
        title: "Arquivo muito grande",
        description: `O arquivo ${file.name} excede o limite de 10MB.`,
        variant: "destructive",
      });
      return false;
    }

    // Check file type
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
      'image/png',
      'image/jpeg',
      'image/jpg'
    ];

    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Tipo de arquivo não suportado",
        description: `O arquivo ${file.name} não é um tipo suportado. Apenas PDF, DOC, DOCX, XLS, XLSX, TXT, PNG, JPG são permitidos.`,
        variant: "destructive",
      });
      return false;
    }

    return true;
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      setSelectedFiles(Array.from(files));
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = (data: UpdateSupplierQuotationData) => {
    updateMutation.mutate(data);
  };

  const formatCurrencyInput = (value: string) => {
    // Remove all non-numeric characters
    let numericValue = value.replace(/[^\d]/g, "");

    // If empty, return empty
    if (!numericValue) return "";

    // Convert to number and format with decimal places
    const numberValue = parseInt(numericValue) / 100;

    return numberValue.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const parseNumberFromCurrency = (value: string) => {
    if (!value) return 0;

    // Remove all non-numeric characters except comma and period
    let cleanValue = value.replace(/[^\d.,]/g, "");

    // Handle Brazilian format (e.g., "2.500,00" or "1.000,50")
    if (cleanValue.includes(".") && cleanValue.includes(",")) {
      // This is likely Brazilian format with thousands separator (.) and decimal (,)
      // Remove the thousands separators (all dots except the last one before comma)
      const parts = cleanValue.split(",");
      if (parts.length === 2) {
        // Remove all dots from the integer part
        const integerPart = parts[0].replace(/\./g, "");
        cleanValue = integerPart + "." + parts[1];
      }
    } else if (cleanValue.includes(",") && !cleanValue.includes(".")) {
      // This is likely just decimal separator as comma (e.g., "1000,50")
      cleanValue = cleanValue.replace(",", ".");
    }
    // If only contains dots or only numbers, assume it's already in correct format

    return parseFloat(cleanValue) || 0;
  };

  const calculateItemTotal = (item: any, index: number) => {
    if (!item || !item.unitPrice) return 0;

    const correspondingQuotationItem = quotationItems.find(
      (qi) => qi.id === item.quotationItemId,
    );
    
    // Use available quantity if specified, otherwise use requested quantity
    let quantity = parseFloat(correspondingQuotationItem?.quantity || "0");
    if (item.availableQuantity && !isNaN(parseFloat(item.availableQuantity))) {
      quantity = parseFloat(item.availableQuantity);
    }
    
    const unitPrice = parseNumberFromCurrency(item.unitPrice);
    const originalTotal = quantity * unitPrice;

    // Apply item-level discount
    let discountedTotal = originalTotal;
    if (item.discountPercentage) {
      const discountPercent = parseFloat(item.discountPercentage) || 0;
      discountedTotal = originalTotal * (1 - discountPercent / 100);
    } else if (item.discountValue) {
      const discountValue = parseNumberFromCurrency(item.discountValue);
      discountedTotal = Math.max(0, originalTotal - discountValue);
    }

    return discountedTotal;
  };

  const calculateSubtotal = () => {
    const watchedItems = form.watch("items") || [];
    return watchedItems.reduce((sum, item, index) => {
      if (!item || !item.isAvailable) return sum;
      return sum + calculateItemTotal(item, index);
    }, 0);
  };

  const calculateFinalTotal = () => {
    const subtotal = calculateSubtotal();
    const discountType = form.watch("discountType");
    const discountValue = form.watch("discountValue");

    if (discountType === "none" || !discountValue) {
      return subtotal;
    }

    if (discountType === "percentage") {
      const discountPercent = parseFloat(discountValue) || 0;
      return subtotal * (1 - discountPercent / 100);
    } else if (discountType === "fixed") {
      const discountAmount = parseNumberFromCurrency(discountValue);
      return Math.max(0, subtotal - discountAmount);
    }

    return subtotal;
  };

  const calculateTotalValue = () => {
    const finalTotal = calculateFinalTotal();
    const includesFreight = form.watch("includesFreight");
    const freightValue = form.watch("freightValue");
    
    if (includesFreight && freightValue) {
      const freightAmount = parseNumberFromCurrency(freightValue);
      return finalTotal + freightAmount;
    }
    
    return finalTotal;
  };

  if (isLoadingItems) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-center p-8">
            <div className="text-center">
              <Package className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-500" />
              <p>Carregando itens da cotação...</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {viewMode === 'view' ? (
              <>
                <Eye className="h-5 w-5" />
                Visualizar Cotação - {supplierName}
              </>
            ) : (
              <>
                <DollarSign className="h-5 w-5" />
                Atualizar Cotação - {supplierName}
              </>
            )}
          </DialogTitle>
          {existingSupplierQuotation && (
            <div className="flex items-center gap-4 mt-2">
              <Badge variant={existingSupplierQuotation.status === 'received' ? 'default' : 'secondary'}>
                {existingSupplierQuotation.status === 'received' ? 'Recebida' : 'Pendente'}
              </Badge>
              {existingSupplierQuotation.receivedAt && (
                <span className="text-sm text-gray-500">
                  Recebida em: {format(new Date(existingSupplierQuotation.receivedAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                </span>
              )}
              {existingSupplierQuotation.totalValue && (
                <span className="text-sm font-semibold text-green-600">
                  Total: R$ {parseFloat(existingSupplierQuotation.totalValue).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              )}
            </div>
          )}
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-6"
          >
            {/* Items Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Itens da Cotação
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left p-2 text-xs font-medium text-gray-600 min-w-[180px]">Item</th>
                        <th className="text-left p-2 text-xs font-medium text-gray-600 min-w-[120px]">Marca / Modelo</th>
                        <th className="text-left p-2 text-xs font-medium text-gray-600 min-w-[100px]">Preço + Original</th>
                        <th className="text-left p-2 text-xs font-medium text-gray-600 min-w-[60px]">Desc. %</th>
                        <th className="text-left p-2 text-xs font-medium text-gray-600 min-w-[80px]">Desc. Valor</th>
                        <th className="text-left p-2 text-xs font-medium text-gray-600 min-w-[60px]">Prazo (dias)</th>
                        <th className="text-left p-2 text-xs font-medium text-gray-600 min-w-[110px]">Quantidade Disponível</th>
                        <th className="text-left p-2 text-xs font-medium text-gray-600 min-w-[100px]">Disponibilidade</th>
                        <th className="text-left p-2 text-xs font-medium text-gray-600 min-w-[90px]">Total Final</th>
                      </tr>
                    </thead>
                    <tbody>
                      {quotationItems.map((item, index) => (
                        <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="p-2 align-top">
                            <div className="space-y-1">
                              <div className="font-medium text-xs break-words">{item.description}</div>
                              <div className="flex items-center gap-1 text-xs text-gray-500">
                                <Badge variant="secondary" className="text-xs px-1 py-0">
                                  Solicitado: {parseFloat(item.quantity).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} {item.unit}
                                </Badge>
                                {(() => {
                                  const availableQty = form.watch(`items.${index}.availableQuantity`);
                                  const requestedQty = parseFloat(item.quantity);
                                  
                                  if (availableQty && !isNaN(parseFloat(availableQty))) {
                                    const available = parseFloat(availableQty);
                                    const isDifferent = available !== requestedQty;
                                    
                                    return (
                                      <Badge 
                                        variant={isDifferent ? "destructive" : "default"} 
                                        className={`text-xs px-1 py-0 ${isDifferent ? "bg-orange-100 text-orange-800 border-orange-300" : "bg-green-100 text-green-800 border-green-300"}`}
                                      >
                                        Disponível: {available.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} {form.watch(`items.${index}.confirmedUnit`) || item.unit}
                                      </Badge>
                                    );
                                  }
                                  return null;
                                })()}
                              </div>
                              {item.specifications && (
                                <div className="text-xs text-gray-500 italic bg-gray-50 p-1 rounded">
                                  {item.specifications}
                                </div>
                              )}
                              <div className="space-y-1">
                                <FormField
                                  control={form.control}
                                  name={`items.${index}.observations`}
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormControl>
                                        <Input
                                          {...field}
                                          placeholder="Observações"
                                          readOnly={viewMode === 'view'}
                                          className="text-xs h-6"
                                        />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="p-2 align-top">
                            <div className="space-y-1">
                              <FormField
                                control={form.control}
                                name={`items.${index}.brand`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormControl>
                                      <Input
                                        {...field}
                                        placeholder="Marca"
                                        readOnly={viewMode === 'view'}
                                        className="text-xs h-6"
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={form.control}
                                name={`items.${index}.model`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormControl>
                                      <Input
                                        {...field}
                                        placeholder="Modelo"
                                        readOnly={viewMode === 'view'}
                                        className="text-xs h-6"
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </div>
                          </td>
                          <td className="p-2 align-top">
                            <div className="space-y-1">
                              <FormField
                                control={form.control}
                                name={`items.${index}.unitPrice`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormControl>
                                      <Input
                                        {...field}
                                        placeholder="1.000,00"
                                        readOnly={viewMode === 'view'}
                                        className="text-xs h-6"
                                        autoComplete="off"
                                        onChange={(e) => {
                                          if (viewMode === 'view') return;
                                          let inputValue = e.target.value;
                                          if (/^\d+$/.test(inputValue)) {
                                            field.onChange(inputValue);
                                          } else {
                                            const cleanValue = inputValue.replace(/[^\d.,]/g, "");
                                            field.onChange(cleanValue);
                                          }
                                        }}
                                        onBlur={(e) => {
                                          if (viewMode === 'view') return;
                                          const value = e.target.value;
                                          if (value) {
                                            let number;
                                            if (/^\d+$/.test(value)) {
                                              number = parseFloat(value);
                                            } else if (/^\d+[.,]\d+$/.test(value)) {
                                              number = parseFloat(value.replace(",", "."));
                                            } else {
                                              const cleanValue = value.replace(/[^\d.,]/g, "");
                                              number = parseFloat(cleanValue.replace(",", "."));
                                            }
                                            if (!isNaN(number)) {
                                              const formatted = number.toLocaleString("pt-BR", {
                                                minimumFractionDigits: 2,
                                                maximumFractionDigits: 2,
                                              });
                                              field.onChange(formatted);
                                            }
                                          }
                                        }}
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <div className="text-xs text-gray-500">
                                Original: R$ {(() => {
                                  const unitPrice = form.watch(`items.${index}.unitPrice`);
                                  if (!unitPrice) return "0,00";
                                  const quantity = parseFloat(item.quantity);
                                  const price = parseNumberFromCurrency(unitPrice);
                                  const total = quantity * price;
                                  return isNaN(total) ? "0,00" : total.toLocaleString("pt-BR", {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  });
                                })()}
                              </div>
                            </div>
                          </td>
                          <td className="p-2 align-top">
                            <FormField
                              control={form.control}
                              name={`items.${index}.discountPercentage`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormControl>
                                    <Input
                                      {...field}
                                      placeholder="0"
                                      type="number"
                                      min="0"
                                      max="100"
                                      step="0.01"
                                      readOnly={viewMode === 'view'}
                                      className="text-xs h-6"
                                      autoComplete="off"
                                      onChange={(e) => {
                                        if (viewMode === 'view') return;
                                        field.onChange(e.target.value);
                                        if (e.target.value) {
                                          form.setValue(`items.${index}.discountValue`, "");
                                        }
                                      }}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </td>
                          <td className="p-2 align-top">
                            <FormField
                              control={form.control}
                              name={`items.${index}.discountValue`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormControl>
                                    <Input
                                      {...field}
                                      placeholder="0,00"
                                      readOnly={viewMode === 'view'}
                                      className="text-xs h-6"
                                      autoComplete="off"
                                      onChange={(e) => {
                                        if (viewMode === 'view') return;
                                        let inputValue = e.target.value;
                                        if (/^\d+$/.test(inputValue)) {
                                          field.onChange(inputValue);
                                        } else {
                                          const cleanValue = inputValue.replace(/[^\d.,]/g, "");
                                          field.onChange(cleanValue);
                                        }
                                        if (e.target.value) {
                                          form.setValue(`items.${index}.discountPercentage`, "");
                                        }
                                      }}
                                      onBlur={(e) => {
                                        if (viewMode === 'view') return;
                                        const value = e.target.value;
                                        if (value) {
                                          let number;
                                          if (/^\d+$/.test(value)) {
                                            number = parseFloat(value);
                                          } else if (/^\d+[.,]\d+$/.test(value)) {
                                            number = parseFloat(value.replace(",", "."));
                                          } else {
                                            const cleanValue = value.replace(/[^\d.,]/g, "");
                                            number = parseFloat(cleanValue.replace(",", "."));
                                          }
                                          if (!isNaN(number)) {
                                            const formatted = number.toLocaleString("pt-BR", {
                                              minimumFractionDigits: 2,
                                              maximumFractionDigits: 2,
                                            });
                                            field.onChange(formatted);
                                          }
                                        }
                                      }}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </td>
                          <td className="p-2 align-top">
                            <FormField
                              control={form.control}
                              name={`items.${index}.deliveryDays`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormControl>
                                    <Input
                                      {...field}
                                      placeholder="30"
                                      type="number"
                                      readOnly={viewMode === 'view'}
                                      className="text-xs h-6"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </td>
                          <td className="p-2 align-top">
                            <div className="space-y-1">
                              {/* Quantidade Disponível */}
                              <FormField
                                control={form.control}
                                name={`items.${index}.availableQuantity`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormControl>
                                      <Input
                                        {...field}
                                        placeholder={item.quantity}
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        readOnly={viewMode === 'view'}
                                        className="text-xs h-6"
                                        onChange={(e) => {
                                          if (viewMode === 'view') return;
                                          field.onChange(e.target.value);
                                          // Auto-fill confirmed unit if not set
                                          const confirmedUnit = form.watch(`items.${index}.confirmedUnit`);
                                          if (!confirmedUnit) {
                                            form.setValue(`items.${index}.confirmedUnit`, item.unit);
                                          }
                                        }}
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              
                              {/* Unidade Confirmada */}
                              <FormField
                                control={form.control}
                                name={`items.${index}.confirmedUnit`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormControl>
                                      <Input
                                        {...field}
                                        placeholder={item.unit}
                                        readOnly={viewMode === 'view'}
                                        className="text-xs h-6"
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />

                              {/* Percentual de Atendimento */}
                              {(() => {
                                const availableQty = form.watch(`items.${index}.availableQuantity`);
                                const requestedQty = parseFloat(item.quantity);
                                
                                if (availableQty && !isNaN(parseFloat(availableQty))) {
                                  const available = parseFloat(availableQty);
                                  const fulfillmentPercentage = (available / requestedQty) * 100;
                                  
                                  let badgeVariant: "default" | "secondary" | "destructive" = "default";
                                  let badgeColor = "text-green-600";
                                  
                                  if (fulfillmentPercentage < 50) {
                                    badgeVariant = "destructive";
                                    badgeColor = "text-red-600";
                                  } else if (fulfillmentPercentage < 100) {
                                    badgeVariant = "secondary";
                                    badgeColor = "text-yellow-600";
                                  }
                                  
                                  return (
                                    <div className="flex items-center gap-1">
                                      <Badge variant={badgeVariant} className={`text-xs ${badgeColor}`}>
                                        {fulfillmentPercentage.toFixed(1)}%
                                      </Badge>
                                      {fulfillmentPercentage !== 100 && (
                                        <span className="text-xs text-gray-500">
                                          ({available.toLocaleString('pt-BR')} de {requestedQty.toLocaleString('pt-BR')})
                                        </span>
                                      )}
                                    </div>
                                  );
                                }
                                return null;
                              })()}

                              {/* Motivo do Ajuste de Quantidade */}
                              {(() => {
                                const availableQty = form.watch(`items.${index}.availableQuantity`);
                                const requestedQty = parseFloat(item.quantity);
                                
                                if (availableQty && !isNaN(parseFloat(availableQty))) {
                                  const available = parseFloat(availableQty);
                                  if (available !== requestedQty) {
                                    return (
                                      <FormField
                                        control={form.control}
                                        name={`items.${index}.quantityAdjustmentReason`}
                                        render={({ field }) => (
                                          <FormItem>
                                            <FormControl>
                                              <Input
                                                {...field}
                                                placeholder="Motivo do ajuste de quantidade"
                                                readOnly={viewMode === 'view'}
                                                className="text-xs h-7 border-yellow-300 bg-yellow-50"
                                              />
                                            </FormControl>
                                            <FormMessage />
                                          </FormItem>
                                        )}
                                      />
                                    );
                                  }
                                }
                                return null;
                              })()}
                            </div>
                          </td>
                          <td className="p-2 align-top">
                                <div className="space-y-1">
                              <FormField
                                control={form.control}
                                name={`items.${index}.isAvailable`}
                                render={({ field }) => (
                                  <FormItem>
                                    <div className="flex items-center space-x-2">
                                      <input
                                        type="checkbox"
                                        checked={field.value !== false}
                                        onChange={(e) => {
                                          if (viewMode === 'view') return;
                                          field.onChange(e.target.checked);
                                          if (e.target.checked) {
                                            form.setValue(`items.${index}.unavailabilityReason`, "");
                                          }
                                        }}
                                        disabled={viewMode === 'view'}
                                        className="h-4 w-4"
                                      />
                                      <label className="text-xs font-medium">
                                        Disponível
                                      </label>
                                    </div>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              {form.watch(`items.${index}.isAvailable`) === false && (
                                <FormField
                                  control={form.control}
                                  name={`items.${index}.unavailabilityReason`}
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormControl>
                                        <Input
                                          {...field}
                                          placeholder="Motivo da indisponibilidade"
                                          readOnly={viewMode === 'view'}
                                          className="text-xs h-6"
                                        />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              )}
                            </div>
                          </td>
                          <td className="p-2 align-top">
                            <div className="font-bold text-green-600">
                              R$ {(() => {
                                const watchedItem = form.watch(`items.${index}`);
                                const finalTotal = calculateItemTotal(watchedItem, index);
                                return isNaN(finalTotal) ? "0,00" : finalTotal.toLocaleString("pt-BR", {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                });
                              })()}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Subtotal */}
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="flex justify-end">
                    <div className="text-lg font-bold text-blue-600">
                      Subtotal: R$ {(() => {
                        const total = quotationItems.reduce((sum, item, index) => {
                          const watchedItem = form.watch(`items.${index}`);
                          const itemTotal = calculateItemTotal(watchedItem, index);
                          return sum + (isNaN(itemTotal) ? 0 : itemTotal);
                        }, 0);
                        return total.toLocaleString("pt-BR", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        });
                      })()}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

                <Separator className="my-4" />

                {/* Discount Section */}
                <Card className="mb-4">
                  <CardHeader>
                    <CardTitle className="text-lg">Desconto da Proposta</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name="discountType"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Tipo de Desconto</FormLabel>
                            <Select 
                              onValueChange={field.onChange} 
                              defaultValue={field.value}
                              disabled={viewMode === 'view'}
                            >
                              <FormControl>
                                <SelectTrigger className="w-full">
                                  <SelectValue placeholder="Selecione o tipo" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="none">Sem desconto</SelectItem>
                                <SelectItem value="percentage">Percentual (%)</SelectItem>
                                <SelectItem value="fixed">Valor fixo (R$)</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="discountValue"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>
                              {form.watch("discountType") === "percentage" 
                                ? "Percentual de Desconto (%)" 
                                : "Valor do Desconto (R$)"}
                            </FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                placeholder={form.watch("discountType") === "percentage" ? "0" : "0,00"}
                                type={form.watch("discountType") === "percentage" ? "number" : "text"}
                                min="0"
                                max={form.watch("discountType") === "percentage" ? "100" : undefined}
                                step={form.watch("discountType") === "percentage" ? "0.01" : undefined}
                                readOnly={viewMode === 'view' || form.watch("discountType") === "none"}
                                className="w-full"
                                autoComplete="off"
                                onChange={(e) => {
                                  if (viewMode === 'view' || form.watch("discountType") === "none") return;
                                  
                                  if (form.watch("discountType") === "percentage") {
                                    field.onChange(e.target.value);
                                  } else {
                                    // Handle currency input for fixed discount
                                    let inputValue = e.target.value;
                                    if (/^\d+$/.test(inputValue)) {
                                      field.onChange(inputValue);
                                    } else {
                                      const cleanValue = inputValue.replace(/[^\d.,]/g, "");
                                      field.onChange(cleanValue);
                                    }
                                  }
                                }}
                                onBlur={(e) => {
                                  if (viewMode === 'view' || form.watch("discountType") !== "fixed") return;
                                  
                                  const value = e.target.value;
                                  if (value) {
                                    let number;
                                    if (/^\d+$/.test(value)) {
                                      number = parseFloat(value);
                                    } else if (/^\d+[.,]\d+$/.test(value)) {
                                      number = parseFloat(value.replace(",", "."));
                                    } else {
                                      const cleanValue = value.replace(/[^\d.,]/g, "");
                                      number = parseFloat(cleanValue.replace(",", "."));
                                    }
                                    if (!isNaN(number)) {
                                      const formatted = number.toLocaleString("pt-BR", {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2,
                                      });
                                      field.onChange(formatted);
                                    }
                                  }
                                }}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Freight Section */}
                      <FormField
                        control={form.control}
                        name="includesFreight"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                disabled={viewMode === 'view'}
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel className="flex items-center gap-2">
                                <Truck className="h-4 w-4" />
                                Inclui Frete
                              </FormLabel>
                              <p className="text-sm text-muted-foreground">
                                Marque se a proposta inclui valor de frete
                              </p>
                            </div>
                          </FormItem>
                        )}
                      />

                      {form.watch("includesFreight") && (
                        <FormField
                          control={form.control}
                          name="freightValue"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Valor do Frete (R$)</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  placeholder="0,00"
                                  type="text"
                                  readOnly={viewMode === 'view'}
                                  className="w-full"
                                  autoComplete="off"
                                  onChange={(e) => {
                                    if (viewMode === 'view') return;
                                    
                                    let inputValue = e.target.value;
                                    if (/^\d+$/.test(inputValue)) {
                                      field.onChange(inputValue);
                                    } else {
                                      const cleanValue = inputValue.replace(/[^\d.,]/g, "");
                                      field.onChange(cleanValue);
                                    }
                                  }}
                                  onBlur={(e) => {
                                    if (viewMode === 'view') return;
                                    
                                    const value = e.target.value;
                                    if (value) {
                                      let number;
                                      if (/^\d+$/.test(value)) {
                                        number = parseFloat(value);
                                      } else if (/^\d+[.,]\d+$/.test(value)) {
                                        number = parseFloat(value.replace(",", "."));
                                      } else {
                                        const cleanValue = value.replace(/[^\d.,]/g, "");
                                        number = parseFloat(cleanValue.replace(",", "."));
                                      }
                                      if (!isNaN(number)) {
                                        const formatted = number.toLocaleString("pt-BR", {
                                          minimumFractionDigits: 2,
                                          maximumFractionDigits: 2,
                                        });
                                        field.onChange(formatted);
                                      }
                                    }
                                  }}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}

                      <div className="flex flex-col justify-end">
                        <div className="text-right space-y-1">
                          <div>
                            <p className="text-sm text-gray-600">Subtotal</p>
                            <p className="text-lg font-semibold">
                              R$ {calculateSubtotal().toLocaleString("pt-BR", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </p>
                          </div>
                          {form.watch("discountType") !== "none" && form.watch("discountValue") && (
                            <div>
                              <p className="text-sm text-red-600">
                                Desconto ({form.watch("discountType") === "percentage" ? `${form.watch("discountValue")}%` : `R$ ${form.watch("discountValue")}`})
                              </p>
                              <p className="text-lg font-semibold text-red-600">
                                - R$ {(() => {
                                  const subtotal = calculateSubtotal();
                                  const discountType = form.watch("discountType");
                                  const discountValue = form.watch("discountValue");
                                  
                                  if (!discountValue) return "0,00";
                                  
                                  let discountAmount = 0;
                                  if (discountType === "percentage") {
                                    const discountPercent = parseFloat(discountValue) || 0;
                                    discountAmount = subtotal * (discountPercent / 100);
                                  } else if (discountType === "fixed") {
                                    discountAmount = parseNumberFromCurrency(discountValue);
                                  }
                                  
                                  return discountAmount.toLocaleString("pt-BR", {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  });
                                })()}
                              </p>
                            </div>
                          )}
                          {form.watch("includesFreight") && form.watch("freightValue") && (
                            <div>
                              <p className="text-sm text-blue-600">Frete</p>
                              <p className="text-lg font-semibold text-blue-600">
                                + R$ {(() => {
                                  const freightValue = form.watch("freightValue");
                                  if (!freightValue) return "0,00";
                                  const freightAmount = parseNumberFromCurrency(freightValue);
                                  return freightAmount.toLocaleString("pt-BR", {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  });
                                })()}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <div className="text-right">
                        <p className="text-sm text-gray-600">
                          Valor Total da Proposta
                        </p>
                        <p className="text-2xl font-bold text-green-600 flex items-center gap-2">
                          <Calculator className="h-5 w-5" />
                          R${" "}
                          {calculateTotalValue().toLocaleString("pt-BR", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

            {/* Terms and Conditions */}
            <Card>
              <CardHeader>
                <CardTitle>Condições Comerciais</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="paymentTerms"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Condições de Pagamento</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            placeholder="Ex: 30 dias, boleto bancário..."
                            className="resize-none w-full"
                            readOnly={viewMode === 'view'}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="deliveryTerms"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Condições de Entrega</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            placeholder="Ex: FOB, CIF, entrega no local..."
                            className="resize-none w-full"
                            readOnly={viewMode === 'view'}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="warrantyPeriod"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Período de Garantia</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="Ex: 12 meses, 2 anos..."
                            readOnly={viewMode === 'view'}
                            className="w-full"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="observations"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Observações Gerais</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          placeholder="Observações adicionais sobre a proposta..."
                          className="resize-none w-full"
                          readOnly={viewMode === 'view'}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Existing Attachments Section */}
            {existingAttachments.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Anexos Existentes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {existingAttachments.map((attachment) => (
                      <div key={attachment.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <FileText className="h-5 w-5 text-blue-500" />
                          <div>
                            <p className="font-medium">{attachment.fileName}</p>
                            <p className="text-sm text-gray-500">
                              {(attachment.fileSize / 1024 / 1024).toFixed(2)} MB • 
                              Enviado em {format(new Date(attachment.uploadedAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              // Download attachment
                              const link = document.createElement('a');
                              link.href = `/api/attachments/${attachment.id}/download`;
                              link.download = attachment.fileName;
                              link.click();
                            }}
                          >
                            <Download className="h-4 w-4 mr-1" />
                            Baixar
                          </Button>
                          {viewMode === 'edit' && (
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={async () => {
                                try {
                                  await apiRequest(`/api/attachments/${attachment.id}`, {
            method: "DELETE",
          });
                                  toast({
                                    title: "Sucesso",
                                    description: "Anexo removido com sucesso.",
                                  });
                                  // Refresh attachments
                                  queryClient.invalidateQueries({
                                    queryKey: [`/api/quotations/${quotationId}/supplier-quotations/${supplierId}/attachments`],
                                  });
                                } catch (error) {
                                  toast({
                                    title: "Erro",
                                    description: "Não foi possível remover o anexo.",
                                    variant: "destructive",
                                  });
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* File Upload Section */}
            {viewMode === 'edit' && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Upload className="h-5 w-5" />
                    Anexar Proposta do Fornecedor
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <label className="flex items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-500 transition-colors">
                        <div className="text-center">
                          <Upload className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                          <p className="text-sm text-gray-600">
                            Clique para selecionar arquivos ou arraste aqui
                          </p>
                          <p className="text-xs text-gray-500">
                            PDF, DOC, XLS, imagens até 10MB
                          </p>
                        </div>
                        <input
                          type="file"
                          multiple
                          accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                          onChange={handleFileSelect}
                          className="hidden"
                        />
                      </label>
                    </div>

                    {selectedFiles.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-sm font-medium">
                          Arquivos selecionados:
                        </p>
                        {selectedFiles.map((file, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between p-2 bg-gray-50 rounded"
                          >
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-blue-500" />
                              <span className="text-sm">{file.name}</span>
                              <Badge variant="secondary" className="text-xs">
                                {(file.size / 1024).toFixed(1)} KB
                              </Badge>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeFile(index)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}

                    {isUploading && (
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={onClose} type="button">
                {viewMode === 'view' ? 'Fechar' : 'Cancelar'}
              </Button>
              {viewMode === 'edit' && (
                <Button
                  type="submit"
                  disabled={updateMutation.isPending || isUploading}
                  className="min-w-32"
                >
                  {updateMutation.isPending ? (
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 animate-spin" />
                      Salvando...
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4" />
                      Salvar Cotação
                    </div>
                  )}
                </Button>
              )}
              {viewMode === 'view' && (
                <Button
                  onClick={() => setViewMode('edit')}
                  className="min-w-32"
                >
                  <DollarSign className="h-4 w-4 mr-2" />
                  Editar Cotação
                </Button>
              )}
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
