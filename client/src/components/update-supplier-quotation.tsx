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
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  DollarSign,
  FileText,
  CheckCircle,
  X,
  Upload,
  Package,
  Calculator,
} from "lucide-react";

const updateSupplierQuotationSchema = z.object({
  items: z.array(
    z.object({
      quotationItemId: z.number(),
      unitPrice: z.string().min(1, "Preço unitário é obrigatório"),
      deliveryDays: z.string().optional(),
      brand: z.string().optional(),
      model: z.string().optional(),
      observations: z.string().optional(),
    }),
  ),
  paymentTerms: z.string().optional(),
  deliveryTerms: z.string().optional(),
  warrantyPeriod: z.string().optional(),
  observations: z.string().optional(),
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
}

interface ExistingSupplierQuotation {
  id: number;
  items: SupplierQuotationItem[];
  paymentTerms?: string;
  deliveryTerms?: string;
  warrantyPeriod?: string;
  observations?: string;
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

  const form = useForm<UpdateSupplierQuotationData>({
    resolver: zodResolver(updateSupplierQuotationSchema),
    defaultValues: {
      items: [],
      paymentTerms: "",
      deliveryTerms: "",
      warrantyPeriod: "",
      observations: "",
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
      }));

      form.setValue("items", formItems);
    }
  }, [quotationItems, form]);

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
    }
  }, [existingSupplierQuotation, quotationItems, form]);

  const updateMutation = useMutation({
    mutationFn: async (data: UpdateSupplierQuotationData) => {
      // Calculate total value from items
      const totalValue = data.items.reduce((sum, item) => {
        if (!item.unitPrice) return sum;

        const correspondingQuotationItem = quotationItems.find(
          (qi) => qi.id === item.quotationItemId,
        );
        const quantity = parseFloat(
          correspondingQuotationItem?.quantity || "0",
        );
        const unitPrice = parseNumberFromCurrency(item.unitPrice);

        return sum + quantity * unitPrice;
      }, 0);

      const processedItems = data.items.map((item) => ({
        quotationItemId: item.quotationItemId,
        unitPrice: parseNumberFromCurrency(item.unitPrice),
        deliveryDays: item.deliveryDays ? parseInt(item.deliveryDays) : null,
        brand: item.brand || null,
        model: item.model || null,
        observations: item.observations || null,
      }));

      return apiRequest(
        "POST",
        `/api/quotations/${quotationId}/update-supplier-quotation`,
        {
          supplierId,
          items: processedItems,
          totalValue,
          paymentTerms: data.paymentTerms || null,
          deliveryTerms: data.deliveryTerms || null,
          warrantyPeriod: data.warrantyPeriod || null,
          observations: data.observations || null,
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
          console.error("Upload failed:", error);
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
        const formData = new FormData();
        formData.append("file", file);
        formData.append("attachmentType", "supplier_proposal");
        formData.append("supplierId", supplierId.toString());

        await apiRequest(
          "POST",
          `/api/quotations/${quotationId}/upload-supplier-file`,
          formData,
        );

        setUploadProgress(((i + 1) / selectedFiles.length) * 100);
      }
    } catch (error) {
      toast({
        title: "Erro no upload",
        description: "Alguns arquivos não puderam ser enviados.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
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

  const calculateTotalValue = () => {
    const watchedItems = form.watch("items");
    return watchedItems.reduce((sum, item) => {
      if (!item.unitPrice) return sum;

      const correspondingQuotationItem = quotationItems.find(
        (qi) => qi.id === item.quotationItemId,
      );
      const quantity = parseFloat(correspondingQuotationItem?.quantity || "0");
      const unitPrice = parseNumberFromCurrency(item.unitPrice);

      return sum + quantity * unitPrice;
    }, 0);
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
            <DollarSign className="h-5 w-5" />
            Atualizar Cotação - {supplierName}
          </DialogTitle>
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
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Qtd</TableHead>
                        <TableHead>Unidade</TableHead>
                        <TableHead>Preço Unitário</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead>Prazo (dias)</TableHead>
                        <TableHead>Marca</TableHead>
                        <TableHead>Modelo</TableHead>
                        <TableHead>Observações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {quotationItems.map((item, index) => (
                        <React.Fragment key={item.id}>
                          <TableRow>
                            <TableCell>
                              <div className="max-w-48">
                                <p className="text-sm font-medium">
                                  {item.description}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary">
                                {parseFloat(item.quantity).toLocaleString(
                                  "pt-BR",
                                  { maximumFractionDigits: 0 },
                                )}
                              </Badge>
                            </TableCell>
                            <TableCell>{item.unit}</TableCell>
                            <TableCell>
                              <FormField
                                control={form.control}
                                name={`items.${index}.unitPrice`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormControl>
                                      <Input
                                        {...field}
                                        placeholder="1.000,00"
                                        className="w-24"
                                        onChange={(e) => {
                                          // Allow natural number input - user types 1000 and it becomes 1000.00
                                          let inputValue = e.target.value;

                                          // If user is typing a number without formatting, keep it as is for now
                                          if (/^\d+$/.test(inputValue)) {
                                            field.onChange(inputValue);
                                          } else {
                                            // If already formatted or contains special chars, clean it
                                            const cleanValue =
                                              inputValue.replace(
                                                /[^\d.,]/g,
                                                "",
                                              );
                                            field.onChange(cleanValue);
                                          }
                                        }}
                                        onBlur={(e) => {
                                          // Format on blur for better display
                                          const value = e.target.value;
                                          if (value) {
                                            let number;
                                            // If it's a simple number (like 1000), treat it as currency value
                                            if (/^\d+$/.test(value)) {
                                              number = parseFloat(value);
                                            } else if (
                                              /^\d+[.,]\d+$/.test(value)
                                            ) {
                                              // If it already has decimal places
                                              number = parseFloat(
                                                value.replace(",", "."),
                                              );
                                            } else {
                                              // Try to parse any formatted value
                                              const cleanValue = value.replace(
                                                /[^\d.,]/g,
                                                "",
                                              );
                                              number = parseFloat(
                                                cleanValue.replace(",", "."),
                                              );
                                            }

                                            if (!isNaN(number)) {
                                              const formatted =
                                                number.toLocaleString("pt-BR", {
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
                            </TableCell>
                            <TableCell>
                              <div className="font-medium text-green-600">
                                R${" "}
                                {(() => {
                                  const unitPrice = form.watch(
                                    `items.${index}.unitPrice`,
                                  );
                                  if (!unitPrice) return "0,00";

                                  const quantity = parseFloat(item.quantity);
                                  const price =
                                    parseNumberFromCurrency(unitPrice);
                                  const total = quantity * price;

                                  return isNaN(total)
                                    ? "0,00"
                                    : total.toLocaleString("pt-BR", {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2,
                                      });
                                })()}
                              </div>
                            </TableCell>
                            <TableCell>
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
                                        className="w-20"
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </TableCell>
                            <TableCell>
                              <FormField
                                control={form.control}
                                name={`items.${index}.brand`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormControl>
                                      <Input
                                        {...field}
                                        placeholder="Marca"
                                        className="w-24"
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </TableCell>
                            <TableCell>
                              <FormField
                                control={form.control}
                                name={`items.${index}.model`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormControl>
                                      <Input
                                        {...field}
                                        placeholder="Modelo"
                                        className="w-24"
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </TableCell>
                            <TableCell>
                              <FormField
                                control={form.control}
                                name={`items.${index}.observations`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormControl>
                                      <Input
                                        {...field}
                                        placeholder="Observações"
                                        className="w-32"
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </TableCell>
                          </TableRow>
                          {item.specifications && (
                            <TableRow key={`${item.id}-spec`}>
                              <TableCell
                                colSpan={9}
                                className="bg-gray-50 border-t-0 pt-0"
                              >
                                <div className="text-xs text-gray-600 italic">
                                  <span className="font-medium">
                                    Especificações:
                                  </span>{" "}
                                  {item.specifications}
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </React.Fragment>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <Separator className="my-4" />

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
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                            className="resize-none"
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
                            className="resize-none"
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
                          className="resize-none"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* File Upload Section */}
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

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={onClose} type="button">
                Cancelar
              </Button>
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
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
