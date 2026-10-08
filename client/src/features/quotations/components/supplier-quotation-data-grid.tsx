import React, { useMemo, useState } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  ColumnDef,
  SortingState,
  VisibilityState,
  ColumnFiltersState,
} from "@tanstack/react-table";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/table";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";
import { DecimalInput } from "@/shared/ui/decimal-input";
import { Badge } from "@/shared/ui/badge";
import { Checkbox } from "@/shared/ui/checkbox";
import { Button } from "@/shared/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/shared/ui/form";
import { UseFormReturn, useFieldArray } from "react-hook-form";
import { UpdateSupplierQuotationData } from "./update-supplier-quotation-schema";
import { ArrowUpDown, ChevronDown, Download, SlidersHorizontal, AlertCircle } from "lucide-react";
import * as XLSX from 'xlsx';
import { parseBrazilianNumber, formatBrazilianNumber } from "@/lib/number-parser";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/shared/ui/tooltip";
import { UnitSelect } from "@/shared/components/unit-select";
import {
  CURRENCY_SYMBOLS,
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
}

interface SupplierQuotationDataGridProps {
  form: UseFormReturn<UpdateSupplierQuotationData>;
  quotationItems: QuotationItem[];
  viewMode: 'edit' | 'view';
  currencyCode?: CurrencyCode;
  exchangeRate?: string | number;
  externalFilterValue?: string;
  onExternalFilterChange?: (value: string) => void;
  externalColumnVisibility?: VisibilityState;
  onExternalColumnVisibilityChange?: (state: VisibilityState | ((prev: VisibilityState) => VisibilityState)) => void;
  onRequestExportExcel?: () => void;
  exportTriggerToken?: number;
  externalPendingFilterType?: 'all' | 'pending';
}

