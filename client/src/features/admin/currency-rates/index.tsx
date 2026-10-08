import { useState, useMemo } from "react";
import AdminRoute from "@/app/guards/admin-route";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Skeleton } from "@/shared/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { DateInput } from "@/shared/ui/date-input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/table";
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
import { Plus, Trash2, Edit, TrendingUp } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  SUPPORTED_CURRENCIES,
  CURRENCY_LABELS,
  CURRENCY_SYMBOLS,
} from "../../../../../shared/utils/currency-utils";
import type { CurrencyCode } from "../../../../../shared/utils/currency-utils";
import {
  useCurrencyRates,
  useCreateCurrencyRate,
  useUpdateCurrencyRate,
  useDeleteCurrencyRate,
} from "./api";
import { CurrencyRateFormModal } from "./currency-rate-form";
import type { CurrencyRate, CurrencyRateFilters, CreateCurrencyRatePayload } from "./types";

function formatRateValue(value: number): string {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 6,
    maximumFractionDigits: 6,
  });
}

function formatDateBR(dateStr: string): string {
  try {
    return format(new Date(dateStr + "T00:00:00"), "dd/MM/yyyy", { locale: ptBR });
  } catch {
    return dateStr;
  }
}

function getCreatedByLabel(rate: CurrencyRate): string {
  const u = rate.createdByUser;
  if (!u) return "—";
  const name = [u.firstName, u.lastName].filter(Boolean).join(" ").trim();
  return name || u.username || `Usuário #${rate.createdBy}`;
}

