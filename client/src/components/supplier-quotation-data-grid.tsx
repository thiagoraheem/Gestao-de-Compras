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
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { DecimalInput } from "@/components/ui/decimal-input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { UseFormReturn, useFieldArray } from "react-hook-form";
import { UpdateSupplierQuotationData } from "./update-supplier-quotation-schema";
import { ArrowUpDown, ChevronDown, Download, SlidersHorizontal, AlertCircle } from "lucide-react";
import * as XLSX from 'xlsx';
import { parseBrazilianNumber, formatBrazilianNumber } from "@/lib/number-parser";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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
}

export function SupplierQuotationDataGrid({
  form,
  quotationItems,
  viewMode,
}: SupplierQuotationDataGridProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});

  const { fields } = useFieldArray({
    control: form.control,
    name: "items",
    keyName: "key", // use 'key' to avoid conflict with 'id' if present in data
  });

  // Calculate totals helper
  const calculateItemTotal = (item: any) => {
    if (!item || !item.unitPrice) return 0;
    
    // Find corresponding quotation item to get requested quantity if availableQuantity is not set
    const correspondingQuotationItem = quotationItems.find(qi => qi.id === item.quotationItemId);
    let quantity = parseFloat(correspondingQuotationItem?.quantity || "0");
    
    if (item.availableQuantity && !isNaN(parseFloat(item.availableQuantity))) {
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
              <Button
                variant="ghost"
                onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                className="-ml-4"
              >
                Item
                <ArrowUpDown className="ml-2 h-4 w-4" />
              </Button>
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
            <div className="space-y-1 min-w-[200px]">
              <div className="font-medium text-sm">
                {qItem.itemCode && <span className="text-muted-foreground mr-1">[{qItem.itemCode}]</span>}
                {qItem.description}
              </div>
              {qItem.specifications && (
                <div className="text-xs text-muted-foreground italic bg-muted/50 p-1 rounded">
                  {qItem.specifications}
                </div>
              )}
              <div className="flex items-center gap-2">
                 <Badge variant="secondary" className="text-xs whitespace-nowrap">
                    Solicitado: {formatBrazilianNumber(qItem.quantity, 0, 2)} {qItem.unit}
                 </Badge>
              </div>
            </div>
          );
        },
        enableHiding: false,
      },
      {
        id: "pricing",
        header: "Preço Unitário",
        cell: ({ row }) => {
          const index = row.index;
          const qItem = quotationItems.find((qi) => qi.id === row.original.quotationItemId);
          
          return (
            <div className="space-y-1 min-w-[120px]">
              <FormField
                control={form.control}
                name={`items.${index}.unitPrice`}
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <DecimalInput
                        value={field.value}
                        onChange={field.onChange}
                        precision={4}
                        placeholder="0,0000"
                        className="h-6 text-xs text-right"
                        readOnly={viewMode === 'view'}
                      />
                    </FormControl>
                    <FormMessage className="text-[10px]" />
                  </FormItem>
                )}
              />
              <div className="text-[10px] text-muted-foreground text-right">
                Total Orig.: R$ {(() => {
                   const unitPrice = parseBrazilianNumber(form.watch(`items.${index}.unitPrice`));
                   const quantity = parseFloat(qItem?.quantity || "0");
                   const total = isNaN(unitPrice) ? 0 : unitPrice * quantity;
                   return formatBrazilianNumber(total, 2, 2);
                })()}
              </div>
            </div>
          );
        },
      },
      {
        id: "discount",
        header: "Desconto",
        cell: ({ row }) => {
          const index = row.index;
          return (
            <div className="space-y-2 min-w-[80px]">
              <FormField
                control={form.control}
                name={`items.${index}.discountPercentage`}
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <div className="relative">
                        <DecimalInput
                          value={field.value}
                          onChange={(val) => {
                            field.onChange(val);
                            if (val) {
                              form.setValue(`items.${index}.discountValue`, "");
                            }
                          }}
                          precision={2}
                          className="h-6 text-xs pr-6 text-right"
                          readOnly={viewMode === 'view'}
                        />
                         <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                      </div>
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name={`items.${index}.discountValue`}
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                         <div className="relative">
                            <DecimalInput
                                value={field.value}
                                onChange={(val) => {
                                    field.onChange(val);
                                    if (val) {
                                        form.setValue(`items.${index}.discountPercentage`, "");
                                    }
                                }}
                                precision={4}
                                className="h-6 text-xs pr-6 text-right"
                                readOnly={viewMode === 'view'}
                            />
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                        </div>
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
          );
        },
      },
      {
        id: "delivery",
        header: "Prazo / Disp.",
        cell: ({ row }) => {
            const index = row.index;
            const item = row.original;
            const qItem = quotationItems.find(qi => qi.id === item.quotationItemId);

            return (
                <div className="space-y-2 min-w-[140px]">
                     <div className="flex items-center gap-2">
                        <span className="text-[10px] w-12 text-muted-foreground">Prazo (dias):</span>
                        <FormField
                            control={form.control}
                            name={`items.${index}.deliveryDays`}
                            render={({ field }) => (
                            <FormItem className="flex-1">
                                <FormControl>
                                <Input
                                    {...field}
                                    type="number"
                                    className="h-6 text-xs"
                                    readOnly={viewMode === 'view'}
                                />
                                </FormControl>
                            </FormItem>
                            )}
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] w-12 text-muted-foreground">Qtd. Disp.:</span>
                        <FormField
                            control={form.control}
                            name={`items.${index}.availableQuantity`}
                            render={({ field }) => (
                            <FormItem className="flex-1">
                                <FormControl>
                                <Input
                                    {...field}
                                    type="number"
                                    placeholder={qItem?.quantity}
                                    className="h-6 text-xs"
                                    readOnly={viewMode === 'view'}
                                    onChange={(e) => {
                                        field.onChange(e);
                                        // Check availability match
                                        const val = parseFloat(e.target.value);
                                        const req = parseFloat(qItem?.quantity || "0");
                                        if (!isNaN(val) && val !== req) {
                                            // Maybe auto-flag adjustment reason required?
                                        }
                                    }}
                                />
                                </FormControl>
                            </FormItem>
                            )}
                        />
                    </div>
                </div>
            )
        }
      },
      {
        id: "total",
        header: "Total Final",
        accessorFn: (row, index) => {
             const item = form.watch(`items.${index}`);
             return calculateItemTotal(item);
        },
        cell: ({ row }) => {
             const index = row.index;
             const total = calculateItemTotal(form.watch(`items.${index}`));
             
             return (
                 <div className="font-bold text-green-600 text-right min-w-[100px]">
                     R$ {formatBrazilianNumber(total, 2, 2)}
                 </div>
             )
        }
      },
      {
        id: "status",
        header: "Disp.",
        cell: ({ row }) => {
            const index = row.index;
            const isAvailable = form.watch(`items.${index}.isAvailable`);
            
            return (
                <div className="space-y-2 min-w-[150px]">
                    <FormField
                        control={form.control}
                        name={`items.${index}.isAvailable`}
                        render={({ field }) => (
                            <FormItem className="flex flex-row items-start space-x-2 space-y-0">
                                <FormControl>
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
                                    />
                                </FormControl>
                                <div className="space-y-1 leading-none">
                                    <span className="text-sm font-medium leading-none">
                                        Disp.
                                    </span>
                                </div>
                            </FormItem>
                        )}
                    />
                    {!isAvailable && (
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
                    )}
                </div>
            )
        }
      },
      {
        id: "brand_model",
        header: "Marca / Modelo",
        cell: ({ row }) => {
          const index = row.index;
          return (
            <div className="space-y-2 min-w-[140px]">
              <FormField
                control={form.control}
                name={`items.${index}.brand`}
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="Marca" 
                        className="h-6 text-xs" 
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
                        placeholder="Modelo" 
                        className="h-6 text-xs" 
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
        id: "obs",
        header: "Observações",
        cell: ({ row }) => {
            const index = row.index;
            return (
                <FormField
                    control={form.control}
                    name={`items.${index}.observations`}
                    render={({ field }) => (
                        <FormItem>
                            <FormControl>
                                <Input
                                    {...field}
                                    placeholder="Obs..."
                                    className="h-6 text-xs min-w-[120px]"
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
    [form, quotationItems, viewMode]
  );

  const table = useReactTable({
    data: fields,
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
        const total = calculateItemTotal(item);

        return {
            "Código": qItem?.itemCode,
            "Descrição": qItem?.description,
            "Quantidade Solicitada": qItem?.quantity,
            "Unidade": qItem?.unit,
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
         <div className="flex items-center gap-2">
            <Input
              placeholder="Filtrar itens..."
              value={(table.getColumn("item")?.getFilterValue() as string) ?? ""}
              onChange={(event) =>
                table.getColumn("item")?.setFilterValue(event.target.value)
              }
              className="max-w-sm h-8"
            />
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 ml-auto">
                        <SlidersHorizontal className="mr-2 h-4 w-4" />
                        Colunas
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    {table
                        .getAllColumns()
                        .filter((column) => column.getCanHide())
                        .map((column) => {
                            return (
                                <DropdownMenuCheckboxItem
                                    key={column.id}
                                    className="capitalize"
                                    checked={column.getIsVisible()}
                                    onCheckedChange={(value) =>
                                        column.toggleVisibility(!!value)
                                    }
                                >
                                    {column.id}
                                </DropdownMenuCheckboxItem>
                            )
                        })}
                </DropdownMenuContent>
            </DropdownMenu>
         </div>
         <Button variant="outline" size="sm" onClick={exportToExcel} className="h-8">
            <Download className="mr-2 h-4 w-4" />
            Exportar Excel
         </Button>
      </div>

      <div className="rounded-md border overflow-x-auto">
        <table className="w-full caption-bottom text-sm">
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id}>
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
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className={!form.watch(`items.${row.index}.isAvailable`) ? "bg-red-50/50 dark:bg-red-900/10" : ""}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="p-2">
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
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
      <div className="flex items-center justify-end space-x-2 py-4">
        <div className="flex-1 text-sm text-muted-foreground">
          {table.getFilteredRowModel().rows.length} item(s) listados.
        </div>
      </div>
    </div>
  );
}