export function SupplierQuotationDataGrid({
  form,
  quotationItems,
  viewMode,
  currencyCode = 'BRL',
  exchangeRate = 1,
  externalFilterValue,
  onExternalFilterChange,
  externalColumnVisibility,
  onExternalColumnVisibilityChange,
  onRequestExportExcel,
  exportTriggerToken = 0,
  externalPendingFilterType = 'all',
}: SupplierQuotationDataGridProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [internalColumnVisibility, setInternalColumnVisibility] = useState<VisibilityState>({});

  const resolvedCode = normalizeCurrencyCode(currencyCode);
  const resolvedRate = Number(exchangeRate) || 0;

  const columnVisibility = externalColumnVisibility ?? internalColumnVisibility;
  const setColumnVisibility = (updater: VisibilityState | ((prev: VisibilityState) => VisibilityState)) => {
    if (onExternalColumnVisibilityChange) {
      onExternalColumnVisibilityChange(updater);
    } else {
      setInternalColumnVisibility(updater);
    }
  };

  const filterValue = externalFilterValue ?? "";
  const setFilterValue = (v: string) => {
    if (onExternalFilterChange) onExternalFilterChange(v);
  };

  React.useEffect(() => {
    if (filterValue) {
      setColumnFilters((prev) => {
        const rest = prev.filter(f => f.id !== 'item');
        return [...rest, { id: 'item', value: filterValue }];
      });
    } else {
      setColumnFilters((prev) => prev.filter(f => f.id !== 'item'));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterValue]);

  React.useEffect(() => {
    if (exportTriggerToken > 0 && onRequestExportExcel == null) {
      exportToExcel();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exportTriggerToken]);

  const { fields } = useFieldArray({
    control: form.control,
    name: "items",
    keyName: "key", // use 'key' to avoid conflict with 'id' if present in data
  });
  const watchedItems = form.watch("items") || [];

  const isValueNotEmptyFn = (v: any): boolean =>
    v !== null && v !== undefined && String(v).trim() !== "";

  const isUnitPriceValidFn = (v: any): boolean => {
    if (!isValueNotEmptyFn(v)) return false;
    const num = typeof v === 'number' ? v : parseFloat(String(v));
    return !isNaN(num) && num >= 0;
  };

  const isItemPendingFn = (item: any): boolean => {
    if (!item) return false;
    if (item.isAvailable === false) return false;
    return !isUnitPriceValidFn(item.unitPrice) || !isValueNotEmptyFn(item.availableQuantity);
  };

  const tableData = useMemo(() => {
    if (externalPendingFilterType === 'pending') {
      return watchedItems.filter((it: any) => isItemPendingFn(it));
    }
    return watchedItems;
  }, [watchedItems, externalPendingFilterType]);

  // Calculate totals helper
  const calculateItemTotal = (item: any, qItem: QuotationItem | undefined) => {
    if (!item || !item.unitPrice) return 0;
    
    // Find corresponding quotation item to get requested quantity if availableQuantity is not set
    let quantity = parseFloat(qItem?.quantity || "0");
    
    // If availableQuantity is not informed (null, undefined or empty string), use requested quantity
    const hasAvailableQuantity = item.availableQuantity !== null && item.availableQuantity !== undefined && item.availableQuantity !== "";
    if (hasAvailableQuantity && !isNaN(parseFloat(item.availableQuantity))) {
        quantity = parseFloat(item.availableQuantity);
    }

    // item.unitPrice comes from DecimalInput which returns standard string (e.g. "1000.50")
    // So we use parseFloat instead of parseBrazilianNumber
    const unitPrice = parseFloat(item.unitPrice);
    if (isNaN(unitPrice)) return 0;

    const originalTotal = quantity * unitPrice;
    let discountedTotal = originalTotal;

    if (item.discountPercentage) {
      const discountPercent = parseFloat(item.discountPercentage) || 0;
      discountedTotal = originalTotal * (1 - discountPercent / 100);
    } else if (item.discountValue) {
      // discountValue also comes from DecimalInput (standard string)
      const discountValue = parseFloat(item.discountValue);
      if (!isNaN(discountValue)) {
        discountedTotal = Math.max(0, originalTotal - discountValue);
      }
    }

    return discountedTotal;
  };

  const columns = useMemo<ColumnDef<any>[]>(
    () => [
      {
        id: "item",
        header: ({ column }) => {
            return (
              <div
                className="flex items-center gap-1.5 cursor-pointer hover:text-white"
                onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
              >
                <span>Item &amp; Especificações</span>
                <ArrowUpDown className="w-3 h-3 text-slate-500" />
              </div>
            )
        },
        accessorFn: (row) => {
            const qItem = quotationItems.find(qi => qi.id === row.quotationItemId);
            return qItem ? `${qItem.itemCode || ''} ${qItem.description}` : '';
        },
        cell: ({ row }) => {
          const item = row.original;
          const qItem = quotationItems.find((qi) => qi.id === item.quotationItemId);
          if (!qItem) return null;

          return (
            <div className="flex flex-col gap-1.5 w-full">
              <div className="flex items-center gap-1.5 flex-wrap">
                {qItem.itemCode && (
                  <span className="font-mono text-[11px] text-blue-400 font-semibold bg-blue-950/40 px-1.5 py-0.5 rounded border border-blue-800/40">
                    [{qItem.itemCode}]
                  </span>
                )}
                <span className="font-bold text-slate-100 text-xs tracking-tight group-hover:text-blue-300 transition-colors">
                  {qItem.description}
                </span>
              </div>
              {qItem.specifications && (
                <div className="text-[11px] italic text-slate-400">
                  {qItem.specifications}
                </div>
              )}
              <div className="flex items-center gap-2 text-[11px] text-slate-400 flex-wrap">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#161c28] border border-[#263352] text-slate-300 font-medium">
                  Solicitado: <strong className="text-white">{formatBrazilianNumber(qItem.quantity, 0, 2)} {qItem.unit}</strong>
                </span>
                {item.brand || item.model ? (
                  <span>
                    {item.brand && <>Marca: <strong className="text-slate-300">{item.brand}</strong></>}
                    {item.brand && item.model && <span className="text-slate-600 mx-1">•</span>}
                    {item.model && <>Ref.: <strong className="text-slate-300 font-mono">{item.model}</strong></>}
                  </span>
                ) : (
                  <>
                    {qItem.unit && qItem.unit !== 'UN' && (
                      <span>Part: <strong className="text-slate-300 font-mono">{qItem.unit}</strong></span>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        },
        enableHiding: false,
      },
      {
        id: "brandModel",
        header: () => (
          <div className="uppercase text-[11px] text-slate-400 tracking-wider font-semibold">
            Marca / Modelo
          </div>
        ),
        cell: ({ row }) => {
          const index = Number(row.id);
          return (
            <div className="flex flex-col gap-1.5 w-full">
              <FormField
                control={form.control}
                name={`items.${index}.brand`}
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input 
                        {...field} 
                        value={watchedItems[index]?.brand ?? ''}
                        placeholder="Marca" 
                        className="w-full px-2 py-1 text-xs bg-[#0b101a] text-slate-200 placeholder-slate-500 rounded border border-[#263352] focus:border-blue-500 focus:ring-1 focus:ring-blue-500" 
                        readOnly={viewMode === 'view'}
                      />
                    </FormControl>
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
                        value={watchedItems[index]?.model ?? ''}
                        placeholder="Modelo" 
                        className="w-full px-2 py-1 text-xs bg-[#0b101a] text-slate-200 placeholder-slate-500 rounded border border-[#263352] focus:border-blue-500 focus:ring-1 focus:ring-blue-500" 
                        readOnly={viewMode === 'view'}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
          );
        },
      },
      {
        id: "pricing",
        header: () => (
          <div className="uppercase text-[11px] text-slate-400 tracking-wider font-semibold text-right w-full">
            Preço Unitário
          </div>
        ),
        cell: ({ row }) => {
          const index = Number(row.id);
          const itemValue = row.original;
          const qItem = quotationItems.find((qi) => qi.id === row.original.quotationItemId);
          
          const unitPrice = parseFloat(itemValue?.unitPrice || "0");
          let quantity = parseFloat(qItem?.quantity || "0");
          const hasAvailableQuantity = itemValue?.availableQuantity !== null && itemValue?.availableQuantity !== undefined && itemValue?.availableQuantity !== "";
          if (hasAvailableQuantity && !isNaN(parseFloat(itemValue?.availableQuantity || ""))) {
              quantity = parseFloat(itemValue.availableQuantity || "0");
          }
          const originalTotal = isNaN(unitPrice) ? 0 : unitPrice * quantity;
          const brlTotal = roundCurrency(convertToBRL(originalTotal, resolvedRate));

          return (
            <div className="flex flex-col items-end gap-1">
              <FormField
                control={form.control}
                name={`items.${index}.unitPrice`}
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <div className="relative w-28">
                        <span className="absolute inset-y-0 left-0 pl-2 flex items-center text-[10px] text-slate-500 font-semibold">
                          {CURRENCY_SYMBOLS[resolvedCode]}
                        </span>
                        <DecimalInput
                          value={field.value}
                          onChange={field.onChange}
                          precision={4}
                          placeholder="0,0000"
                          className="h-[30px] pl-6 pr-2 text-right font-mono text-xs bg-[#0b101a] rounded border border-[#263352] text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                          readOnly={viewMode === 'view'}
                        />
                      </div>
                    </FormControl>
                    <FormMessage className="text-[10px]" />
                  </FormItem>
                )}
              />
              <span className="text-[10px] text-slate-500">
                Total Orig: {formatDualCurrency(originalTotal, brlTotal, resolvedCode)}
              </span>
            </div>
          );
        },
      },
      {
        id: "discount",
        header: () => (
          <div className="uppercase text-[11px] text-slate-400 tracking-wider font-semibold text-center w-full">
            Desconto
          </div>
        ),
        cell: ({ row }) => {
          const index = Number(row.id);
          const itemValue = row.original;
          const qItem = quotationItems.find((qi) => qi.id === row.original.quotationItemId);

          const unitPrice = parseFloat(itemValue?.unitPrice || "0");
          let quantity = parseFloat(qItem?.quantity || "0");
          const hasAvailableQuantity = itemValue?.availableQuantity !== null && itemValue?.availableQuantity !== undefined && itemValue?.availableQuantity !== "";
          if (hasAvailableQuantity && !isNaN(parseFloat(itemValue?.availableQuantity || ""))) {
              quantity = parseFloat(itemValue.availableQuantity || "0");
          }
          const originalTotal = isNaN(unitPrice) ? 0 : unitPrice * quantity;

          const discountPercent = parseFloat(itemValue?.discountPercentage || "0") || 0;
          const discountValueAbs = parseFloat(itemValue?.discountValue || "0") || 0;

          let discountCalc = 0;
          if (discountPercent > 0) {
            discountCalc = originalTotal * (discountPercent / 100);
          } else if (discountValueAbs > 0) {
            discountCalc = discountValueAbs;
          }
          const brlDiscount = roundCurrency(convertToBRL(discountCalc, resolvedRate));

          return (
            <div className="flex flex-col items-center gap-1">
              <FormField
                control={form.control}
                name={`items.${index}.discountPercentage`}
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <div className="flex w-24 rounded border border-[#263352] bg-[#0b101a] overflow-hidden focus-within:border-blue-500">
                        <DecimalInput
                          value={field.value}
                          onChange={(val) => {
                            field.onChange(val);
                            if (val) {
                              form.setValue(`items.${index}.discountValue`, "");
                            }
                          }}
                          precision={2}
                          className="h-[30px] w-14 py-1.5 px-2 text-right font-mono text-xs bg-transparent border-none text-white focus:ring-0 p-0"
                          readOnly={viewMode === 'view'}
                        />
                        <span className="px-2 py-1.5 bg-[#161c28] text-[11px] font-semibold text-slate-400 border-l border-[#263352]">%</span>
                      </div>
                    </FormControl>
                  </FormItem>
                )}
              />
              <span className={`text-[10px] ${discountCalc > 0 ? "text-emerald-400" : "text-slate-500"}`}>
                - {formatDualCurrency(discountCalc, brlDiscount, resolvedCode)}
              </span>
            </div>
          );
        },
      },
      {
        id: "availability",
        header: () => (
          <div className="uppercase text-[11px] text-slate-400 tracking-wider font-semibold w-full text-left">
            QTD. DISP. &amp; PRAZO
          </div>
        ),
        cell: ({ row }) => {
            const index = Number(row.id);
            const item = row.original;
            const qItem = quotationItems.find(qi => qi.id === item.quotationItemId);
            const isAvailable = item.isAvailable;

            return (
                <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-2">
                        <div className="flex-1 min-w-[110px]">
                            <label className="text-[9px] uppercase tracking-wider text-slate-400 font-semibold block mb-0.5">Qtd. DISPONÍVEL</label>
                            <FormField
                                control={form.control}
                                name={`items.${index}.availableQuantity`}
                                render={({ field }) => (
                                <FormItem>
                                    <FormControl>
                                    <div className="flex items-center rounded border border-[#263352] bg-[#0b101a] px-2 py-1 focus-within:border-blue-500">
                                        <Input
                                            {...field}
                                            type="text"
                                            placeholder={qItem?.quantity}
                                            className="w-full font-mono text-xs text-white bg-transparent border-none p-0 focus:ring-0 text-right font-semibold h-auto py-0"
                                            readOnly={viewMode === 'view'}
                                            onChange={(e) => {
                                                field.onChange(e);
                                            }}
                                        />
                                        <span className="text-[10px] text-slate-400 ml-1.5 font-medium flex-shrink-0">
                                          {watchedItems[index]?.confirmedUnit || qItem?.unit || "UN"}
                                        </span>
                                    </div>
                                    </FormControl>
                                </FormItem>
                                )}
                            />
                        </div>
                        <div className="w-24">
                            <label className="text-[9px] uppercase tracking-wider text-slate-400 font-semibold block mb-0.5">Unidade</label>
                            <FormField
                                control={form.control}
                                name={`items.${index}.confirmedUnit`}
                                render={({ field }) => (
                                <FormItem>
                                    <FormControl>
                                    <UnitSelect
                                        value={field.value || qItem?.unit || "UN"}
                                        onValueChange={field.onChange}
                                        disabled={viewMode === 'view'}
                                        className="h-[30px] py-1 px-1.5 text-xs bg-[#0b101a] rounded border border-[#263352] text-slate-300 focus:border-blue-500"
                                    />
                                    </FormControl>
                                </FormItem>
                                )}
                            />
                        </div>
                    </div>
                    <div className="flex items-center justify-between gap-2 pt-0.5">
                        <div className="flex items-center gap-1.5 flex-1">
                            <label className="text-[9px] uppercase tracking-wider text-slate-400 font-semibold block mb-0.5 whitespace-nowrap">Prazo:</label>
                            <FormField
                                control={form.control}
                                name={`items.${index}.deliveryDays`}
                                render={({ field }) => (
                                <FormItem>
                                    <FormControl>
                                    <div className="flex items-center rounded border border-[#263352] bg-[#0b101a] px-2 py-1 focus-within:border-blue-500 w-20">
                                        <Input
                                            {...field}
                                            type="text"
                                            className="w-full font-mono text-xs text-white bg-transparent border-none p-0 focus:ring-0 text-center font-medium h-auto py-0"
                                            readOnly={viewMode === 'view'}
                                        />
                                        <span className="text-[10px] text-slate-400 ml-1 flex-shrink-0">dias</span>
                                    </div>
                                    </FormControl>
                                </FormItem>
                                )}
                            />
                        </div>
                        <FormField
                            control={form.control}
                            name={`items.${index}.isAvailable`}
                            render={({ field }) => (
                                <FormItem className="space-y-0">
                                    <FormControl>
                                        <label className="inline-flex items-center gap-1.5 cursor-pointer bg-emerald-500/10 hover:bg-emerald-500/15 border border-emerald-500/30 px-2 py-1 rounded transition-colors flex-shrink-0">
                                          <Checkbox
                                              checked={field.value}
                                              onCheckedChange={(checked) => {
                                                  if (viewMode === 'view') return;
                                                  field.onChange(checked);
                                                  if (checked) {
                                                      form.setValue(`items.${index}.unavailabilityReason`, "");
                                                  }
                                              }}
                                              disabled={viewMode === 'view'}
                                              className="w-3.5 h-3.5 rounded text-orange-500 bg-[#0b101a] border-[#263352] focus:ring-orange-500"
                                          />
                                          <span className="text-[10px] text-emerald-300 font-semibold">Disponível</span>
                                        </label>
                                    </FormControl>
                                </FormItem>
                            )}
                        />
                    </div>
                    {!isAvailable && (
                        <div>
                          <FormField
                              control={form.control}
                              name={`items.${index}.unavailabilityReason`}
                              render={({ field }) => (
                                  <FormItem>
                                      <FormControl>
                                          <Input
                                              {...field}
                                              placeholder="Motivo da indisponibilidade"
                                              className="h-6 text-xs border-red-300 focus-visible:ring-red-500"
                                              readOnly={viewMode === 'view'}
                                          />
                                      </FormControl>
                                      <FormMessage className="text-[10px]" />
                                  </FormItem>
                              )}
                          />
                        </div>
                    )}
                </div>
            )
        }
      },
      {
        id: "total",
        header: () => (
          <div className="uppercase text-[11px] text-slate-400 tracking-wider font-semibold text-right w-full">
            Total Final
          </div>
        ),
        accessorFn: (row) => {
             const qItem = quotationItems.find(qi => qi.id === row?.quotationItemId);
             return calculateItemTotal(row, qItem);
        },
        cell: ({ row }) => {
             const item = row.original;
             const qItem = quotationItems.find(qi => qi.id === item?.quotationItemId);
             const total = calculateItemTotal(item, qItem);
             const brl = roundCurrency(convertToBRL(total, resolvedRate));
             
             const unitPrice = parseFloat(item?.unitPrice || "0");
             const discountPercent = parseFloat(item?.discountPercentage || "0") || 0;
             const discountValueAbs = parseFloat(item?.discountValue || "0") || 0;
             
             let unitFinal = unitPrice;
             if (discountPercent > 0) {
               unitFinal = unitPrice * (1 - discountPercent / 100);
             } else if (discountValueAbs > 0) {
               let quantity = parseFloat(qItem?.quantity || "0");
               const hasAvailableQuantity = item?.availableQuantity !== null && item?.availableQuantity !== undefined && item?.availableQuantity !== "";
               if (hasAvailableQuantity && !isNaN(parseFloat(item?.availableQuantity || ""))) {
                   quantity = parseFloat(item.availableQuantity || "0");
               }
               const totalOriginal = unitPrice * quantity;
               const totalAfter = Math.max(0, totalOriginal - discountValueAbs);
               unitFinal = quantity > 0 ? totalAfter / quantity : 0;
             }
             const brlUnit = roundCurrency(convertToBRL(unitFinal, resolvedRate));

             return (
                 <div className="flex flex-col items-end gap-0.5">
                     <span className="font-mono font-bold text-sm text-emerald-400">
                       {formatDualCurrency(total, brl, resolvedCode)}
                     </span>
                     <span className="text-[10px] text-slate-500">
                       Unit: <strong className="text-slate-300 font-mono">{formatDualCurrency(unitFinal, brlUnit, resolvedCode)}</strong>
                     </span>
                 </div>
             )
        }
      },
      {
        id: "itemObservations",
        header: () => (
          <div className="uppercase text-[11px] text-slate-400 tracking-wider font-semibold w-full text-left">
            Observações
          </div>
        ),
        cell: ({ row }) => {
            const index = Number(row.id);
            return (
                <FormField
                    control={form.control}
                    name={`items.${index}.observations`}
                    render={({ field }) => (
                        <FormItem>
                            <FormControl>
                                <Textarea
                                    {...field}
                                    placeholder="Obs..."
                                    rows={2}
                                    className="w-full text-xs bg-[#0b101a] text-slate-200 placeholder-slate-500 rounded border border-[#263352] py-1 px-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none"
                                    readOnly={viewMode === 'view'}
                                />
                            </FormControl>
                        </FormItem>
                    )}
                />
            )
        }
      }
    ],
    [form, quotationItems, viewMode, resolvedCode, resolvedRate, watchedItems]
  );

  const table = useReactTable({
    data: tableData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    onColumnFiltersChange: setColumnFilters,
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
    },
  });

  const exportToExcel = () => {
    const data = fields.map((field, index) => {
        const item = form.getValues(`items.${index}`);
        const qItem = quotationItems.find(qi => qi.id === item.quotationItemId);
        const total = calculateItemTotal(item, qItem);

        return {
            "Código": qItem?.itemCode,
            "Descrição": qItem?.description,
            "Quantidade Solicitada": qItem?.quantity,
            "Unidade Solicitada": qItem?.unit,
            "Unidade Confirmada": item.confirmedUnit || qItem?.unit,
            "Marca": item.brand,
            "Modelo": item.model,
            "Preço Unitário": item.unitPrice,
            "Desconto %": item.discountPercentage,
            "Desconto R$": item.discountValue,
            "Prazo (dias)": item.deliveryDays,
            "Qtd. Disponível": item.availableQuantity,
            "Disponível": item.isAvailable ? "Sim" : "Não",
            "Motivo Indisponibilidade": item.unavailabilityReason,
            "Total Final": total,
            "Observações": item.observations
        };
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Cotação");
    XLSX.writeFile(wb, "cotacao_export.xlsx");
  };

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="flex-1 overflow-y-auto overflow-x-auto min-h-0 bg-transparent">
        <table className="w-full text-left border-collapse text-xs">
          <TableHeader className="bg-[#111726]/95 text-slate-400 uppercase text-[11px] font-semibold tracking-wider sticky top-0 z-10 border-b border-[#263352] backdrop-blur">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="border-b-0 hover:bg-transparent">
                {headerGroup.headers.map((header) => {
                  const colId = header.column.id;
                  let widthClass = "";
                  if (colId === "item") widthClass = "py-3 px-3.5 min-w-[210px]";
                  else if (colId === "brandModel") widthClass = "py-3 px-2.5 min-w-[130px]";
                  else if (colId === "pricing") widthClass = "py-3 px-2.5 min-w-[110px] text-right";
                  else if (colId === "discount") widthClass = "py-3 px-2 min-w-[95px] text-center";
                  else if (colId === "availability") widthClass = "py-3 px-3 min-w-[190px] text-left";
                  else if (colId === "total") widthClass = "py-3 px-2.5 min-w-[110px] text-right";
                  else if (colId === "itemObservations") widthClass = "py-3 px-2.5 min-w-[135px] text-left";
                  else widthClass = "py-3 px-3";
                  return (
                    <TableHead key={header.id} className={widthClass}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody className="divide-y divide-[#263352]/60">
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className={`hover:bg-[#161c28]/60 transition-colors group border-b-0 ${!row.original.isAvailable ? "bg-red-900/10" : ""}`}
                >
                  {row.getVisibleCells().map((cell) => {
                    const colId = cell.column.id;
                    let cellClass = "align-top ";
                    if (colId === "item") cellClass += "py-3.5 px-3.5 align-top";
                    else if (colId === "brandModel") cellClass += "py-3.5 px-2.5 align-top";
                    else if (colId === "pricing") cellClass += "py-3.5 px-2.5 align-top text-right";
                    else if (colId === "discount") cellClass += "py-3.5 px-2 align-top";
                    else if (colId === "availability") cellClass += "py-3.5 px-3 align-top";
                    else if (colId === "total") cellClass += "py-3.5 px-2.5 align-top text-right";
                    else if (colId === "itemObservations") cellClass += "py-3.5 px-2.5 align-top";
                    else cellClass += "py-3.5 px-3 align-top";
                    return (
                      <TableCell key={cell.id} className={cellClass}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))
            ) : (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  Nenhum item encontrado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </table>
      </div>
    </div>
  );
}
