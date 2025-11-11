import { type ReactNode, useEffect, useMemo, useState } from "react";
import type { CheckedState } from "@radix-ui/react-checkbox";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  AlertTriangle,
  CheckCircle2,
  History,
  Loader2,
  RefreshCcw,
  RotateCcw,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type IntegrationDifference = {
  erp: string | null;
  local: string | null;
};

export type IntegrationStatusCounters = {
  pending: number;
  applied: number;
  failed: number;
  skipped: number;
  invalid: number;
  cancelled: number;
};

export type SupplierIntegrationSummary = {
  totalFromErp: number;
  actionable: number;
  create: number;
  update: number;
  invalid: number;
  ignored: number;
  statusCounters: IntegrationStatusCounters;
};

type SupplierSnapshot = {
  id: number;
  name?: string | null;
  cnpj?: string | null;
  cpf?: string | null;
  contact?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  paymentTerms?: string | null;
  website?: string | null;
  idSupplierERP?: number | null;
};

type ErpSupplierPayload = {
  id: number;
  name: string;
  tradeName?: string;
  cnpj?: string;
  cpf?: string;
  document?: string;
  email?: string;
  phone?: string;
  contact?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  paymentTerms?: string;
  website?: string;
  raw?: Record<string, unknown>;
};

type IntegrationItemPayload = {
  erp: ErpSupplierPayload;
  local?: SupplierSnapshot | null;
  insertData?: Record<string, unknown>;
  updateData?: { id: number; changes: Record<string, unknown> };
  createdSupplierId?: number;
  appliedAt?: string;
  failureMessage?: string;
};

export type SupplierIntegrationItem = {
  id: number;
  runId: number;
  erpId: string;
  erpDocument: string | null;
  erpName: string;
  action: "create" | "update" | "review";
  matchType: "idsuppliererp" | "cnpj" | "cpf" | "none";
  status: "pending" | "applied" | "failed" | "skipped" | "invalid" | "cancelled";
  selected: boolean;
  localSupplierId: number | null;
  payload: IntegrationItemPayload;
  differences: Record<string, IntegrationDifference>;
  issues: string[];
};

export type SupplierIntegrationRun = {
  id: number;
  status: "running" | "ready" | "completed" | "failed" | "cancelled";
  startedAt: string;
  finishedAt: string | null;
  totalSuppliers: number;
  processedSuppliers: number;
  createdSuppliers: number;
  updatedSuppliers: number;
  ignoredSuppliers: number;
  invalidSuppliers: number;
  message: string | null;
  createdBy?: number | null;
  metadata?: Record<string, unknown> | null;
};

type SupplierIntegrationResponse = {
  run: SupplierIntegrationRun;
  items: SupplierIntegrationItem[];
  summary: SupplierIntegrationSummary;
};

type SupplierIntegrationHistoryEntry = SupplierIntegrationResponse;

type SupplierIntegrationPanelProps = {
  onRefreshSuppliers: () => void;
};

type Filters = {
  search: string;
  action: "all" | "create" | "update" | "review";
  status:
    | "all"
    | "pending"
    | "applied"
    | "failed"
    | "skipped"
    | "invalid"
    | "cancelled";
  showOnlySelected: boolean;
  showOnlyDifferences: boolean;
};

const INITIAL_FILTERS: Filters = {
  search: "",
  action: "all",
  status: "pending",
  showOnlySelected: false,
  showOnlyDifferences: false,
};

const PAGE_SIZE = 12;

const statusLabels: Record<SupplierIntegrationItem["status"], string> = {
  pending: "Pendente",
  applied: "Aplicado",
  failed: "Falhou",
  skipped: "Ignorado",
  invalid: "Inválido",
  cancelled: "Cancelado",
};

const actionLabels: Record<SupplierIntegrationItem["action"], string> = {
  create: "Cadastrar",
  update: "Atualizar",
  review: "Revisar",
};

const statusStyles: Record<SupplierIntegrationItem["status"], string> = {
  pending: "bg-blue-100 text-blue-800",
  applied: "bg-emerald-100 text-emerald-800",
  failed: "bg-red-100 text-red-800",
  skipped: "bg-slate-100 text-slate-800",
  invalid: "bg-amber-100 text-amber-800",
  cancelled: "bg-muted text-muted-foreground",
};

