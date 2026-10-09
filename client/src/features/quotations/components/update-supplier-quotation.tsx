import React, { useState, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { DecimalInput } from "@/shared/ui/decimal-input";
import { Textarea } from "@/shared/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/shared/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/ui/alert-dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/shared/ui/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Badge } from "@/shared/ui/badge";
import { Separator } from "@/shared/ui/separator";
import { Checkbox } from "@/shared/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { updateSupplierQuotationSchema, type UpdateSupplierQuotationData } from "./update-supplier-quotation-schema";
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
  RefreshCw,
  Users,
  ChevronRight,
  ChevronDown,
  SlidersHorizontal,
  Settings2,
} from "lucide-react";
import debug from "@/lib/debug";
import { cn } from "@/lib/utils";
import { SupplierQuotationDataGrid } from "./supplier-quotation-data-grid";
import {
  SUPPORTED_CURRENCIES,
  CURRENCY_SYMBOLS,
  CURRENCY_LABELS,
  formatCurrencyIn,
  formatDualCurrency,
  convertToBRL,
  roundCurrency,
  normalizeCurrencyCode,
  type CurrencyCode,
} from "@/lib/currency";

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
  discountType?: 'none' | 'percentage' | 'fixed';
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
  currencyCode?: string;
  exchangeRate?: string | number;
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
  onOpenComparativeAnalysis?: () => void;
}