export function AdminCurrencyRatesPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRate, setEditingRate] = useState<CurrencyRate | null>(null);

  const [filters, setFilters] = useState<CurrencyRateFilters>({
    currencyCode: undefined,
    fromDate: undefined,
    toDate: undefined,
  });

  const [deleteTarget, setDeleteTarget] = useState<CurrencyRate | null>(null);

  const { data: rates = [], isLoading } = useCurrencyRates(filters);
  const createMutation = useCreateCurrencyRate();
  const updateMutation = useUpdateCurrencyRate();
  const deleteMutation = useDeleteCurrencyRate();

  const sortedRates = useMemo(() => {
    return [...rates].sort((a, b) => {
      const dateCmp = b.rateDate.localeCompare(a.rateDate);
      if (dateCmp !== 0) return dateCmp;
      return b.createdAt.localeCompare(a.createdAt);
    });
  }, [rates]);

  const handleOpenCreate = () => {
    setEditingRate(null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingRate(null);
  };

  const handleEdit = (rate: CurrencyRate) => {
    setEditingRate(rate);
    setIsModalOpen(true);
  };

  const handleSubmit = (data: CreateCurrencyRatePayload) => {
    if (editingRate) {
      updateMutation.mutate(
        { id: editingRate.id, payload: data },
        { onSuccess: () => handleCloseModal() }
      );
    } else {
      createMutation.mutate(data, { onSuccess: () => handleCloseModal() });
    }
  };

  const handleConfirmDelete = () => {
    if (deleteTarget) {
      deleteMutation.mutate(deleteTarget.id, {
        onSuccess: () => setDeleteTarget(null),
      });
    }
  };

  const isSubmitPending = createMutation.isPending || updateMutation.isPending;

  return (
    <AdminRoute>
      <div className="h-full overflow-y-auto bg-background">
        <div className="max-w-7xl mx-auto p-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                    <TrendingUp className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle>Cotações de Moeda</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      Gerencie as taxas de câmbio das moedas suportadas
                    </p>
                  </div>
                </div>
                <Button onClick={handleOpenCreate}>
                  <Plus className="mr-2 h-4 w-4" /> Nova Cotação
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Moeda</label>
                  <Select
                    value={filters.currencyCode ?? "all"}
                    onValueChange={(val) =>
                      setFilters((f) => ({
                        ...f,
                        currencyCode: val === "all" ? undefined : (val as CurrencyCode),
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Todas as moedas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as moedas</SelectItem>
                      {SUPPORTED_CURRENCIES.map((code) => (
                        <SelectItem key={code} value={code}>
                          {code} - {CURRENCY_LABELS[code]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Data inicial</label>
                  <DateInput
                    value={filters.fromDate ?? ""}
                    onChange={(val) =>
                      setFilters((f) => ({ ...f, fromDate: val || undefined }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Data final</label>
                  <DateInput
                    value={filters.toDate ?? ""}
                    onChange={(val) =>
                      setFilters((f) => ({ ...f, toDate: val || undefined }))
                    }
                  />
                </div>

                <Button
                  variant="outline"
                  onClick={() =>
                    setFilters({
                      currencyCode: undefined,
                      fromDate: undefined,
                      toDate: undefined,
                    })
                  }
                >
                  Limpar filtros
                </Button>
              </div>

              {isLoading ? (
                <div className="space-y-2 pt-4">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : (
                <div className="relative overflow-x-auto overflow-y-auto max-h-[65vh] border rounded-md mt-2">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background">
                      <TableRow>
                        <TableHead className="min-w-[140px]">Moeda</TableHead>
                        <TableHead className="min-w-[130px]">Data</TableHead>
                        <TableHead className="min-w-[200px] text-right">Taxa (x BRL)</TableHead>
                        <TableHead className="min-w-[180px]">Criado por</TableHead>
                        <TableHead className="min-w-[200px]">Observações</TableHead>
                        <TableHead className="sticky right-0 bg-background z-10 border-l min-w-[120px] text-right">
                          Ações
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedRates.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={6}
                            className="text-center py-10 text-muted-foreground"
                          >
                            Nenhuma cotação encontrada para os filtros selecionados.
                          </TableCell>
                        </TableRow>
                      ) : (
                        sortedRates.map((rate) => (
                          <TableRow key={rate.id}>
                            <TableCell className="whitespace-nowrap font-medium">
                              <div className="flex flex-col">
                                <span>
                                  {rate.currencyCode} ({CURRENCY_SYMBOLS[rate.currencyCode]})
                                </span>
                                <span className="text-xs text-muted-foreground font-normal">
                                  {CURRENCY_LABELS[rate.currencyCode]}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              {formatDateBR(rate.rateDate)}
                            </TableCell>
                            <TableCell className="text-right whitespace-nowrap font-mono text-sm">
                              <div>
                                <span className="font-semibold">
                                  {formatRateValue(rate.rateValue)}
                                </span>
                                <span className="text-muted-foreground ml-1">x BRL</span>
                              </div>
                              <div className="text-[10px] text-muted-foreground mt-0.5">
                                Atualizado em {formatDateBR(rate.updatedAt.substring(0, 10))}
                              </div>
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              {getCreatedByLabel(rate)}
                            </TableCell>
                            <TableCell className="max-w-[260px]">
                              <div className="truncate" title={rate.observations ?? ""}>
                                {rate.observations || (
                                  <span className="text-muted-foreground italic">
                                    Sem observações
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="sticky right-0 bg-background z-10 border-l">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEdit(rate)}
                                  title="Editar"
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setDeleteTarget(rate)}
                                  title="Excluir"
                                  className="hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          <CurrencyRateFormModal
            isOpen={isModalOpen}
            onClose={handleCloseModal}
            editingRate={editingRate}
            onSubmit={handleSubmit}
            isPending={isSubmitPending}
          />

          <AlertDialog
            open={!!deleteTarget}
            onOpenChange={(open) => !open && setDeleteTarget(null)}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir cotação de moeda?</AlertDialogTitle>
                <AlertDialogDescription>
                  {deleteTarget && (
                    <>
                      Esta ação exclui permanentemente a cotação de{" "}
                      <strong>
                        {deleteTarget.currencyCode} em {formatDateBR(deleteTarget.rateDate)}
                      </strong>{" "}
                      (taxa: {formatRateValue(deleteTarget.rateValue)} x BRL).
                      <br />
                      Esta operação não pode ser desfeita.
                    </>
                  )}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={deleteMutation.isPending}>
                  Cancelar
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleConfirmDelete}
                  disabled={deleteMutation.isPending}
                  className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
                >
                  {deleteMutation.isPending ? "Excluindo..." : "Sim, excluir"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </AdminRoute>
  );
}

export default AdminCurrencyRatesPage;