const actionStyles: Record<SupplierIntegrationItem["action"], string> = {
  create: "bg-emerald-100 text-emerald-800",
  update: "bg-blue-100 text-blue-800",
  review: "bg-amber-100 text-amber-800",
};

const runStatusLabels: Record<SupplierIntegrationRun["status"], string> = {
  running: "Em andamento",
  ready: "Pronto",
  completed: "Concluído",
  failed: "Falhou",
  cancelled: "Cancelado",
};

const runStatusStyles: Record<SupplierIntegrationRun["status"], string> = {
  running: "bg-blue-100 text-blue-800",
  ready: "bg-amber-100 text-amber-800",
  completed: "bg-emerald-100 text-emerald-800",
  failed: "bg-red-100 text-red-800",
  cancelled: "bg-muted text-muted-foreground",
};

function formatDocument(doc?: string | null): string {
  if (!doc) return "N/A";
  const digits = doc.replace(/\D+/g, "");
  if (digits.length === 14) {
    return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  }
  if (digits.length === 11) {
    return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  }
  return doc;
}

function formatDateTime(value?: string | null): string {
  if (!value) return "-";
  try {
    const date = new Date(value);
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(date);
  } catch {
    return value;
  }
}

function getRowHighlight(status: SupplierIntegrationItem["status"], issues: string[]) {
  if (status === "failed") return "bg-red-50";
  if (status === "invalid") return "bg-amber-50";
  if (status === "applied") return "bg-emerald-50";
  if (issues.length > 0) return "bg-amber-50";
  return "";
}