export default function UpdateSupplierQuotation({
  isOpen,
  onClose,
  quotationId,
  supplierId,
  supplierName,
  onSuccess,
  onOpenComparativeAnalysis,
}: UpdateSupplierQuotationProps) {
  const [internalOpen, setInternalOpen] = useState<boolean>(isOpen);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [viewMode, setViewMode] = useState<'edit' | 'view'>('edit');
  const [currencyDialogOpen, setCurrencyDialogOpen] = useState(false);
  const [pendingCurrencyCode, setPendingCurrencyCode] = useState<string | null>(null);
  const [isFetchingRate, setIsFetchingRate] = useState(false);
  const [activeSupplierId, setActiveSupplierId] = useState<number>(supplierId);
  const [activeSupplierName, setActiveSupplierName] = useState<string>(supplierName);
  const [confirmCloseOnSaveDialogOpen, setConfirmCloseOnSaveDialogOpen] = useState<boolean>(false);

  const [batchApplyDialogOpen, setBatchApplyDialogOpen] = useState<boolean>(false);
  const [batchApplyBrand, setBatchApplyBrand] = useState<string>('');
  const [batchApplyDeliveryDays, setBatchApplyDeliveryDays] = useState<string>('');
  const [batchApplyScope, setBatchApplyScope] = useState<'available' | 'all' | 'empty'>('available');
  const [applyOverwrite, setApplyOverwrite] = useState<boolean>(false);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);
  const [filterValue, setFilterValue] = useState<string>('');
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({});
  const [exportExcelToken, setExportExcelToken] = useState<number>(0);
  const [pendingFilterType, setPendingFilterType] = useState<'all' | 'pending'>('all');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    setInternalOpen(isOpen);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setActiveSupplierId(supplierId);
      setActiveSupplierName(supplierName);
    }
  }, [isOpen, supplierId, supplierName]);

  // Fetch quotation items
  const { data: quotationItems = [], isLoading: isLoadingItems } = useQuery<
    QuotationItem[]
  >({
    queryKey: [`/api/quotations/${quotationId}/items`],
    enabled: !!quotationId && isOpen,
  });

  // Fetch participants list (all supplier quotations for this RFQ)
  const { data: participantesList = [] } = useQuery<any[]>({
    queryKey: [`/api/quotations/${quotationId}/supplier-quotations`],
    enabled: isOpen && !!quotationId,
  });

  // Fetch existing supplier quotation items
  const { data: existingSupplierQuotation } =
    useQuery<ExistingSupplierQuotation | null>({
      queryKey: [
        `/api/quotations/${quotationId}/supplier-quotations/${activeSupplierId}`,
      ],
      enabled: !!quotationId && !!activeSupplierId && isOpen,
      staleTime: 0,
      refetchOnMount: "always",
      refetchOnReconnect: true,
      refetchOnWindowFocus: false,
    });

  // Fetch existing attachments
  const { data: existingAttachments = [] } = useQuery<SupplierAttachment[]>({
    queryKey: [`/api/quotations/${quotationId}/supplier-quotations/${activeSupplierId}/attachments`],
    enabled: !!quotationId && !!activeSupplierId && isOpen,
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
      currencyCode: (existingSupplierQuotation?.currencyCode as CurrencyCode) ?? 'BRL',
      exchangeRate: existingSupplierQuotation?.exchangeRate ?? 1,
    },
  });

  const watchedCurrencyCode = form.watch("currencyCode") as CurrencyCode;
  const watchedExchangeRate = form.watch("exchangeRate");

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
        discountType: "percentage" as const,
        discountValue: "",
        discountPercentage: "",
        isAvailable: true,
        unavailabilityReason: "",
        availableQuantity: "",
        confirmedUnit: item.unit || "UN",
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
      const isReceived = existingSupplierQuotation.status === 'received';
      const formItems = quotationItems.map((item) => {
        const existingItem = existingSupplierQuotation.items.find(
          (si: SupplierQuotationItem) => si.quotationItemId === item.id,
        );

        // Determine unitPrice: preserve value only if status is "received" (confirmed)
        // OR parsed value is > 0 (user actually set a price).
        // When status is "pending" and stored value is 0 (legacy non-set), clear it
        // so the field shows empty and counts as pending correctly.
        let unitPriceValue: string = "";
        if (existingItem?.unitPrice !== null && existingItem?.unitPrice !== undefined && existingItem?.unitPrice !== "") {
          const raw = existingItem.unitPrice;
          const num = typeof raw === "number" ? raw : parseFloat(String(raw));
          if (!isNaN(num) && (isReceived || num > 0)) {
            unitPriceValue = typeof raw === "number" ? String(raw) : String(raw);
          }
        }

        // Same approach for availableQuantity: keep 0 only if received (confirmed)
        // and also keep non-zero values always. Legacy stored 0 for non-filled becomes ""
        // when status is pending.
        let availableQtyValue: string = "";
        if (existingItem?.availableQuantity !== null && existingItem?.availableQuantity !== undefined && String(existingItem.availableQuantity).trim() !== "") {
          const raw = existingItem.availableQuantity;
          const num = typeof raw === "number" ? raw : parseFloat(String(raw));
          if (!isNaN(num) && (isReceived || num > 0)) {
            availableQtyValue = typeof raw === "number" ? String(raw) : String(raw);
          }
        }

        return {
          quotationItemId: item.id,
          unitPrice: unitPriceValue,
          deliveryDays: existingItem?.deliveryDays?.toString() || "",
          brand: existingItem?.brand || "",
          model: existingItem?.model || "",
          observations: existingItem?.observations || "",
          discountType: ((existingItem?.discountType as any) === 'percentage' || (existingItem?.discountType as any) === 'fixed' || (existingItem?.discountType as any) === 'none')
            ? (existingItem?.discountType as any)
            : ((existingItem?.discountPercentage && parseFloat(existingItem.discountPercentage) !== 0)
                ? 'percentage'
                : (existingItem?.discountValue && parseFloat(existingItem.discountValue) !== 0
                    ? 'fixed'
                    : 'percentage')),
          discountValue: (() => {
            const dt = (existingItem?.discountType as any);
            if (dt === 'fixed') {
              return (existingItem?.discountValue && parseFloat(existingItem.discountValue) !== 0) ? existingItem.discountValue : "";
            }
            if (dt === 'percentage' || !dt) {
              if (existingItem?.discountPercentage && parseFloat(existingItem.discountPercentage) !== 0) return existingItem.discountPercentage;
              if (existingItem?.discountValue && parseFloat(existingItem.discountValue) !== 0) return existingItem.discountValue;
              return "";
            }
            return (existingItem?.discountValue && parseFloat(existingItem.discountValue) !== 0) ? existingItem.discountValue : "";
          })(),
          discountPercentage: (existingItem?.discountPercentage && parseFloat(existingItem.discountPercentage) !== 0) ? existingItem.discountPercentage : "",
          isAvailable: existingItem?.isAvailable !== false,
          unavailabilityReason: existingItem?.unavailabilityReason || "",
          availableQuantity: availableQtyValue,
          confirmedUnit: existingItem?.confirmedUnit || item.unit || "UN",
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
        (existingSupplierQuotation.discountValue && parseFloat(existingSupplierQuotation.discountValue) !== 0) ? existingSupplierQuotation.discountValue : "",
      );
      form.setValue(
        "includesFreight",
        existingSupplierQuotation.includesFreight || false,
      );
      form.setValue(
        "freightValue",
        existingSupplierQuotation.freightValue || "",
      );
      form.setValue(
        "currencyCode",
        normalizeCurrencyCode(existingSupplierQuotation.currencyCode),
      );
      form.setValue(
        "exchangeRate",
        existingSupplierQuotation.exchangeRate ? String(existingSupplierQuotation.exchangeRate) : "1",
      );
    }
  }, [existingSupplierQuotation, quotationItems, form]);

  const hasAnyItemPrice = (): boolean => {
    const items = form.getValues("items") || [];
    return items.some((item) => {
      const v = item?.unitPrice;
      return v !== null && v !== undefined && String(v).trim() !== "";
    });
  };

  const isValueNotEmpty = (v: any): boolean => {
    return v !== null && v !== undefined && String(v).trim() !== "";
  };

  const isUnitPriceValid = (v: any): boolean => {
    if (!isValueNotEmpty(v)) return false;
    const num = typeof v === 'number' ? v : parseFloat(String(v));
    return !isNaN(num) && num >= 0;
  };

  const isItemQuoted = (item: any): boolean => {
    if (!item) return false;
    if (item.isAvailable === false) return false;
    return isUnitPriceValid(item.unitPrice) && isValueNotEmpty(item.availableQuantity);
  };

  const isItemPending = (item: any): boolean => {
    if (!item) return false;
    if (item.isAvailable === false) return false;
    return !isUnitPriceValid(item.unitPrice) || !isValueNotEmpty(item.availableQuantity);
  };

  const fetchExchangeRate = async (code: string) => {
    if (code === "BRL") {
      form.setValue("exchangeRate", "1");
      return;
    }
    setIsFetchingRate(true);
    try {
      const res = await apiRequest(`/api/currency-rates/latest?code=${code}`, { method: "GET" });
      const rateValue = (res as any)?.rateValue;
      if (rateValue && Number(rateValue) > 0) {
        form.setValue("exchangeRate", String(rateValue));
      } else {
        form.setValue("exchangeRate", "");
        toast({
          title: "Aviso",
          description: `Nenhuma cotação cadastrada para ${code}; informe a taxa manualmente`,
          variant: "destructive",
        });
      }
    } catch (e) {
      form.setValue("exchangeRate", "");
      toast({
        title: "Aviso",
        description: `Nenhuma cotação cadastrada para ${code}; informe a taxa manualmente`,
        variant: "destructive",
      });
    } finally {
      setIsFetchingRate(false);
    }
  };

  const handleCurrencyChange = (newCode: string) => {
    if (newCode === watchedCurrencyCode) return;
    if (hasAnyItemPrice()) {
      setPendingCurrencyCode(newCode);
      setCurrencyDialogOpen(true);
    } else {
      applyCurrencyChange(newCode);
    }
  };

  const applyCurrencyChange = (newCode: string) => {
    form.setValue("currencyCode", newCode as CurrencyCode);
    fetchExchangeRate(newCode);
    setPendingCurrencyCode(null);
    setCurrencyDialogOpen(false);
  };

  const updateMutation = useMutation({
    mutationFn: async (data: UpdateSupplierQuotationData) => {
      // Calculate total value from items (only available items)
      const totalValue = data.items.reduce((sum, item) => {
        const v = item.unitPrice;
        const hasPrice = v !== null && v !== undefined && String(v).trim() !== "";
        if (!hasPrice || !item.isAvailable) return sum;

        // Use available quantity if specified, otherwise use requested quantity
        const correspondingQuotationItem = quotationItems.find(
          (qi) => qi.id === item.quotationItemId,
        );
        let quantity = parseFloat(correspondingQuotationItem?.quantity || "0");
        const hasAvailableQuantity = item.availableQuantity !== null && item.availableQuantity !== undefined && item.availableQuantity !== "";
        if (hasAvailableQuantity && !isNaN(parseFloat(item.availableQuantity || ""))) {
          quantity = parseFloat(item.availableQuantity || "");
        }

        const unitPrice = parseNumberFromCurrency(item.unitPrice || "0");

        return sum + quantity * unitPrice;
      }, 0);

      const processedItems = data.items.map((item) => {
        const correspondingQuotationItem = quotationItems.find(
          (qi) => qi.id === item.quotationItemId,
        );
        
        // Use available quantity if specified, otherwise use requested quantity
        let quantity = parseFloat(correspondingQuotationItem?.quantity || "0");
        const hasAvailableQuantity = item.availableQuantity !== null && item.availableQuantity !== undefined && item.availableQuantity !== "";
        if (hasAvailableQuantity && !isNaN(parseFloat(item.availableQuantity || ""))) {
          quantity = parseFloat(item.availableQuantity || "");
        }

        const unitPrice = parseNumberFromCurrency(item.unitPrice || "0");
        const originalTotalPrice = quantity * unitPrice;

        // Calculate discounted total price
        let discountedTotalPrice = originalTotalPrice;
        let discountPercentage: number | null = null;
        let discountValue: number | null = null;
        let discountType = String((item as any).discountType || 'none');

        // Inferência de segurança: se não houver discountType explicito mas houver valores, deriva p/ manter consistência
        if (discountType !== 'percentage' && discountType !== 'fixed') {
          if (item.discountPercentage && parseFloat(item.discountPercentage) > 0) discountType = 'percentage';
          else if (item.discountValue && parseNumberFromCurrency(item.discountValue) > 0) discountType = 'fixed';
        }

        if (discountType === 'percentage') {
          const pct = item.discountValue != null ? parseFloat(item.discountValue) : (item.discountPercentage ? parseFloat(item.discountPercentage) : 0);
          if (!isNaN(pct) && pct > 0) {
            discountPercentage = pct;
            discountedTotalPrice = originalTotalPrice * (1 - pct / 100);
          }
        } else if (discountType === 'fixed') {
          const fxd = item.discountValue != null ? parseNumberFromCurrency(item.discountValue) : 0;
          if (!isNaN(fxd) && fxd > 0) {
            discountValue = fxd;
            discountedTotalPrice = Math.max(0, originalTotalPrice - fxd);
          }
        } else {
          // Fluxo de compatibilidade legado (quando discountType = 'none' p/ inputs antigos)
          if (item.discountPercentage) {
            discountPercentage = parseFloat(item.discountPercentage);
            discountedTotalPrice = originalTotalPrice * (1 - discountPercentage / 100);
          } else if (item.discountValue) {
            discountValue = parseNumberFromCurrency(item.discountValue || "0");
            discountedTotalPrice = Math.max(0, originalTotalPrice - discountValue);
          }
        }

        return {
          quotationItemId: item.quotationItemId,
          unitPrice,
          deliveryDays: item.deliveryDays ? parseInt(item.deliveryDays) : null,
          brand: item.brand || null,
          model: item.model || null,
          observations: item.observations || null,
          discountType: discountType === 'none' ? null : discountType,
          discountPercentage,
          discountValue,
          originalTotalPrice,
          discountedTotalPrice,
          isAvailable: item.isAvailable,
          unavailabilityReason: item.unavailabilityReason || null,
          availableQuantity: item.availableQuantity ? parseFloat(item.availableQuantity || "") : null,
          confirmedUnit: item.confirmedUnit || null,
          quantityAdjustmentReason: item.quantityAdjustmentReason || null,
        };
      });

      // Calculate final values
      const subtotalValue = calculateSubtotal();
      const finalValue = calculateFinalTotal();
      
      // Calculate total value including freight
      const freightAmount = data.freightValue ? parseNumberFromCurrency(data.freightValue) : 0;
      const totalValueWithFreight = data.includesFreight ? finalValue + freightAmount : finalValue;

      return apiRequest(
        `/api/quotations/${quotationId}/update-supplier-quotation`,
        {
          method: "POST",
          body: {
            supplierId: activeSupplierId,
            items: processedItems,
            totalValue: totalValueWithFreight,
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
            currencyCode: normalizeCurrencyCode(data.currencyCode),
            exchangeRate: data.currencyCode === 'BRL' ? 1 : (data.exchangeRate ? Number(data.exchangeRate) : null),
          },
        },
      );
    },
    onMutate: async (data) => {
      await queryClient.cancelQueries({ queryKey: [`/api/quotations/${quotationId}/supplier-quotations`] });
      await queryClient.cancelQueries({ queryKey: [`/api/quotations/${quotationId}/supplier-quotations/${activeSupplierId}`] });

      const previousList = queryClient.getQueryData<any[]>([`/api/quotations/${quotationId}/supplier-quotations`]);
      const previousDetail = queryClient.getQueryData<any>([`/api/quotations/${quotationId}/supplier-quotations/${activeSupplierId}`]);

      const processedItems = (data.items || []).map((item) => {
        const correspondingQuotationItem = quotationItems.find((qi) => qi.id === item.quotationItemId);
        
        // Use available quantity if specified, otherwise use requested quantity
        let quantity = parseFloat(correspondingQuotationItem?.quantity || "0");
        const hasAvailableQuantity = item.availableQuantity !== null && item.availableQuantity !== undefined && item.availableQuantity !== "";
        if (hasAvailableQuantity && !isNaN(parseFloat(item.availableQuantity || ""))) {
          quantity = parseFloat(item.availableQuantity || "");
        }

        const unitPrice = parseNumberFromCurrency(item.unitPrice || "0");
        const originalTotalPrice = quantity * unitPrice;
        let discountedTotalPrice = originalTotalPrice;
        let discountPercentage = null as number | null;
        let discountValue = null as number | null;
        if (item.discountPercentage) {
          discountPercentage = parseFloat(item.discountPercentage);
          discountedTotalPrice = originalTotalPrice * (1 - (discountPercentage || 0) / 100);
        } else if (item.discountValue) {
          discountValue = parseNumberFromCurrency(item.discountValue);
          discountedTotalPrice = Math.max(0, originalTotalPrice - (discountValue || 0));
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
          availableQuantity: item.availableQuantity ? parseFloat(item.availableQuantity || "") : null,
          confirmedUnit: item.confirmedUnit || null,
          quantityAdjustmentReason: item.quantityAdjustmentReason || null,
        };
      });
      const subtotalValue = processedItems.reduce((sum, it) => sum + (it.discountedTotalPrice || 0), 0);
      const discountType = data.discountType;
      const discountValueInput = data.discountValue;
      let finalValueCalc = subtotalValue;
      if (discountType === "percentage" && discountValueInput) {
        const d = parseFloat(discountValueInput) || 0;
        finalValueCalc = subtotalValue * (1 - d / 100);
      } else if (discountType === "fixed" && discountValueInput) {
        const d = parseNumberFromCurrency(discountValueInput);
        finalValueCalc = Math.max(0, subtotalValue - d);
      }
      if (data.includesFreight && data.freightValue) {
        const f = parseNumberFromCurrency(data.freightValue);
        finalValueCalc = finalValueCalc + f;
      }

      if (previousList && Array.isArray(previousList)) {
        const nextList = previousList.map((sq: any) => {
          if ((sq as any).supplierId === activeSupplierId || (sq as any).id === activeSupplierId) {
            return { ...sq, totalValue: String(finalValueCalc) };
          }
          return sq;
        });
        queryClient.setQueryData([`/api/quotations/${quotationId}/supplier-quotations`], nextList);
      }
      if (previousDetail) {
        const nextDetail = {
          ...previousDetail,
          items: processedItems,
          subtotalValue: String(subtotalValue),
          finalValue: String(finalValueCalc),
          totalValue: String(finalValueCalc),
          discountType: data.discountType,
          discountValue: data.discountValue || null,
          includesFreight: data.includesFreight,
          freightValue: data.freightValue || null,
          paymentTerms: data.paymentTerms || null,
          deliveryTerms: data.deliveryTerms || null,
          warrantyPeriod: data.warrantyPeriod || null,
          observations: data.observations || null,
          currencyCode: normalizeCurrencyCode(data.currencyCode),
          exchangeRate: data.currencyCode === 'BRL' ? 1 : (data.exchangeRate ? Number(data.exchangeRate) : null),
        };
        queryClient.setQueryData([`/api/quotations/${quotationId}/supplier-quotations/${activeSupplierId}`], nextDetail);
      }

      return { previousList, previousDetail };
    },
    onSuccess: async (response) => {
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

      if (response) {
        const listKey = [`/api/quotations/${quotationId}/supplier-quotations`];
        const detailKey = [`/api/quotations/${quotationId}/supplier-quotations/${activeSupplierId}`];
        const prevList = queryClient.getQueryData<any[]>(listKey);
        if (prevList && Array.isArray(prevList)) {
          const nextList = prevList.map((sq: any) => {
            if ((sq as any).supplierId === activeSupplierId || (sq as any).id === activeSupplierId) {
              return { ...sq, ...response, totalValue: response?.finalValue || response?.totalValue || sq.totalValue };
            }
            return sq;
          });
          queryClient.setQueryData(listKey, nextList);
        }
        queryClient.setQueryData(detailKey, response);
      }
      await queryClient.refetchQueries({ queryKey: [`/api/quotations/${quotationId}/supplier-quotations`], type: "active" });
      await queryClient.refetchQueries({ queryKey: [`/api/quotations/${quotationId}/supplier-quotations/${activeSupplierId}`], type: "active" });
      await queryClient.refetchQueries({ queryKey: [`/api/quotations/${quotationId}/supplier-comparison`], type: "active" });
      setSavedSuccess(true);
      setConfirmCloseOnSaveDialogOpen(true);
    },
    onError: (error: any, _variables, context: any) => {
      if (context?.previousList) {
        queryClient.setQueryData([`/api/quotations/${quotationId}/supplier-quotations`], context.previousList);
      }
      if (context?.previousDetail) {
        queryClient.setQueryData([`/api/quotations/${quotationId}/supplier-quotations/${activeSupplierId}`], context.previousDetail);
      }
      toast({
        title: "Erro",
        description: error?.message || "Não foi possível atualizar a cotação.",
        variant: "destructive",
      });
    },
    onSettled: async () => {
      await queryClient.refetchQueries({ queryKey: [`/api/quotations/${quotationId}/supplier-quotations`], type: "active" });
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
          supplierId: activeSupplierId,
          quotationId
        });

        const formData = new FormData();
        formData.append("file", file);
        formData.append("attachmentType", "supplier_proposal");
        formData.append("supplierId", activeSupplierId.toString());

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

  const handleSelectSupplier = (id: number, name: string) => {
    if (form.formState.isDirty) {
      toast({
        variant: "destructive",
        description: "Salve as alterações antes de trocar de fornecedor.",
      });
      return;
    }
    setActiveSupplierId(id);
    setActiveSupplierName(name);
    form.reset();
    setSelectedFiles([]);
    setSavedSuccess(false);
    setFilterValue('');
    setColumnVisibility({});
    setPendingFilterType('all');
    queryClient.invalidateQueries({ queryKey: [`/api/quotations/${quotationId}/supplier-quotations/${id}`] });
    queryClient.invalidateQueries({ queryKey: [`/api/quotations/${quotationId}/supplier-quotations/${id}/attachments`] });
  };

  const performCloseWindowFlow = async () => {
    setInternalOpen(false);
    try {
      await queryClient.refetchQueries({ queryKey: [`/api/quotations/${quotationId}/supplier-quotations`], type: "active" });
      await queryClient.refetchQueries({ queryKey: [`/api/quotations/${quotationId}/supplier-quotations/${activeSupplierId}`], type: "active" });
      await queryClient.refetchQueries({ queryKey: [`/api/quotations/${quotationId}/supplier-comparison`], type: "active" });
    } finally {
      form.reset();
      setSelectedFiles([]);
      onClose();
      onSuccess?.();
    }
  };

  const formatCurrencyInput = (value: string) => {
    // Remove all non-numeric characters
    let numericValue = value.replace(/[^\d]/g, "");

    // If empty, return empty
    if (!numericValue) return "";

    // Convert to number and format with decimal places
    const numberValue = parseInt(numericValue) / 100;

  return numberValue.toLocaleString("pt-BR", {
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  });
  };

  const parseNumberFromCurrency = (value: unknown) => {
    if (value === null || value === undefined) return 0;
    if (typeof value === "number") return isNaN(value) ? 0 : value;
    const str = String(value);
    if (!str) return 0;

    // Remove all non-numeric characters except comma and period
    let cleanValue = str.replace(/[^\d.,]/g, "");

    // Handle Brazilian format (e.g., "2.500,00" or "1.000,50")
    if (cleanValue.includes(".") && cleanValue.includes(",")) {
      const parts = cleanValue.split(",");
      if (parts.length === 2) {
        const integerPart = parts[0].replace(/\./g, "");
        cleanValue = integerPart + "." + parts[1];
      }
    } else if (cleanValue.includes(",") && !cleanValue.includes(".")) {
      cleanValue = cleanValue.replace(",", ".");
    }

    const parsed = parseFloat(cleanValue);
    return isNaN(parsed) ? 0 : parsed;
  };

  const calculateItemTotal = (item: any, index: number) => {
    const v = item?.unitPrice;
    const hasPrice = v !== null && v !== undefined && String(v).trim() !== "";
    if (!item || !hasPrice) return 0;

    const correspondingQuotationItem = quotationItems.find(
      (qi) => qi.id === item.quotationItemId,
    );
    
    // Use available quantity if specified, otherwise use requested quantity
    let quantity = parseFloat(correspondingQuotationItem?.quantity || "0");
    const hasAvailableQuantity = item.availableQuantity !== null && item.availableQuantity !== undefined && item.availableQuantity !== "";
    if (hasAvailableQuantity && !isNaN(parseFloat(item.availableQuantity || ""))) {
      quantity = parseFloat(item.availableQuantity || "");
    }
    
    const unitPrice = parseNumberFromCurrency(item.unitPrice);
    const originalTotal = quantity * unitPrice;

    // Apply item-level discount (novo fluxo: discountType + discountValue único, compatível legado)
    let discountedTotal = originalTotal;
    const discountType = String(item.discountType || 'none');
    const hasPctLegacy = item.discountPercentage && parseFloat(item.discountPercentage) > 0;
    const hasFixedLegacy = item.discountValue && parseNumberFromCurrency(item.discountValue) > 0;

    if (discountType === 'percentage') {
      const pct = item.discountValue != null ? parseFloat(item.discountValue) : (hasPctLegacy ? parseFloat(item.discountPercentage) : 0);
      if (!isNaN(pct) && pct > 0) {
        discountedTotal = originalTotal * (1 - pct / 100);
      } else if (hasPctLegacy) {
        const discountPercent = parseFloat(item.discountPercentage) || 0;
        discountedTotal = originalTotal * (1 - discountPercent / 100);
      } else if (hasFixedLegacy) {
        const discountValue = parseNumberFromCurrency(item.discountValue);
        discountedTotal = Math.max(0, originalTotal - discountValue);
      }
    } else if (discountType === 'fixed') {
      const fxd = item.discountValue != null ? parseNumberFromCurrency(item.discountValue) : (hasFixedLegacy ? parseNumberFromCurrency(item.discountValue) : 0);
      if (!isNaN(fxd) && fxd > 0) {
        discountedTotal = Math.max(0, originalTotal - fxd);
      } else if (hasPctLegacy) {
        const discountPercent = parseFloat(item.discountPercentage) || 0;
        discountedTotal = originalTotal * (1 - discountPercent / 100);
      } else if (hasFixedLegacy) {
        const discountValue = parseNumberFromCurrency(item.discountValue);
        discountedTotal = Math.max(0, originalTotal - discountValue);
      }
    } else {
      // discountType 'none' -> fallback p/ legado se houver algo preenchido
      if (hasPctLegacy) {
        const discountPercent = parseFloat(item.discountPercentage) || 0;
        discountedTotal = originalTotal * (1 - discountPercent / 100);
      } else if (hasFixedLegacy) {
        const discountValue = parseNumberFromCurrency(item.discountValue);
        discountedTotal = Math.max(0, originalTotal - discountValue);
      }
    }

    return discountedTotal;
  };

  const calculateSubtotal = () => {
    const watchedItems = form.watch("items") || [];
    return watchedItems.reduce((sum, item, index) => {
      const v = item?.unitPrice;
      const hasPrice = v !== null && v !== undefined && String(v).trim() !== "";
      if (!item || !item.isAvailable || !hasPrice) return sum;
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
      <Dialog open={internalOpen} onOpenChange={(open) => { setInternalOpen(open); if (!open) onClose(); }}>
        <DialogContent hideClose={true} className="w-[96vw] max-w-[1720px] h-[93vh] max-h-[1050px] block p-0 rounded-2xl border border-[#263352] shadow-2xl bg-[#0d131f] overflow-hidden">
          <DialogTitle className="sr-only">Carregando cotação</DialogTitle>
          <div className="flex items-center justify-center p-8 h-full">
            <div className="text-center">
              <Package className="h-8 w-8 animate-spin mx-auto mb-4 text-emerald-400" />
              <p className="text-slate-300">Carregando itens da cotação...</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <>
      <Dialog open={internalOpen} onOpenChange={(open) => { setInternalOpen(open); if (!open) onClose(); }}>
        <DialogContent hideClose={true} className="w-[96vw] max-w-[1720px] h-[93vh] max-h-[1050px] block p-0 rounded-2xl border border-[#263352] shadow-2xl bg-[#0d131f] overflow-hidden flex flex-col text-sm">
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(handleSubmit as any)}
              className="flex-1 flex flex-col min-h-0"
            >
              {/* HEADER */}
              <header className="flex-shrink-0 bg-[#111726] border-b border-[#263352] px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3 sm:gap-4 select-none min-w-0">
                <div className="flex items-center gap-2 sm:gap-3.5 flex-wrap flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="inline-flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                      <DollarSign className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </span>
                    <div className="min-w-0 flex-1 max-w-[calc(100vw-220px)]">
                      <div className="flex items-center gap-2 min-w-0">
                        <DialogTitle className="text-sm sm:text-base sm:text-lg font-bold text-white tracking-tight leading-tight truncate" id="modal-title" title={activeSupplierName}>
                          {viewMode === 'view' ? (
                            <>Visualizar Cotação — Fornecedor ({(participantesList.findIndex((sq: any) => (sq.supplierId ?? sq.id) === activeSupplierId) + 1) || 1} de {participantesList.length || 1}): <span className="text-slate-100">{activeSupplierName}</span></>
                          ) : (
                            <>Atualizar Cotação — Fornecedor ({(participantesList.findIndex((sq: any) => (sq.supplierId ?? sq.id) === activeSupplierId) + 1) || 1} de {participantesList.length || 1}): <span className="text-slate-100">{activeSupplierName}</span></>
                          )}
                        </DialogTitle>
                        {existingSupplierQuotation?.status === 'received' ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                            ● Recebida
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                            ● Pendente
                          </span>
                        )}
                      </div>
                      {viewMode === 'view' && (
                        <Badge variant="outline" className="text-[11px] bg-blue-500/10 text-blue-400 border-blue-500/30 mt-1">
                          <Eye className="w-3 h-3 mr-1" /> Somente Leitura
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                        <span className="font-medium text-slate-300">RFQ: <strong className="text-slate-200">COT-{quotationId}</strong></span>
                        <span className="text-slate-600">•</span>
                        {existingSupplierQuotation?.receivedAt && (
                          <>
                            <span>Recebida: <strong className="text-slate-200 font-normal">{format(new Date(existingSupplierQuotation.receivedAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}</strong></span>
                            <span className="text-slate-600">•</span>
                          </>
                        )}
                        {existingSupplierQuotation?.totalValue && (
                          <span className="font-medium text-emerald-300">
                            Total: <strong className="text-emerald-400">{
                              (() => {
                                const total = parseFloat(existingSupplierQuotation.totalValue || "0");
                                const code = normalizeCurrencyCode(existingSupplierQuotation.currencyCode);
                                const rate = existingSupplierQuotation.exchangeRate ? Number(existingSupplierQuotation.exchangeRate) : (code === 'BRL' ? 1 : 0);
                                const brl = code === 'BRL' ? total : roundCurrency(convertToBRL(total, rate));
                                return formatDualCurrency(total, brl, code);
                              })()
                            }</strong>
                          </span>
                        )}
                      </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                  {/* Compact Currency Bar */}
                  <div className="hidden md:flex items-center bg-[#161c28] rounded-lg border border-[#263352] px-3 py-1.5 gap-3">
                    <FormField
                      control={form.control as any}
                      name="currencyCode"
                      render={({ field }) => (
                        <FormItem className="space-y-0">
                          <div className="flex items-center gap-2">
                            <label className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">Moeda:</label>
                            <Select
                              onValueChange={(val) => handleCurrencyChange(val)}
                              defaultValue={field.value}
                              value={field.value}
                              disabled={viewMode === 'view'}
                            >
                              <FormControl>
                                <SelectTrigger className="h-7 w-auto min-w-[140px] bg-[#0b101a] text-xs font-semibold text-white rounded border border-[#263352] focus:ring-1 focus:ring-blue-500 py-1 pl-2 pr-2">
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent className="bg-[#161c28] border border-[#263352]">
                                {SUPPORTED_CURRENCIES.map((code: CurrencyCode) => (
                                  <SelectItem key={code} value={code}>
                                    <span className="flex items-center gap-2 text-xs">
                                      <span className="font-semibold text-white">{CURRENCY_SYMBOLS[code]}</span>
                                      <span className="text-slate-200">{code}</span>
                                      <span className="text-slate-400">— {CURRENCY_LABELS[code]}</span>
                                    </span>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </FormItem>
                      )}
                    />
                    <div className="h-4 w-px bg-[#263352]"></div>
                    <FormField
                      control={form.control as any}
                      name="exchangeRate"
                      render={({ field }) => (
                        <FormItem className="space-y-0">
                          <div className="flex items-center gap-1.5 text-xs text-slate-300">
                            <span className="text-slate-400">Câmbio:</span>
                            {isFetchingRate && <RefreshCw className="w-3 h-3 animate-spin text-emerald-400" />}
                            <FormControl>
                              <DecimalInput
                                value={field.value}
                                onChange={field.onChange}
                                precision={6}
                                placeholder="1,00000"
                                readOnly={viewMode === 'view' || watchedCurrencyCode === 'BRL'}
                                disabled={watchedCurrencyCode === 'BRL'}
                                className="h-6 w-[100px] font-mono bg-[#0b101a] px-1.5 py-0.5 rounded border border-[#263352] text-emerald-400 text-[11px] focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                                autoComplete="off"
                              />
                            </FormControl>
                          </div>
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* View mode Edit button */}
                  {viewMode === 'view' && (
                    <Button
                      type="button"
                      onClick={() => setViewMode('edit')}
                      size="sm"
                      className="h-8 px-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg shadow-blue-500/20 border border-blue-400/30 rounded-lg transition-all"
                    >
                      <DollarSign className="h-4 w-4 mr-1.5" />
                      Editar Cotação
                    </Button>
                  )}

                  {/* Currency selector fallback for small screens (mobile) */}
                  <div className="flex md:hidden">
                    <FormField
                      control={form.control as any}
                      name="currencyCode"
                      render={({ field }) => (
                        <FormItem className="space-y-0">
                          <Select
                            onValueChange={(val) => handleCurrencyChange(val)}
                            defaultValue={field.value}
                            value={field.value}
                            disabled={viewMode === 'view'}
                          >
                            <FormControl>
                              <SelectTrigger className="h-8 bg-[#161c28] text-xs font-semibold text-white rounded-lg border border-[#263352]">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="bg-[#161c28] border border-[#263352]">
                              {SUPPORTED_CURRENCIES.map((code: CurrencyCode) => (
                                <SelectItem key={code} value={code}>
                                  <span className="flex items-center gap-2 text-xs">
                                    <span className="font-semibold">{CURRENCY_SYMBOLS[code]}</span>
                                    <span>{code}</span>
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Close */}
                  <DialogClose asChild>
                    <button
                      type="button"
                      aria-label="Fechar modal"
                      className="p-2 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition-colors"
                      onClick={onClose}
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </DialogClose>
                </div>
              </header>

              {/* FORNECEDORES PARTICIPANTES BAR */}
              <div className="flex-shrink-0 bg-[#111726]/90 border-b border-[#263352] px-6 py-2 items-center justify-between gap-3 overflow-x-auto whitespace-nowrap select-none flex items-center">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 flex-shrink-0">
                    <Users className="w-3.5 h-3.5 text-blue-400" />
                    Fornecedores Participantes:
                  </span>
                  <div className="flex items-center gap-1.5 flex-nowrap">
                    {participantesList.map((sq: any) => {
                      const sqId = sq.supplierId ?? sq.id;
                      const sqName = sq.supplierName ?? sq.name ?? `Fornecedor ${sqId}`;
                      const status = sq.status ?? '';
                      const isActive = sqId === activeSupplierId;
                      const totalValueRaw = sq.totalValue ?? sq.finalValue ?? 0;
                      const hasTotal = totalValueRaw != null && totalValueRaw !== 0 && totalValueRaw !== "0";
                      return (
                        <button
                          key={sqId}
                          type="button"
                          onClick={() => handleSelectSupplier(sqId, sqName)}
                          className={cn(
                            isActive
                              ? "bg-blue-600/90 text-white shadow-sm border border-blue-500/50 rounded-lg flex-shrink-0 inline-flex items-center gap-2 px-3 py-1 font-semibold"
                              : "bg-[#161c28] hover:bg-[#1c2433] border border-[#263352] text-slate-300 flex-shrink-0 inline-flex items-center gap-2 px-3 py-1 rounded-lg text-xs font-medium transition-colors",
                            "text-xs"
                          )}
                        >
                          <span
                            className={cn(
                              "w-1.5 h-1.5 rounded-full flex-shrink-0",
                              status === "received" ? "bg-emerald-400" : "bg-amber-400"
                            )}
                          />
                          <span className="max-w-[140px] truncate">{sqName}</span>
                          {isActive && hasTotal && (
                            <span className="font-mono text-[10px] bg-blue-950/60 px-1.5 py-0.5 rounded text-emerald-300 flex-shrink-0">
                              {formatCurrencyIn("BRL", Number(totalValueRaw) || 0)}
                            </span>
                          )}
                          {!isActive && status !== 'received' && (
                            <span className="text-[10px] text-slate-400 flex-shrink-0">Sem resposta</span>
                          )}
                          {status === "received" ? (
                            <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1 rounded font-normal flex-shrink-0">Recebida</span>
                          ) : (
                            <span className="text-[10px] bg-amber-500/15 text-amber-300 border border-amber-500/30 px-1 rounded flex-shrink-0">Pendente</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-400 flex-shrink-0">
                  {participantesList.length > 0 && (
                    <>
                      <span className="hidden xl:inline">Respondidas: <strong className="text-emerald-400 font-semibold">{participantesList.filter((sq: any) => (sq.status ?? '') === 'received').length} / {participantesList.length}</strong></span>
                      <span className="text-slate-600 hidden xl:inline">•</span>
                    </>
                  )}
                  <span
                    className="text-[11px] text-blue-400 flex items-center gap-1 font-medium hover:underline cursor-pointer inline-flex items-center"
                    onClick={() => onOpenComparativeAnalysis?.()}
                  >
                    <ChevronRight className="w-3 h-3" />
                    Comparar Propostas
                  </span>
                </div>
              </div>

              {/* CONTENT LAYOUT - Two Columns */}
              <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0 bg-[#0d131f]">
                {/* =========================================== */}
                {/* LEFT COLUMN: Items Table (68% Width)        */}
                {/* =========================================== */}
                <section className="w-full lg:w-[68%] flex flex-col border-b lg:border-b-0 lg:border-r border-[#263352] min-h-0 overflow-hidden">
                  {/* Table Toolbar */}
                  <div className="p-3.5 bg-[#111726]/80 border-b border-[#263352] flex flex-wrap items-center justify-between gap-3 flex-shrink-0">
                    <div className="flex items-center gap-2.5 flex-1 min-w-[280px]">
                      <div className="relative flex-1 max-w-sm">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-500">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </span>
                        <input
                          type="text"
                          value={filterValue}
                          onChange={(e) => setFilterValue(e.target.value)}
                          placeholder="Filtrar itens por código, nome ou part number..."
                          className="w-full pl-9 pr-3 py-1.5 text-xs bg-[#0b101a] border border-[#263352] text-slate-200 placeholder-slate-500 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                      <div className="inline-flex rounded-lg border border-[#263352] p-0.5 bg-[#0b101a]">
                        <button
                          type="button"
                          onClick={() => setPendingFilterType('all')}
                          className={cn(
                            "px-2.5 py-1 text-xs font-medium rounded-md transition-colors",
                            pendingFilterType === 'all' ? "bg-blue-600 text-white shadow-sm" : "text-slate-400 hover:text-slate-200"
                          )}
                        >
                          Todos ({quotationItems.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setPendingFilterType('pending');
                            const pendentes = quotationItems.filter((_q, i) =>
                              isItemPending(form.getValues(`items.${i}`))
                            ).length;
                            toast({ description: `${pendentes} itens pendentes (itens marcados Disponível sem preço ou quantidade informada)` });
                          }}
                          className={cn(
                            "px-2.5 py-1 text-xs font-medium rounded-md transition-colors",
                            pendingFilterType === 'pending' ? "bg-blue-600 text-white shadow-sm" : "text-slate-400 hover:text-slate-200"
                          )}
                        >
                          Pendentes ({
                            quotationItems.filter((_q, i) =>
                              isItemPending(form.watch(`items.${i}`))
                            ).length
                          })
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button type="button"
                        onClick={() => {
                          setBatchApplyBrand('');
                          setBatchApplyDeliveryDays('');
                          setBatchApplyScope('available');
                          setApplyOverwrite(false);
                          setBatchApplyDialogOpen(true);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 bg-[#161c28] hover:bg-[#1c2433] border border-[#263352] rounded-lg transition-colors">
                        <svg className="w-3.5 h-3.5 text-blue-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <span>Aplicar em Lote</span>
                      </button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button type="button" className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 bg-[#161c28] hover:bg-[#1c2433] border border-[#263352] rounded-lg transition-colors">
                            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
                            <span>Colunas</span>
                            <ChevronDown className="w-3 h-3 text-slate-400" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-[#161c28] border border-[#263352] text-slate-200 w-[200px]">
                          {[
                            { id: 'item', label: 'Item e Especificações' },
                            { id: 'brandModel', label: 'Marca / Modelo' },
                            { id: 'pricing', label: 'Preço Unitário' },
                            { id: 'discount', label: 'Desconto' },
                            { id: 'availability', label: 'Qtd. Disp. & Prazo' },
                            { id: 'total', label: 'Total Final' },
                            { id: 'itemObservations', label: 'Observações' },
                          ].map((col) => {
                            const visible = columnVisibility[col.id] !== false;
                            return (
                              <DropdownMenuCheckboxItem
                                key={col.id}
                                checked={visible}
                                onCheckedChange={(checked) => {
                                  setColumnVisibility((prev) => ({ ...prev, [col.id]: !!checked }));
                                }}
                                className="text-xs cursor-pointer"
                              >
                                {col.label}
                              </DropdownMenuCheckboxItem>
                            );
                          })}
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <button
                        type="button"
                        onClick={() => setExportExcelToken((n) => n + 1)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-300 bg-emerald-950/40 hover:bg-emerald-900/50 border border-emerald-700/50 rounded-lg transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <span>Planilha Excel</span>
                      </button>
                    </div>
                  </div>

                  {/* Scrollable SupplierQuotationDataGrid */}
                  <div className="flex-1 overflow-hidden bg-[#0d131f]">
                    <SupplierQuotationDataGrid
                      form={form as any}
                      quotationItems={quotationItems}
                      viewMode={viewMode}
                      currencyCode={watchedCurrencyCode}
                      exchangeRate={watchedExchangeRate}
                      externalFilterValue={filterValue}
                      onExternalFilterChange={setFilterValue}
                      externalColumnVisibility={columnVisibility}
                      onExternalColumnVisibilityChange={(updater) => {
                        setColumnVisibility((prev) => {
                          const next = typeof updater === 'function' ? (updater as any)(prev) : updater;
                          return next;
                        });
                      }}
                      exportTriggerToken={exportExcelToken}
                      externalPendingFilterType={pendingFilterType}
                    />
                  </div>

                  {/* Table Summary Sub-bar */}
                  <div className="px-5 py-2.5 bg-[#111726]/90 border-t border-[#263352] flex items-center justify-between text-xs flex-shrink-0">
                    <div className="flex items-center gap-3 text-slate-400">
                      <span>Itens cotados: <strong className="text-white">
                        {quotationItems.filter((_q: any, i: number) =>
                          isItemQuoted(form.watch(`items.${i}`))
                        ).length} de {quotationItems.length}
                      </strong></span>
                      <span className="text-slate-600">|</span>
                      <span>Prazo médio de entrega: <strong className="text-slate-200">
                        {(
                          (() => {
                            const quotedItems = quotationItems
                              .map((_q: any, i: number) => ({ item: form.watch(`items.${i}`) as any, i }))
                              .filter(({ item }) => isItemQuoted(item));
                            const total = quotedItems.reduce((sum: number, { item }) => {
                              const d = item?.deliveryDays;
                              return sum + (parseInt(String(d || "0")) || 0);
                            }, 0);
                            return total / Math.max(1, quotedItems.filter(({ item }) => {
                              const d = item?.deliveryDays;
                              return d && parseInt(String(d)) > 0;
                            }).length);
                          })()
                        ).toFixed(1)} dias úteis
                      </strong></span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-slate-400 font-medium">Subtotal dos Itens:</span>
                      <span className="font-mono text-base font-bold text-white tracking-tight">
                        {(() => {
                          const subtotal = calculateSubtotal();
                          const brl = roundCurrency(convertToBRL(subtotal, watchedExchangeRate));
                          return formatDualCurrency(subtotal, brl, watchedCurrencyCode);
                        })()}
                      </span>
                    </div>
                  </div>
                </section>

                {/* =========================================== */}
                {/* RIGHT COLUMN: Sidebar (32%)                 */}
                {/* =========================================== */}
                <aside className="w-full lg:w-[32%] flex flex-col bg-[#111726]/50 overflow-y-auto divide-y divide-[#263352]">
                  {/* CARD 1: Resumo Financeiro & Desconto Global */}
                  <div className="p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <h2 className="text-xs uppercase font-bold tracking-wider text-slate-300 flex items-center gap-2">
                        <Calculator className="w-4 h-4 text-emerald-400" />
                        Resumo Financeiro da Proposta
                      </h2>
                      <span className="text-[11px] font-mono text-slate-400 bg-[#161c28] px-2 py-0.5 rounded border border-[#263352]">
                        {watchedCurrencyCode} ({CURRENCY_SYMBOLS[watchedCurrencyCode]})
                      </span>
                    </div>

                    {/* Total Highlight Box (Gradient Esmeralda) */}
                    <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-950/40 via-[#161c28] to-[#0b101a] border border-emerald-500/40 shadow-inner flex items-center justify-between">
                      <div>
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-300/90 block mb-0.5">Valor Total da Proposta</span>
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-emerald-400">
                            {(() => {
                              const total = calculateTotalValue();
                              return formatCurrencyIn(watchedCurrencyCode, total);
                            })()}
                          </span>
                        </div>
                        {watchedCurrencyCode !== 'BRL' && watchedExchangeRate && Number(watchedExchangeRate) > 0 && (
                          <span className="text-[10px] text-slate-400 mt-1 block">
                            ≈ {formatCurrencyIn('BRL', roundCurrency(convertToBRL(calculateTotalValue(), watchedExchangeRate)))}
                          </span>
                        )}
                        <span className="text-[10px] text-slate-400 mt-0.5 block">
                          {form.watch("includesFreight") ? "Frete incluso conforme condições" : "Frete não incluso"}
                        </span>
                      </div>
                      <div className="w-11 h-11 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-lg">
                        <DollarSign className="w-6 h-6" />
                      </div>
                    </div>

                    {/* Detailed Breakdown */}
                    <div className="space-y-3 bg-[#161c28] p-3.5 rounded-lg border border-[#263352] text-xs">
                      <div className="flex items-center justify-between text-slate-300">
                        <span>Soma dos Itens:</span>
                        <span className="font-mono font-medium text-white">
                          {(() => {
                            const s = calculateSubtotal();
                            return formatCurrencyIn(watchedCurrencyCode, s);
                          })()}
                        </span>
                      </div>

                      <div className="pt-2 border-t border-[#263352] space-y-2">
                        <label className="block text-[11px] font-medium text-slate-400 mb-0.5">Desconto Global da Proposta:</label>
                        <div className="grid grid-cols-2 gap-2">
                          <FormField
                            control={form.control as any}
                            name="discountType"
                            render={({ field }) => (
                              <FormItem className="space-y-0">
                                <Select
                                  onValueChange={field.onChange}
                                  defaultValue={field.value}
                                  value={field.value}
                                  disabled={viewMode === 'view'}
                                >
                                  <FormControl>
                                    <SelectTrigger className="h-7 w-full text-xs bg-[#0b101a] text-slate-200 rounded border border-[#263352] py-1 px-2 focus:ring-1 focus:ring-blue-500 focus:border-blue-500">
                                      <SelectValue placeholder="Tipo" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent className="bg-[#161c28] border border-[#263352]">
                                    <SelectItem value="none">Sem desconto</SelectItem>
                                    <SelectItem value="percentage">Porcentagem (%)</SelectItem>
                                    <SelectItem value="fixed">Valor Fixo ({CURRENCY_SYMBOLS[watchedCurrencyCode]})</SelectItem>
                                  </SelectContent>
                                </Select>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control as any}
                            name="discountValue"
                            render={({ field }) => (
                              <FormItem className="space-y-0">
                                <FormControl>
                                  {form.watch("discountType") === "percentage" ? (
                                    <Input
                                      {...field}
                                      placeholder="0,00"
                                      type="number"
                                      min="0"
                                      max="100"
                                      step="0.01"
                                      readOnly={viewMode === 'view' || form.watch("discountType") === "none"}
                                      disabled={form.watch("discountType") === "none"}
                                      className="h-7 w-full text-xs font-mono text-right bg-[#0b101a] text-slate-400 rounded border border-[#263352] py-1 px-2 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-60"
                                      autoComplete="off"
                                      onChange={(e) => field.onChange(e.target.value)}
                                    />
                                  ) : (
                                    <DecimalInput
                                      value={field.value}
                                      onChange={field.onChange}
                                      precision={4}
                                      placeholder="0,0000"
                                      readOnly={viewMode === 'view' || form.watch("discountType") === "none"}
                                      disabled={form.watch("discountType") === "none"}
                                      className="h-7 w-full text-xs font-mono text-right bg-[#0b101a] text-slate-400 rounded border border-[#263352] py-1 px-2 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-60"
                                      autoComplete="off"
                                    />
                                  )}
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </div>
                        {form.watch("discountType") !== "none" && form.watch("discountValue") && (
                          <div className="flex justify-between text-rose-400 font-mono text-[11px] pt-0.5">
                            <span>Desconto aplicado:</span>
                            <span>
                              - {(() => {
                                const subtotal = calculateSubtotal();
                                const discountType = form.watch("discountType");
                                const discountValue = form.watch("discountValue");
                                if (!discountValue) return formatCurrencyIn(watchedCurrencyCode, 0);
                                let discountAmount = 0;
                                if (discountType === "percentage") {
                                  const discountPercent = parseFloat(discountValue) || 0;
                                  discountAmount = subtotal * (discountPercent / 100);
                                } else if (discountType === "fixed") {
                                  discountAmount = parseNumberFromCurrency(discountValue);
                                }
                                return formatCurrencyIn(watchedCurrencyCode, discountAmount);
                              })()}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="pt-2 border-t border-[#263352] space-y-2">
                        <FormField
                          control={form.control as any}
                          name="includesFreight"
                          render={({ field }) => (
                            <FormItem className="space-y-0">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <FormControl>
                                    <Checkbox
                                      checked={field.value}
                                      onCheckedChange={field.onChange}
                                      disabled={viewMode === 'view'}
                                      className="data-[state=checked]:bg-[#f97316] data-[state=checked]:border-[#f97316] w-4 h-4 rounded text-orange-500 bg-[#0b101a] border-[#263352] focus:ring-orange-500 focus:ring-offset-[#0d131f]"
                                    />
                                  </FormControl>
                                  <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5 cursor-pointer">
                                    <Truck className="w-3.5 h-3.5 text-blue-400" />
                                    Frete Incluso na Proposta (CIF)
                                  </label>
                                </div>
                                {field.value && !form.watch("freightValue") && (
                                  <span className="text-emerald-400 font-mono text-[11px] font-semibold">Grátis</span>
                                )}
                              </div>
                            </FormItem>
                          )}
                        />
                        {form.watch("includesFreight") && (
                          <FormField
                            control={form.control as any}
                            name="freightValue"
                            render={({ field }) => (
                              <FormItem className="space-y-0">
                                <label className="block text-[11px] font-medium text-slate-400 mb-1">
                                  Valor do Frete ({CURRENCY_SYMBOLS[watchedCurrencyCode]}):
                                </label>
                                <FormControl>
                                  <DecimalInput
                                    value={field.value}
                                    onChange={field.onChange}
                                    precision={4}
                                    placeholder="0,0000"
                                    readOnly={viewMode === 'view'}
                                    className="h-7 w-full text-xs font-mono text-right bg-[#0b101a] text-slate-300 rounded border border-[#263352] py-1 px-2 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                    autoComplete="off"
                                  />
                                </FormControl>
                                {field.value && (
                                  <div className="flex justify-end text-blue-400 font-mono text-[11px] pt-0.5">
                                    <span>+ {formatCurrencyIn(watchedCurrencyCode, parseNumberFromCurrency(field.value))}</span>
                                  </div>
                                )}
                              </FormItem>
                            )}
                          />
                        )}
                      </div>

                      <div className="pt-2 border-t border-[#263352] flex justify-between">
                        <span className="font-semibold text-slate-200">Subtotal Final:</span>
                        <span className="font-mono font-bold text-white">
                          {(() => {
                            const f = calculateFinalTotal();
                            return formatCurrencyIn(watchedCurrencyCode, f);
                          })()}
                        </span>
                      </div>
                    </div>

                    {watchedCurrencyCode !== 'BRL' && watchedExchangeRate && Number(watchedExchangeRate) > 0 && (
                      <div className="flex items-center justify-between text-[11px] text-slate-400 bg-[#161c28] px-2.5 py-1.5 rounded border border-[#263352]">
                        <span>Conversão 1 {watchedCurrencyCode}:</span>
                        <span className="font-mono text-emerald-400">
                          {formatCurrencyIn('BRL', Number(watchedExchangeRate), 6)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* CARD 2: Condições Comerciais */}
                  <div className="p-5 space-y-3.5">
                    <h2 className="text-xs uppercase font-bold tracking-wider text-slate-300 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-blue-400" />
                      Condições Comerciais
                    </h2>
                    <div className="grid grid-cols-1 gap-2.5">
                      <FormField
                        control={form.control as any}
                        name="paymentTerms"
                        render={({ field }) => (
                          <FormItem className="space-y-1">
                            <FormLabel className="text-[11px] font-medium text-slate-400 mb-1">Condições de Pagamento</FormLabel>
                            <FormControl>
                              <Textarea
                                {...field}
                                placeholder="Ex: 30 dias direto via boleto bancário faturado"
                                className="resize-none w-full min-h-[40px] text-xs bg-[#0b101a] text-slate-200 rounded-lg border border-[#263352] py-1.5 px-3 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                readOnly={viewMode === 'view'}
                                rows={1}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <FormField
                          control={form.control as any}
                          name="deliveryTerms"
                          render={({ field }) => (
                            <FormItem className="space-y-1">
                              <FormLabel className="text-[11px] font-medium text-slate-400 mb-1">Condição de Entrega</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  placeholder="Ex: CIF - Almoxarifado Central"
                                  className="h-8 w-full text-xs bg-[#0b101a] text-slate-200 rounded-lg border border-[#263352] py-1 px-3 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                  readOnly={viewMode === 'view'}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control as any}
                          name="warrantyPeriod"
                          render={({ field }) => (
                            <FormItem className="space-y-1">
                              <FormLabel className="text-[11px] font-medium text-slate-400 mb-1">Período de Garantia</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  placeholder="Ex: 12 meses contra defeitos"
                                  className="h-8 w-full text-xs bg-[#0b101a] text-slate-200 rounded-lg border border-[#263352] py-1 px-3 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                  readOnly={viewMode === 'view'}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <FormField
                        control={form.control as any}
                        name="observations"
                        render={({ field }) => (
                          <FormItem className="space-y-1">
                            <FormLabel className="text-[11px] font-medium text-slate-400 mb-1">Observações Gerais</FormLabel>
                            <FormControl>
                              <Textarea
                                {...field}
                                placeholder="Observações adicionais sobre faturamento, lote mínimo..."
                                className="resize-none w-full text-xs bg-[#0b101a] text-slate-200 rounded-lg border border-[#263352] py-1.5 px-3 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                readOnly={viewMode === 'view'}
                                rows={2}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  {/* CARD 3: Anexos e Proposta do Fornecedor */}
                  <div className="p-5 space-y-3">
                    <h2 className="text-xs uppercase font-bold tracking-wider text-slate-300 flex items-center gap-2">
                      <Upload className="w-4 h-4 text-purple-400" />
                      Anexar Proposta Original
                    </h2>

                    {/* Upload Dropzone */}
                    {viewMode === 'edit' && (
                      <div>
                        <label className="flex flex-col items-center justify-center w-full border-2 border-dashed border-[#263352] hover:border-blue-500/70 bg-[#0b101a]/50 rounded-xl p-3.5 text-center cursor-pointer transition-colors group">
                          <div className="flex flex-col items-center justify-center gap-1.5">
                            <div className="w-8 h-8 rounded-full bg-[#161c28] flex items-center justify-center text-slate-400 group-hover:text-blue-400 group-hover:bg-blue-500/10 transition-colors">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <path d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            </div>
                            <p className="text-xs font-medium text-slate-300">
                              <span className="text-blue-400 group-hover:underline">Clique para enviar</span> ou arraste o arquivo aqui
                            </p>
                            <p className="text-[10px] text-slate-500">PDF, DOC, XLS ou Imagens até 10MB</p>
                          </div>
                          <input
                            type="file"
                            multiple
                            accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                            onChange={handleFileSelect}
                            className="hidden"
                          />
                        </label>
                        {isUploading && (
                          <div className="w-full bg-[#161c28] rounded-full h-1.5 mt-2">
                            <div
                              className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                              style={{ width: `${uploadProgress}%` }}
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {/* Existing Attachments */}
                    {existingAttachments.length > 0 && (
                      <div className="space-y-2">
                        {existingAttachments.map((attachment) => (
                          <div key={attachment.id} className="flex items-center justify-between p-2.5 rounded-lg bg-[#161c28] border border-[#263352]">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className="w-7 h-7 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center flex-shrink-0">
                                <FileText className="w-4 h-4" />
                              </span>
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-slate-200 truncate">{attachment.fileName}</p>
                                <p className="text-[10px] text-slate-500">
                                  {(attachment.fileSize / 1024 / 1024).toFixed(2)} MB • {format(new Date(attachment.uploadedAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  const link = document.createElement('a');
                                  link.href = `/api/attachments/${attachment.id}/download`;
                                  link.download = attachment.fileName;
                                  link.click();
                                }}
                                className="p-1 text-slate-400 hover:text-white rounded hover:bg-[#0b101a] transition-colors"
                                title="Baixar documento"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </button>
                              {viewMode === 'edit' && (
                                <button
                                  type="button"
                                  onClick={async () => {
                                    try {
                                      await apiRequest(`/api/attachments/${attachment.id}`, { method: "DELETE" });
                                      toast({ title: "Sucesso", description: "Anexo removido com sucesso." });
                                      queryClient.invalidateQueries({
                                        queryKey: [`/api/quotations/${quotationId}/supplier-quotations/${activeSupplierId}/attachments`],
                                      });
                                    } catch (error) {
                                      toast({ title: "Erro", description: "Não foi possível remover o anexo.", variant: "destructive" });
                                    }
                                  }}
                                  className="p-1 text-slate-400 hover:text-rose-400 rounded hover:bg-rose-500/10 transition-colors"
                                  title="Remover anexo"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Selected Files (upload pending) */}
                    {selectedFiles.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Arquivos Selecionados:</p>
                        {selectedFiles.map((file, index) => (
                          <div key={index} className="flex items-center justify-between p-2.5 rounded-lg bg-[#161c28] border border-[#263352] border-dashed">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className="w-7 h-7 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center flex-shrink-0">
                                <Clock className="w-4 h-4" />
                              </span>
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-slate-200 truncate">{file.name}</p>
                                <p className="text-[10px] text-slate-500">
                                  {(file.size / 1024).toFixed(1)} KB • Pendente
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              {viewMode === 'edit' && (
                                <button
                                  type="button"
                                  onClick={() => removeFile(index)}
                                  className="p-1 text-slate-400 hover:text-rose-400 rounded hover:bg-rose-500/10 transition-colors"
                                  title="Remover da fila"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </aside>
              </div>

              {/* FOOTER */}
              <footer className="flex-shrink-0 bg-[#111726] border-t border-[#263352] px-6 py-3.5 flex flex-wrap items-center justify-between gap-4 select-none">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span className="text-xs text-slate-300 font-medium">
                    Todos os <strong className="text-white">{quotationItems.length} itens</strong> foram carregados.
                    {isUploading && <span className="ml-2 text-blue-400">• Enviando arquivos: {uploadProgress.toFixed(0)}%</span>}
                  </span>
                </div>
                <div className="flex items-center gap-2.5">
                  {viewMode === 'edit' && (
                    <button
                      type="button"
                      className="px-4 py-2 text-xs font-semibold text-slate-300 bg-[#161c28] hover:bg-[#1c2433] hover:text-white border border-[#263352] rounded-lg transition-colors focus:ring-2 focus:ring-slate-400"
                      onClick={onClose}
                    >
                      <History className="inline w-3.5 h-3.5 mr-1.5" />
                      Salvar como Rascunho
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-slate-100 bg-transparent hover:bg-[#161c28] border border-transparent hover:border-[#263352] rounded-lg transition-colors"
                  >
                    {viewMode === 'view' ? 'Fechar' : 'Cancelar'}
                  </button>
                  {viewMode === 'edit' && (
                    <button
                      type="submit"
                      disabled={updateMutation.isPending || isUploading}
                      className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-gradient-to-r from-orange-500 to-[#f97316] hover:from-orange-600 hover:to-[#ea580c] active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed rounded-lg shadow-lg shadow-orange-500/20 border border-orange-400/30 transition-all focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 focus:ring-offset-[#0d131f]"
                    >
                      {updateMutation.isPending || isUploading ? (
                        <>
                          <Package className="w-4 h-4 animate-spin" />
                          <span>Salvando...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-4 h-4 text-white" />
                          <span>Salvar e Atualizar Cotação</span>
                        </>
                      )}
                    </button>
                  )}
                  {viewMode === 'view' && (
                    <Button
                      type="button"
                      onClick={() => setViewMode('edit')}
                      className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-gradient-to-r from-blue-500 to-blue-700 hover:from-blue-600 hover:to-blue-800 rounded-lg shadow-lg shadow-blue-500/20 border border-blue-400/30 transition-all"
                    >
                      <DollarSign className="w-4 h-4" />
                      <span>Editar Cotação</span>
                    </Button>
                  )}
                </div>
              </footer>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Currency Change AlertDialog */}
      <AlertDialog open={currencyDialogOpen} onOpenChange={setCurrencyDialogOpen}>
        <AlertDialogContent className="bg-[#161c28] border border-[#263352] text-slate-200 rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Alterar moeda da cotação?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              Alterar a moeda manterá os valores numéricos digitados. Deseja continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setPendingCurrencyCode(null);
                setCurrencyDialogOpen(false);
              }}
              className="bg-transparent hover:bg-[#0b101a] text-slate-300 border border-[#263352]"
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingCurrencyCode) {
                  applyCurrencyChange(pendingCurrencyCode);
                }
              }}
              className="bg-gradient-to-r from-orange-500 to-[#f97316] hover:from-orange-600 hover:to-[#ea580c] text-white border border-orange-400/30"
            >
              Continuar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm Close On Save AlertDialog */}
      <AlertDialog open={confirmCloseOnSaveDialogOpen} onOpenChange={setConfirmCloseOnSaveDialogOpen}>
        <AlertDialogContent className="bg-[#161c28] border border-[#263352] text-slate-200 rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Cotação salva com sucesso!</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              Deseja fechar a janela atual ou permanecer na tela para realizar mais ajustes?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => setConfirmCloseOnSaveDialogOpen(false)}
              className="bg-transparent hover:bg-[#0b101a] text-slate-300 border border-[#263352]"
            >
              Não, permanecer
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                setConfirmCloseOnSaveDialogOpen(false);
                await performCloseWindowFlow();
              }}
              className="bg-gradient-to-r from-orange-500 to-[#f97316] hover:from-orange-600 hover:to-[#ea580c] text-white border border-orange-400/30"
            >
              Sim, fechar janela
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Batch Apply Dialog */}
      <Dialog open={batchApplyDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setBatchApplyDialogOpen(false);
        } else {
          setBatchApplyDialogOpen(true);
        }
      }}>
        <DialogContent className="sm:max-w-[560px] bg-[#111726] border border-[#263352] rounded-2xl text-slate-200">
          <DialogHeader>
            <DialogTitle className="text-white text-lg flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Aplicar em Lote — Marca e Prazo
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-400 mb-4">
            Preencha os campos abaixo para aplicar os valores em todos os itens selecionados.
            Campos deixados vazios não serão alterados.
          </p>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <FormLabel className="text-xs text-slate-400 font-semibold uppercase tracking-wide">Marca</FormLabel>
              <Input
                value={batchApplyBrand}
                onChange={(e) => setBatchApplyBrand(e.target.value)}
                placeholder="Ex: STRUTURAL, 3M, Luxo..."
                className="bg-[#0b101a] border-[#263352] text-white placeholder:text-slate-500 focus-visible:ring-orange-400/30 focus-visible:border-orange-500/40"
              />
            </div>
            <div className="space-y-1.5">
              <FormLabel className="text-xs text-slate-400 font-semibold uppercase tracking-wide">Prazo de Entrega (dias úteis)</FormLabel>
              <Input
                type="number"
                min={0}
                value={batchApplyDeliveryDays}
                onChange={(e) => setBatchApplyDeliveryDays(e.target.value)}
                placeholder="Ex: 5, 10, 15"
                className="bg-[#0b101a] border-[#263352] text-white placeholder:text-slate-500 focus-visible:ring-orange-400/30 focus-visible:border-orange-500/40"
              />
            </div>
            <div className="space-y-2">
              <FormLabel className="text-xs text-slate-400 font-semibold uppercase tracking-wide">Escopo de aplicação</FormLabel>
              <div className="grid grid-cols-1 gap-2">
                {([
                  { value: 'available', title: 'Apenas itens marcados "Disponível"', desc: 'Padrão. Aplica somente onde Disponível=true.' },
                  { value: 'empty', title: 'Apenas campos vazios', desc: 'Sobrescreve apenas Marca/Prazo que ainda não foram preenchidos.' },
                  { value: 'all', title: 'Todos os itens da cotação atual', desc: 'Aplica em tudo (indisponível, disponível, já preenchido).' },
                ] as const).map((opt) => (
                  <label key={opt.value}
                    className={cn(
                      "flex items-start gap-3 rounded-lg border px-3.5 py-2.5 cursor-pointer transition-colors",
                      batchApplyScope === opt.value
                        ? "bg-blue-500/10 border-blue-500/50 text-blue-200"
                        : "bg-[#0b101a]/50 border-[#263352] text-slate-300 hover:border-slate-600"
                    )}>
                    <input
                      type="radio"
                      name="batch-scope"
                      className="mt-1 accent-blue-500"
                      checked={batchApplyScope === opt.value}
                      onChange={() => setBatchApplyScope(opt.value)}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">{opt.title}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{opt.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
            <label className="inline-flex items-center gap-2 text-xs text-slate-400 select-none">
              <Checkbox
                checked={applyOverwrite}
                onCheckedChange={(v) => setApplyOverwrite(!!v)}
                className="data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500"
              />
              Sobrescrever campos já preenchidos (ignorar valores existentes)
            </label>
          </div>
          <div className="flex flex-col sm:flex-row justify-end gap-2 mt-5">
            <DialogClose asChild>
              <Button type="button" variant="outline" className="border-[#263352] text-slate-300 hover:bg-[#0b101a]">
                Cancelar
              </Button>
            </DialogClose>
            <Button
              type="button"
              disabled={!batchApplyBrand.trim() && !batchApplyDeliveryDays.trim()}
              onClick={() => {
                let altered = 0;
                quotationItems.forEach((_qi, i) => {
                  const current = form.getValues(`items.${i}`) as any;
                  const scopeMatches =
                    batchApplyScope === 'all' ? true :
                    batchApplyScope === 'available' ? (current?.isAvailable !== false) : true;
                  if (!scopeMatches) return;

                  if (batchApplyBrand.trim()) {
                    const shouldApplyBrand =
                      applyOverwrite ||
                      (batchApplyScope === 'empty' ? !String(current?.brand ?? '').trim() : true);
                    if (shouldApplyBrand) {
                      form.setValue(`items.${i}.brand`, batchApplyBrand.trim(), { shouldDirty: true, shouldValidate: true, shouldTouch: true });
                      altered++;
                    }
                  }
                  if (batchApplyDeliveryDays.trim()) {
                    const existingDays = String(current?.deliveryDays ?? '').trim();
                    const shouldApplyDays =
                      applyOverwrite ||
                      (batchApplyScope === 'empty' ? !existingDays : true);
                    if (shouldApplyDays) {
                      form.setValue(`items.${i}.deliveryDays`, batchApplyDeliveryDays.trim(), { shouldDirty: true, shouldValidate: true, shouldTouch: true });
                      altered++;
                    }
                  }
                });
                setBatchApplyDialogOpen(false);
                toast({
                  description: `Aplicado em lote com sucesso — ${altered} campo(s) alterado(s) em ${quotationItems.length} item(ns).`,
                  variant: altered === 0 ? "destructive" : "default",
                });
              }}
              className="bg-gradient-to-r from-orange-500 to-[#f97316] hover:from-orange-600 hover:to-[#ea580c] text-white border border-orange-400/30 shadow-md"
            >
              Aplicar em Lote
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
