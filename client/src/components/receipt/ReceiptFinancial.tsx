import React, { useMemo, useState } from "react";
import { useReceipt } from "./ReceiptContext";
import { useReceiptActions } from "./useReceiptActions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CostCenterTreeSelect } from "@/components/fields/CostCenterTreeSelect";
import { ChartAccountTreeSelect } from "@/components/fields/ChartAccountTreeSelect";
import { formatCurrency } from "@/lib/currency";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export function ReceiptFinancial() {
  const {
    paymentMethods,
    isLoadingPaymentMethods,
    paymentMethodCode, setPaymentMethodCode,
    invoiceDueDate, setInvoiceDueDate,
    hasInstallments, setHasInstallments,
    installmentCount, setInstallmentCount,
    installments, setInstallments,
    allocations, setAllocations,
    allocationMode, setAllocationMode,
    costCenters,
    chartAccounts,
    receiptType,
    manualTotal,
    purchaseOrder,
    setActiveTab,
    nfConfirmed,
    showValidationErrors,
  } = useReceipt();

  const { confirmNfMutation } = useReceiptActions();
  const { toast } = useToast();
  const [autoFilledRows, setAutoFilledRows] = useState<Set<number>>(new Set());

  const baseTotalForAllocation = useMemo(() => {
    if (receiptType === "avulso") {
      const val = parseFloat(String(manualTotal || "0").replace(",", "."));
      return isFinite(val) ? val : 0;
    }
    const poTot = Number(purchaseOrder?.totalValue || 0);
    return isFinite(poTot) ? poTot : 0;
  }, [receiptType, manualTotal, purchaseOrder?.totalValue]);

  const allocationsSum = useMemo(() => {
    return (allocations || []).reduce((acc, it) => acc + (parseFloat(String(it.amount || "0").replace(",", ".")) || 0), 0);
  }, [allocations]);

  const allocationsSumOk = useMemo(() => {
    const round2 = (n: number) => Math.round(n * 100) / 100;
    return round2(allocationsSum) === round2(baseTotalForAllocation);
  }, [allocationsSum, baseTotalForAllocation]);

  const allocationsValid = useMemo(() => {
    if (allocations.length === 0) return false;
    return allocations.every(r => r.chartOfAccountsId);
  }, [allocations]);

  const isFiscalValid = (() => {
    if (!hasInstallments) return !!paymentMethodCode && !!invoiceDueDate;
    const total = baseTotalForAllocation;
    const rows = installments || [];
    if (rows.length === 0) return false;
    const sum = rows.reduce((acc, r) => acc + (parseFloat(String(r.amount || "0").replace(",", ".")) || 0), 0);
    const round2 = (n: number) => Math.round(n * 100) / 100;
    const sorted = rows.every((r, i, arr) => i === 0 || new Date(r.dueDate) >= new Date(arr[i - 1].dueDate));
    const allFilled = rows.every(r => !!r.dueDate && (parseFloat(String(r.amount || "0").replace(",", ".")) > 0) && (!!r.method || !!paymentMethodCode));
    return round2(sum) === round2(total) && sorted && allFilled;
  })();

  const handleFillMissingAllocationValues = () => {
    const parseNum = (v: any) => {
      const s = String(v ?? '').trim();
      if (!s) return NaN;
      const n = parseFloat(s.replace(',', '.'));
      return isFinite(n) ? n : NaN;
    };
    const validRows = allocations
      .map((r, i) => ({ r, i }))
      .filter(({ r }) => r.chartOfAccountsId);
    if (validRows.length === 0) {
      toast({ title: "Validação", description: "Nenhuma linha válida para preenchimento automático", variant: "destructive" });
      return;
    }
    const filled = validRows
      .map(({ r, i }) => ({ i, amount: parseNum(r.amount) }))
      .filter(({ amount }) => isFinite(amount) && amount > 0);
    const sumFilled = filled.reduce((acc, it) => acc + it.amount, 0);
    const remaining = Math.max(0, baseTotalForAllocation - sumFilled);
    if (remaining <= 0) {
      toast({ title: "Validação", description: "Nada a preencher: o restante do total é 0", variant: "destructive" });
      return;
    }
    const missing = validRows.filter(({ r }) => {
      const amt = parseNum(r.amount);
      return !(isFinite(amt) && amt > 0);
    });
    if (missing.length === 0) {
      toast({ title: "Validação", description: "Nenhuma linha com valor vazio para preencher", variant: "destructive" });
      return;
    }
    let weights = missing.map(({ r }) => {
      const pct = parseNum(r.percentage);
      if (isFinite(pct) && pct > 0) return pct;
      return 1;
    });
    let weightSum = weights.reduce((a, b) => a + b, 0);
    if (!(isFinite(weightSum) && weightSum > 0)) {
      weights = missing.map(() => 1);
      weightSum = missing.length;
    }
    const updates = new Map<number, { amount: string; percentage: string }>();
    let assigned = 0;
    for (let idx = 0; idx < missing.length; idx++) {
      const isLast = idx === missing.length - 1;
      const portion = isLast ? Math.round((remaining - assigned) * 100) / 100 : Math.round(((remaining * weights[idx]) / weightSum) * 100) / 100;
      assigned += isLast ? 0 : portion;
      const pct = Math.round(((portion / baseTotalForAllocation) * 100) * 100) / 100;
      updates.set(missing[idx].i, { amount: portion.toFixed(2), percentage: pct.toFixed(2) });
    }
    setAllocations(prev => prev.map((r, i) => updates.has(i) ? { ...r, amount: updates.get(i)!.amount, percentage: updates.get(i)!.percentage } : r));
    setAutoFilledRows(new Set(missing.map(m => m.i)));
    toast({ title: "Sucesso", description: `Valores preenchidos automaticamente em ${missing.length} linha(s)` });
    window.setTimeout(() => setAutoFilledRows(new Set()), 2500);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Informações Financeiras</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className={cn(showValidationErrors && !paymentMethodCode && "text-red-500")}>
              Forma de Pagamento <span className="text-red-500">*</span>
            </Label>
            <Select value={paymentMethodCode || undefined} onValueChange={(v) => setPaymentMethodCode(v)}>
              <SelectTrigger className={cn("w-full", showValidationErrors && !paymentMethodCode && "border-red-500")}>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {paymentMethods.length > 0 ? (
                  paymentMethods.map((pm) => (
                    <SelectItem key={pm.code} value={pm.code}>{pm.name}</SelectItem>
                  ))
                ) : (
                  <SelectItem value="none" disabled>Nenhuma forma disponível</SelectItem>
                )}
              </SelectContent>
            </Select>
            {showValidationErrors && !paymentMethodCode && (
              <p className="text-xs text-red-500 mt-1">Selecione uma forma de pagamento</p>
            )}
          </div>
          <div>
            <Label className={cn(showValidationErrors && !invoiceDueDate && "text-red-500")}>
              Data de Vencimento da Fatura <span className="text-red-500">*</span>
            </Label>
            <Input 
              type="date" 
              value={invoiceDueDate} 
              onChange={(e) => setInvoiceDueDate(e.target.value)} 
              className={cn(showValidationErrors && !invoiceDueDate && "border-red-500")}
            />
            {showValidationErrors && !invoiceDueDate && (
              <p className="text-xs text-red-500 mt-1">Informe a data de vencimento</p>
            )}
          </div>
          <div>
            <Label>Parcelamento</Label>
            <Select value={hasInstallments ? "sim" : "nao"} onValueChange={(v) => setHasInstallments(v === "sim")}> 
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="nao">Sem parcelamento</SelectItem>
                <SelectItem value="sim">Parcelado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {hasInstallments && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div>
                <Label>Número de parcelas</Label>
                <Input type="number" min={1} value={installmentCount} onChange={(e) => setInstallmentCount(Math.max(1, Number(e.target.value || 1)))} />
              </div>
              <div className="flex items-end">
                <Button type="button" variant="secondary" onClick={() => {
                  if (!invoiceDueDate) {
                    toast({ title: "Validação", description: "Informe a Data de Vencimento inicial", variant: "destructive" });
                    return;
                  }
                  const total = baseTotalForAllocation;
                  const n = Math.max(1, Number(installmentCount || 1));
                  const per = Math.floor((total * 100) / n) / 100;
                  const vals = Array.from({ length: n }).map((_, i) => (i === n - 1 ? Number((total - per * (n - 1)).toFixed(2)) : per));
                  const base = new Date(invoiceDueDate);
                  const rows = vals.map((amt, i) => {
                    const d = new Date(base);
                    d.setMonth(d.getMonth() + i);
                    const yyyy = d.getFullYear();
                    const mm = String(d.getMonth() + 1).padStart(2, '0');
                    const dd = String(d.getDate()).padStart(2, '0');
                    return { dueDate: `${yyyy}-${mm}-${dd}`, amount: amt.toFixed(2), method: paymentMethodCode || undefined };
                  });
                  setInstallments(rows);
                  toast({ title: "Parcelas geradas", description: `${n} parcela(s) criadas totalizando ${formatCurrency(total)}` });
                }}>Gerar Parcelas</Button>
              </div>
              <div className="md:col-span-2">
                <div className="rounded border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Vencimento</TableHead>
                        <TableHead>Forma</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {installments.map((row, idx) => (
                        <TableRow key={idx}>
                          <TableCell>{idx + 1}</TableCell>
                          <TableCell>
                            <Input value={row.amount} onChange={(e) => setInstallments(prev => prev.map((r, i) => i === idx ? { ...r, amount: e.target.value } : r))} />
                          </TableCell>
                          <TableCell>
                            <Input type="date" value={row.dueDate} onChange={(e) => setInstallments(prev => prev.map((r, i) => i === idx ? { ...r, dueDate: e.target.value } : r))} />
                          </TableCell>
                          <TableCell>
                            <Select value={row.method || paymentMethodCode || undefined} onValueChange={(v) => setInstallments(prev => prev.map((r, i) => i === idx ? { ...r, method: v } : r))} disabled={isLoadingPaymentMethods}>
                              <SelectTrigger className="w-full"><SelectValue placeholder={isLoadingPaymentMethods ? "Carregando..." : ""} /></SelectTrigger>
                              <SelectContent>
                                {paymentMethods.length > 0 ? (
                                  paymentMethods.map((pm) => (
                                    <SelectItem key={pm.code} value={pm.code}>{pm.name}</SelectItem>
                                  ))
                                ) : (
                                  <SelectItem value="none" disabled>Nenhuma forma disponível</SelectItem>
                                )}
                              </SelectContent>
                            </Select>
                          </TableCell>
                        </TableRow>
                      ))}
                      {installments.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">Nenhuma parcela</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      <Card className={cn(showValidationErrors && !allocationsValid && "border-red-500")}>
        <CardHeader>
          <CardTitle className={cn(showValidationErrors && !allocationsValid && "text-red-500")}>
            Rateio de Centro de Custo e Plano de Contas <span className="text-red-500">*</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2 items-center">
            <Label>Modo</Label>
            <Select value={allocationMode} onValueChange={(v) => setAllocationMode(v as any)}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Manual</SelectItem>
                <SelectItem value="proporcional">Proporcional</SelectItem>
              </SelectContent>
            </Select>
            <div className="ml-auto text-sm">
              <span className="mr-2">Total do Pedido:</span>
              <Badge variant="outline">{formatCurrency(baseTotalForAllocation)}</Badge>
            </div>
          </div>
          <div className="rounded border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Centro de Custo</TableHead>
                  <TableHead>Plano de Contas</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-right">%</TableHead>
                  <TableHead className="text-center">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allocations.map((row, idx) => (
                  <TableRow key={idx} className={autoFilledRows.has(idx) ? "bg-green-50 dark:bg-green-900/20" : undefined}>
                    <TableCell>
                      <CostCenterTreeSelect options={costCenters} value={row.costCenterId ?? null} onChange={(id) => {
                        setAllocations(prev => prev.map((r, i) => i === idx ? { ...r, costCenterId: id ?? undefined } : r));
                      }} placeholder="Selecione" />
                    </TableCell>
                    <TableCell>
                      <ChartAccountTreeSelect options={chartAccounts} value={row.chartOfAccountsId ?? null} onChange={(id) => {
                        setAllocations(prev => prev.map((r, i) => i === idx ? { ...r, chartOfAccountsId: id ?? undefined } : r));
                      }} placeholder="Selecione" />
                    </TableCell>
                    <TableCell className="text-right">
                      <Input value={row.amount ?? ""} onChange={(e) => {
                        const val = e.target.value;
                        setAllocations(prev => prev.map((r, i) => i === idx ? { ...r, amount: val } : r));
                      }} placeholder="0,00" className={autoFilledRows.has(idx) ? "ring-1 ring-green-500" : undefined} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Input value={row.percentage ?? ""} onChange={(e) => {
                        const val = e.target.value;
                        setAllocations(prev => prev.map((r, i) => i === idx ? { ...r, percentage: val } : r));
                      }} placeholder="%" className={autoFilledRows.has(idx) ? "ring-1 ring-green-500" : undefined} />
                    </TableCell>
                    <TableCell className="text-center">
                      <Button variant="outline" size="sm" onClick={() => {
                        setAllocations(prev => prev.filter((_, i) => i !== idx));
                      }}>Remover</Button>
                    </TableCell>
                  </TableRow>
                ))}
                {allocations.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">Nenhuma linha de rateio adicionada</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={() => {
              setAllocations(prev => [...prev, {}]);
            }}>Adicionar Linha</Button>
            <Button type="button" variant="secondary" onClick={() => {
              if (allocationMode !== "proporcional") return;
              const rows = allocations.filter(a => a.costCenterId && a.chartOfAccountsId);
              if (rows.length === 0) return;
              const per = baseTotalForAllocation / rows.length;
              const pct = 100 / rows.length;
              setAllocations(prev => prev.map(r => {
                if (r.costCenterId && r.chartOfAccountsId) {
                  return { ...r, amount: per.toFixed(2), percentage: pct.toFixed(2) };
                }
                return r;
              }));
            }}>Distribuir Proporcionalmente</Button>
            <Button type="button" variant="secondary" onClick={() => {
              const validRows = allocations.map((r, i) => ({ r, i })).filter(({ r }) => r.costCenterId && r.chartOfAccountsId);
              if (validRows.length === 0) {
                toast({ title: "Validação", description: "Adicione uma linha com Centro de Custo e Plano de Contas selecionados", variant: "destructive" });
                return;
              }
              if (validRows.length > 1) {
                toast({ title: "Validação", description: "Para 'Preencher 100%', mantenha apenas uma linha válida", variant: "destructive" });
                return;
              }
              const idx = validRows[0].i;
              setAllocations(prev => prev.map((r, i) => i === idx ? { ...r, amount: baseTotalForAllocation.toFixed(2), percentage: "100" } : { ...r, amount: undefined, percentage: undefined }));
              setAutoFilledRows(new Set([idx]));
              window.setTimeout(() => setAutoFilledRows(new Set()), 2500);
            }}>Preencher 100%</Button>
            <Button type="button" variant="default" onClick={handleFillMissingAllocationValues} aria-label="Preencher valores vazios do rateio">
              Preencher Valores Vazios
            </Button>
            <div className="ml-auto flex items-center gap-3">
              <Badge variant={allocationsSumOk ? "outline" : "destructive"}>{allocationsSumOk ? "Soma ok" : "Soma diferente do total"}</Badge>
              <div className="text-sm">Soma: {formatCurrency(allocationsSum)} </div>
            </div>
          </div>
          {showValidationErrors && allocations.length === 0 && (
            <p className="text-sm text-red-500 font-medium">Adicione pelo menos um registro de rateio</p>
          )}
          {showValidationErrors && allocations.length > 0 && !allocations.every(r => r.chartOfAccountsId) && (
            <p className="text-sm text-red-500 font-medium">Preencha o Plano de Contas em todas as linhas</p>
          )}
        </CardContent>
      </Card>
      <div className="flex justify-between gap-2">
        <Button variant="outline" onClick={() => setActiveTab('xml')}>Voltar</Button>
      </div>
    </div>
  );
}