export function SupplierIntegrationPanel({
  onRefreshSuppliers,
}: SupplierIntegrationPanelProps) {
  const [integration, setIntegration] = useState<SupplierIntegrationResponse | null>(
    null,
  );
  const [filters, setFilters] = useState<Filters>(INITIAL_FILTERS);
  const [page, setPage] = useState(1);
  const [selectedItems, setSelectedItems] = useState<Record<number, boolean>>({});
  const [erpSearch, setErpSearch] = useState("");
  const [erpLimit, setErpLimit] = useState("200");
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const historyQuery = useQuery<SupplierIntegrationHistoryEntry[]>({
    queryKey: ["/api/suppliers/integration/runs?limit=10"],
    queryFn: async () =>
      await apiRequest("/api/suppliers/integration/runs?limit=10"),
    enabled: isHistoryOpen || Boolean(integration),
    staleTime: 1000 * 30,
  });

  const startIntegrationMutation = useMutation({
    mutationFn: async () => {
      const limitValue = parseInt(erpLimit, 10);
      return await apiRequest("/api/suppliers/integration/start", {
        method: "POST",
        body: {
          search: erpSearch.trim() || undefined,
          limit: Number.isFinite(limitValue) && limitValue > 0 ? limitValue : undefined,
        },
      });
    },
    onSuccess: (data: SupplierIntegrationResponse) => {
      setIntegration(data);
      toast({
        title: "Integração carregada",
        description: `${data.summary.create + data.summary.update} fornecedor(es) requerem ação`,
      });
      historyQuery.refetch();
    },
    onError: (error: unknown) => {
      toast({
        title: "Erro ao carregar fornecedores do ERP",
        description: error instanceof Error ? error.message : "Tente novamente mais tarde",
        variant: "destructive",
      });
    },
  });

  const applyIntegrationMutation = useMutation({
    mutationFn: async (itemIds: number[] | undefined) => {
      if (!integration) throw new Error("Nenhuma integração ativa");
      return await apiRequest(
        `/api/suppliers/integration/runs/${integration.run.id}/apply`,
        {
          method: "POST",
          body: { itemIds },
        },
      );
    },
    onSuccess: (data: SupplierIntegrationResponse) => {
      setIntegration(data);
      toast({
        title: "Integração aplicada",
        description: "Fornecedores atualizados com sucesso",
      });
      onRefreshSuppliers();
      historyQuery.refetch();
      queryClient.invalidateQueries({ queryKey: ["/api/suppliers"] });
    },
    onError: (error: unknown) => {
      toast({
        title: "Erro ao aplicar integração",
        description: error instanceof Error ? error.message : "Tente novamente mais tarde",
        variant: "destructive",
      });
    },
  });

  const cancelIntegrationMutation = useMutation({
    mutationFn: async () => {
      if (!integration) throw new Error("Nenhuma integração ativa");
      return await apiRequest(
        `/api/suppliers/integration/runs/${integration.run.id}/cancel`,
        {
          method: "POST",
        },
      );
    },
    onSuccess: (data: SupplierIntegrationResponse) => {
      setIntegration(data);
      toast({
        title: "Integração cancelada",
        description: "O processo foi cancelado com sucesso",
      });
      historyQuery.refetch();
    },
    onError: (error: unknown) => {
      toast({
        title: "Erro ao cancelar integração",
        description: error instanceof Error ? error.message : "Tente novamente mais tarde",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (!integration) {
      setSelectedItems({});
      return;
    }
    const defaults: Record<number, boolean> = {};
    integration.items.forEach((item) => {
      defaults[item.id] = item.status === "pending" && item.selected;
    });
    setSelectedItems(defaults);
    setPage(1);
  }, [integration]);

  useEffect(() => {
    setPage(1);
  }, [filters.search, filters.action, filters.status, filters.showOnlySelected, filters.showOnlyDifferences]);

  useEffect(() => {
    if (isHistoryOpen) {
      historyQuery.refetch();
    }
  }, [isHistoryOpen]);

  const selectedPendingIds = useMemo(() => {
    if (!integration) return [] as number[];
    return integration.items
      .filter((item) => item.status === "pending" && selectedItems[item.id])
      .map((item) => item.id);
  }, [integration, selectedItems]);

  const filteredItems = useMemo(() => {
    if (!integration) return [] as SupplierIntegrationItem[];
    const searchTerm = filters.search.trim().toLowerCase();
    return integration.items.filter((item) => {
      if (
        filters.status !== "all" &&
        item.status !== filters.status &&
        !(filters.status === "pending" && item.status === "invalid")
      ) {
        return false;
      }
      if (filters.action !== "all" && item.action !== filters.action) {
        return false;
      }
      if (filters.showOnlySelected && !selectedItems[item.id]) {
        return false;
      }
      if (filters.showOnlyDifferences) {
        const differenceCount = Object.keys(item.differences ?? {}).length;
        if (differenceCount === 0) {
          return false;
        }
      }
      if (!searchTerm) return true;
      const localName = item.payload.local?.name?.toLowerCase() ?? "";
      const erpName = item.erpName.toLowerCase();
      const document = item.erpDocument?.toLowerCase() ?? "";
      return (
        erpName.includes(searchTerm) ||
        localName.includes(searchTerm) ||
        document.includes(searchTerm)
      );
    });
  }, [integration, filters, selectedItems]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginatedItems = filteredItems.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  const handleSelectionChange = (itemId: number, checked: boolean) => {
    setSelectedItems((prev) => ({ ...prev, [itemId]: checked }));
  };

  const handleSelectAll = (checked: boolean) => {
    const updated: Record<number, boolean> = { ...selectedItems };
    paginatedItems.forEach((item) => {
      if (item.status === "pending") {
        updated[item.id] = checked;
      }
    });
    setSelectedItems(updated);
  };

  const applyIntegration = () => {
    applyIntegrationMutation.mutate(selectedPendingIds.length ? selectedPendingIds : undefined);
  };

  const renderSummaryBadge = (
    label: string,
    value: number,
    icon?: ReactNode,
  ) => (
    <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-sm">
      {icon}
      <span className="font-medium">{label}:</span>
      <span>{value}</span>
    </div>
  );

  return (
    <Card className="mb-8 border-primary/20 shadow-sm">
      <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <CardTitle className="text-xl font-semibold">
            Integração de Fornecedores com ERP
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Carregue fornecedores do ERP, compare com a base interna e selecione quais ações aplicar.
          </p>
        </div>
        <div className="flex flex-col items-stretch gap-2 md:flex-row md:items-center">
          <div className="flex flex-1 gap-2">
            <Input
              placeholder="Buscar no ERP"
              value={erpSearch}
              onChange={(event) => setErpSearch(event.target.value)}
              className="md:w-56"
            />
            <Input
              placeholder="Limite"
              type="number"
              min={1}
              max={1000}
              value={erpLimit}
              onChange={(event) => setErpLimit(event.target.value)}
              className="w-24"
            />
          </div>
          <div className="flex items-center gap-2">
            <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <History className="mr-2 h-4 w-4" /> Ver histórico
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-3xl">
                <DialogHeader>
                  <DialogTitle>Histórico de integrações</DialogTitle>
                </DialogHeader>
                {historyQuery.isLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-6 w-full" />
                    <Skeleton className="h-6 w-full" />
                    <Skeleton className="h-6 w-full" />
                  </div>
                ) : historyQuery.data && historyQuery.data.length > 0 ? (
                  <div className="space-y-4">
                    {historyQuery.data.map((entry) => (
                      <div
                        key={entry.run.id}
                        className="rounded-md border p-4 shadow-sm"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span>Execução #{entry.run.id}</span>
                            <span>•</span>
                            <span>{formatDateTime(entry.run.startedAt)}</span>
                          </div>
                          <Badge className={cn("uppercase", runStatusStyles[entry.run.status])}>
                            {runStatusLabels[entry.run.status]}
                          </Badge>
                        </div>
                        {entry.run.message && (
                          <p className="mt-2 text-sm text-muted-foreground">
                            {entry.run.message}
                          </p>
                        )}
                        <div className="mt-3 grid grid-cols-1 gap-2 text-sm md:grid-cols-3">
                          {renderSummaryBadge("Total ERP", entry.summary.totalFromErp, <History className="h-4 w-4 text-muted-foreground" />)}
                          {renderSummaryBadge("Cadastrar", entry.summary.create, <CheckCircle2 className="h-4 w-4 text-emerald-600" />)}
                          {renderSummaryBadge("Atualizar", entry.summary.update, <RefreshCcw className="h-4 w-4 text-blue-600" />)}
                          {renderSummaryBadge("Inválidos", entry.summary.invalid, <AlertTriangle className="h-4 w-4 text-amber-600" />)}
                          {renderSummaryBadge("Ignorados", entry.summary.ignored, <RotateCcw className="h-4 w-4 text-muted-foreground" />)}
                          {renderSummaryBadge("Pendentes", entry.summary.statusCounters.pending, <Loader2 className="h-4 w-4 text-blue-600" />)}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Nenhuma integração foi executada até o momento.
                  </p>
                )}
              </DialogContent>
            </Dialog>
            <Button
              onClick={() => startIntegrationMutation.mutate()}
              disabled={startIntegrationMutation.isPending}
            >
              {startIntegrationMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCcw className="mr-2 h-4 w-4" />
              )}
              Carregar fornecedores
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {integration ? (
          <div className="space-y-6">
            <div className="flex flex-col gap-4 rounded-md border bg-muted/40 p-4 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>Integração #{integration.run.id}</span>
                  <span>•</span>
                  <span>Status:</span>
                  <Badge className={cn("uppercase", runStatusStyles[integration.run.status])}>
                    {runStatusLabels[integration.run.status]}
                  </Badge>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>Iniciada em {formatDateTime(integration.run.startedAt)}</span>
                  {integration.run.finishedAt && (
                    <>
                      <span>•</span>
                      <span>Finalizada em {formatDateTime(integration.run.finishedAt)}</span>
                    </>
                  )}
                </div>
                {integration.run.message && (
                  <p className="text-sm text-muted-foreground">{integration.run.message}</p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {renderSummaryBadge(
                  "Cadastrar",
                  integration.summary.create,
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />,
                )}
                {renderSummaryBadge(
                  "Atualizar",
                  integration.summary.update,
                  <RefreshCcw className="h-4 w-4 text-blue-600" />,
                )}
                {renderSummaryBadge(
                  "Inválidos",
                  integration.summary.invalid,
                  <AlertTriangle className="h-4 w-4 text-amber-600" />,
                )}
                {renderSummaryBadge(
                  "Ignorados",
                  integration.summary.ignored,
                  <RotateCcw className="h-4 w-4 text-muted-foreground" />,
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Input
                placeholder="Filtrar por nome ou documento"
                value={filters.search}
                onChange={(event) =>
                  setFilters((prev) => ({ ...prev, search: event.target.value }))
                }
                className="md:col-span-2"
              />
              <Select
                value={filters.action}
                onValueChange={(value: Filters["action"]) =>
                  setFilters((prev) => ({ ...prev, action: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Ação" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as ações</SelectItem>
                  <SelectItem value="create">Cadastrar</SelectItem>
                  <SelectItem value="update">Atualizar</SelectItem>
                  <SelectItem value="review">Revisar</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={filters.status}
                onValueChange={(value: Filters["status"]) =>
                  setFilters((prev) => ({ ...prev, status: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="pending">Pendentes</SelectItem>
                  <SelectItem value="applied">Aplicados</SelectItem>
                  <SelectItem value="failed">Falhos</SelectItem>
                  <SelectItem value="skipped">Ignorados</SelectItem>
                  <SelectItem value="invalid">Inválidos</SelectItem>
                  <SelectItem value="cancelled">Cancelados</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Checkbox
                    checked={filters.showOnlySelected}
                    onCheckedChange={(checked) =>
                      setFilters((prev) => ({
                        ...prev,
                        showOnlySelected: Boolean(checked),
                      }))
                    }
                  />
                  Apenas selecionados
                </label>
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Checkbox
                    checked={filters.showOnlyDifferences}
                    onCheckedChange={(checked) =>
                      setFilters((prev) => ({
                        ...prev,
                        showOnlyDifferences: Boolean(checked),
                      }))
                    }
                  />
                  Só com diferenças
                </label>
              </div>
            </div>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      {(() => {
                        const selectableItems = paginatedItems.filter(
                          (item) => item.status === "pending",
                        );
                        const allPendingSelected =
                          selectableItems.length > 0 &&
                          selectableItems.every((item) => selectedItems[item.id]);
                        const somePendingSelected = selectableItems.some(
                          (item) => selectedItems[item.id],
                        );
                        const checkboxState: CheckedState = allPendingSelected
                          ? true
                          : somePendingSelected
                            ? "indeterminate"
                            : false;

                        return (
                          <Checkbox
                            checked={checkboxState}
                            onCheckedChange={(checked) =>
                              handleSelectAll(checked === true)
                            }
                          />
                        );
                      })()}
                    </TableHead>
                    <TableHead>Fornecedor ERP</TableHead>
                    <TableHead>Documento</TableHead>
                    <TableHead>Ação</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Diferenças</TableHead>
                    <TableHead>Observações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedItems.map((item) => {
                    const differenceEntries = Object.entries(item.differences ?? {});
                    const issues = item.issues ?? [];
                    return (
                      <TableRow
                        key={item.id}
                        className={cn(
                          "align-top",
                          getRowHighlight(item.status, issues),
                          item.status === "failed" && "border-l-4 border-red-500",
                          item.status === "invalid" && "border-l-4 border-amber-500",
                          item.status === "applied" && "border-l-4 border-emerald-500",
                        )}
                      >
                        <TableCell>
                          <Checkbox
                            disabled={item.status !== "pending"}
                            checked={Boolean(selectedItems[item.id])}
                            onCheckedChange={(checked) =>
                              handleSelectionChange(item.id, Boolean(checked))
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <span className="font-medium text-sm">{item.erpName}</span>
                            {item.payload.local?.name && (
                              <span className="text-xs text-muted-foreground">
                                Local: {item.payload.local.name}
                              </span>
                            )}
                            {item.payload.erp.tradeName && (
                              <span className="text-xs text-muted-foreground">
                                Fantasia: {item.payload.erp.tradeName}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <p>{formatDocument(item.erpDocument)}</p>
                            {item.matchType !== "none" && (
                              <span className="text-xs text-muted-foreground">
                                Match por {item.matchType.toUpperCase()}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={cn("uppercase", actionStyles[item.action])}>
                            {actionLabels[item.action]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={cn("uppercase", statusStyles[item.status])}>
                            {statusLabels[item.status]}
                          </Badge>
                          {item.payload.failureMessage && (
                            <p className="mt-1 text-xs text-red-600">
                              {item.payload.failureMessage}
                            </p>
                          )}
                        </TableCell>
                        <TableCell>
                          {differenceEntries.length > 0 ? (
                            <div className="flex flex-col gap-1 text-xs">
                              {differenceEntries.map(([field, diff]) => (
                                <div key={field} className="rounded bg-muted px-2 py-1">
                                  <span className="font-semibold uppercase text-muted-foreground">
                                    {field}
                                  </span>
                                  <div className="mt-1 flex flex-col gap-0.5">
                                    <span>
                                      ERP: {diff.erp ? diff.erp : <span className="text-muted-foreground">-</span>}
                                    </span>
                                    <span>
                                      Local: {diff.local ? diff.local : <span className="text-muted-foreground">-</span>}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">Sem diferenças</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {issues.length > 0 ? (
                            <div className="flex flex-col gap-1 text-xs text-amber-700">
                              {issues.map((issue, index) => (
                                <div key={`${item.id}-issue-${index}`} className="flex items-start gap-2">
                                  <AlertTriangle className="mt-0.5 h-3 w-3" />
                                  <span>{issue}</span>
                                </div>
                              ))}
                            </div>
                          ) : item.status === "applied" ? (
                            <div className="flex items-center gap-1 text-xs text-emerald-700">
                              <CheckCircle2 className="h-3 w-3" />
                              <span>Aplicado</span>
                            </div>
                          ) : item.status === "failed" ? (
                            <div className="flex items-center gap-1 text-xs text-red-700">
                              <XCircle className="h-3 w-3" />
                              <span>Falha ao processar</span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {paginatedItems.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-sm text-muted-foreground">
                        Nenhum fornecedor encontrado com os filtros selecionados.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="text-sm text-muted-foreground">
                Mostrando {paginatedItems.length} de {filteredItems.length} fornecedor(es).
              </div>
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      href="#"
                      onClick={(event) => {
                        event.preventDefault();
                        setPage((prev) => Math.max(1, prev - 1));
                      }}
                    />
                  </PaginationItem>
                  <PaginationItem>
                    <span className="px-4 py-2 text-sm font-medium">
                      Página {currentPage} de {totalPages}
                    </span>
                  </PaginationItem>
                  <PaginationItem>
                    <PaginationNext
                      href="#"
                      onClick={(event) => {
                        event.preventDefault();
                        setPage((prev) => Math.min(totalPages, prev + 1));
                      }}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>

            <div className="flex flex-col items-stretch gap-2 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <span>
                  Selecionados: <strong>{selectedPendingIds.length}</strong>
                </span>
                <span>
                  Pendentes: <strong>{integration.summary.statusCounters.pending}</strong>
                </span>
                <span>
                  Falhas: <strong>{integration.summary.statusCounters.failed}</strong>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => cancelIntegrationMutation.mutate()}
                  disabled={
                    !integration ||
                    cancelIntegrationMutation.isPending ||
                    integration.run.status === "cancelled" ||
                    integration.run.status === "completed"
                  }
                >
                  {cancelIntegrationMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <XCircle className="mr-2 h-4 w-4" />
                  )}
                  Cancelar processo
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      disabled={
                        applyIntegrationMutation.isPending ||
                        selectedPendingIds.length === 0 ||
                        integration.run.status === "cancelled"
                      }
                    >
                      {applyIntegrationMutation.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                      )}
                      Gravar alterações
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Confirmar integração</AlertDialogTitle>
                      <AlertDialogDescription>
                        Deseja aplicar as ações selecionadas para {selectedPendingIds.length}{" "}
                        fornecedor(es)? Esta operação atualizará o cadastro interno com os dados do ERP.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={applyIntegration}>
                        Confirmar
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </div>
        ) : startIntegrationMutation.isPending ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-3 rounded-md border border-dashed p-8 text-center">
            <History className="h-10 w-10 text-muted-foreground" />
            <div className="space-y-1">
              <h3 className="text-lg font-semibold">Nenhuma integração carregada</h3>
              <p className="text-sm text-muted-foreground">
                Use o botão "Carregar fornecedores" para buscar dados do ERP e iniciar o processo de comparação.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
