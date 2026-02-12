import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

const schema = z.object({
  // Campos do formulário
  receiptType: z.enum(["produto", "servico", "avulso"]),
  documentNumber: z.string().optional(),
  documentSeries: z.string().optional(),
  issueDate: z.string().optional(),
  entryDate: z.string().optional(),
  supplierId: z.number().optional(),
  costCenterId: z.number().optional(),
  chartOfAccountsId: z.number().optional(),
  totalAmount: z.union([z.string(), z.number()]).optional(),
  // Campos mínimos exigidos pelo backend/modelo
  purchaseOrderId: z.number().optional(),
  status: z.string().optional(),
  receivedBy: z.number().optional(),
  receivedAt: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export default function ReceiptFormPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [mode, setMode] = useState<"produto" | "servico" | "avulso">("produto");
  const [uploading, setUploading] = useState(false);
  const [xmlPreview, setXmlPreview] = useState<any | null>(null);
  const [costCenters, setCostCenters] = useState<any[]>([]);
  const [chartAccounts, setChartAccounts] = useState<any[]>([]);
  const [xmlRaw, setXmlRaw] = useState<string>("");
  const [showNFModal, setShowNFModal] = useState(false);
  const [po, setPo] = useState<any | null>(null);
  const [poItems, setPoItems] = useState<any[]>([]);
  const [typeCategoryError, setTypeCategoryError] = useState<string>("");
  const [itemDecisions, setItemDecisions] = useState<Record<string, { confirmed: boolean; reason?: string }>>({});

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { receiptType: "produto" },
  });

  useEffect(() => {
    fetch("/api/integration/locador/combos/centros-custo").then(r => r.json()).then(setCostCenters).catch(() => setCostCenters([]));
    fetch("/api/integration/locador/combos/planos-conta").then(r => r.json()).then(setChartAccounts).catch(() => setChartAccounts([]));
  }, []);

  useEffect(() => {
    setMode(watch("receiptType") || "produto");
  }, [watch("receiptType")]);

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const poId = sp.get("poId");
    if (poId) setValue("purchaseOrderId", Number(poId));
    setValue("status", "rascunho");
    if (user?.id) setValue("receivedBy", Number(user.id));
    // Define data/hora atual como recebimento
    const nowIsoLocal = new Date().toISOString().slice(0,16);
    setValue("receivedAt", nowIsoLocal);
    // Buscar dados do pedido e itens para comparação
    if (poId) {
      fetch(`/api/purchase-orders/${poId}`).then(r => r.json()).then(setPo).catch(() => setPo(null));
      fetch(`/api/purchase-orders/${poId}/items`).then(r => r.json()).then(setPoItems).catch(() => setPoItems([]));
      // Validar mapeamento Tipo ↔ Categoria
      fetch(`/api/purchase-orders/${poId}`).then(r => r.json()).then((p) => {
        const category = p?.category || p?.purchaseRequest?.category;
        const map: Record<string, string> = { Produto: "produto", Serviço: "servico", Outros: "avulso" };
        const expected = map[category] || undefined;
        const current = mode;
        if (expected && current && expected !== current) {
          setTypeCategoryError(`Tipo selecionado (${current}) incompatível com a Categoria de Compra (${category}). Ajuste o Tipo para '${expected}'.`);
        } else {
          setTypeCategoryError("");
        }
      }).catch(() => setTypeCategoryError(""));
    }
  }, [user, setValue]);

  const onSubmit = async (data: FormData) => {
    try {
      const res = await fetch("/api/recebimentos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Erro ao salvar rascunho");
      toast({ title: "Salvo", description: "Rascunho salvo com sucesso" });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  const onUploadXml = async (file: File | null) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".xml")) {
      toast({ title: "Erro", description: "Selecione um arquivo .xml", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const raw = await file.text();
      setXmlRaw(raw);
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/recebimentos/import-xml", { method: "POST", body: fd });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Falha na importação");
      }
      const data = await res.json();
      const preview = data.preview || data;
      setXmlPreview(preview);
      setValue("documentNumber", preview?.header?.documentNumber || "");
      setValue("documentSeries", preview?.header?.documentSeries || "");
      setValue("totalAmount", preview?.totals?.vNF || preview?.totals?.vProd || "");
      toast({ title: "XML importado", description: "Dados preenchidos a partir do XML" });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const totals = useMemo(() => {
    if (!xmlPreview?.items) return { icms: 0, ipi: 0, pis: 0, cofins: 0 };
    return (xmlPreview.items as any[]).reduce((acc, it: any) => {
      acc.icms += Number(it.taxes?.icmsAmount || 0);
      acc.ipi += Number(it.taxes?.ipiAmount || 0);
      acc.pis += Number(it.taxes?.pisAmount || 0);
      acc.cofins += Number(it.taxes?.cofinsAmount || 0);
      return acc;
    }, { icms: 0, ipi: 0, pis: 0, cofins: 0 });
  }, [xmlPreview]);

  const compareStatus = (poItem: any, nfItem: any) => {
    const sameDesc = poItem?.description && nfItem?.description && poItem.description.trim().toLowerCase() === nfItem.description.trim().toLowerCase();
    const qtyPo = Number(poItem?.quantity || poItem?.requestedQuantity || 0);
    const qtyNf = Number(nfItem?.quantity || 0);
    const unitPricePo = Number(poItem?.unitPrice || 0);
    const unitPriceNf = Number(nfItem?.unitPrice || 0);
    if (!sameDesc) return "orange";
    if (qtyPo !== qtyNf) return "yellow";
    if (unitPricePo !== unitPriceNf) return "red";
    return "ok";
  };

  const poLookup = useMemo(() => {
    const map = new Map<string, any>();
    poItems.forEach((it: any) => {
      const key = (it.description || it.itemCode || String(it.id)).trim().toLowerCase();
      map.set(key, it);
    });
    return map;
  }, [poItems]);

  const nfItemsDecorated = useMemo(() => {
    const list = Array.isArray(xmlPreview?.items) ? xmlPreview.items : [];
    return list.map((nf: any, idx: number) => {
      const key = (nf.description || nf.itemCode || String(nf.lineNumber || idx)).trim().toLowerCase();
      const poItem = poLookup.get(key);
      const status = compareStatus(poItem, nf);
      return { nf, poItem, status };
    });
  }, [xmlPreview, poLookup]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Tipo de Recebimento</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label>Tipo</Label>
            <Select value={mode} onValueChange={(v) => setValue("receiptType", v as any)}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="produto">Produto (NF-e XML)</SelectItem>
                <SelectItem value="servico">Serviço (Manual)</SelectItem>
                <SelectItem value="avulso">Avulso (sem NF)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Dados da Nota / Documento</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Número</Label>
            <Input {...register("documentNumber")} readOnly={mode === "produto" && !!xmlPreview} />
          </div>
          <div>
            <Label>Série</Label>
            <Input {...register("documentSeries")} readOnly={mode === "produto" && !!xmlPreview} />
          </div>
          <div>
            <Label>Data de Emissão</Label>
            <Input type="datetime-local" {...register("issueDate")} />
          </div>
          <div>
            <Label>Data de Entrada</Label>
            <Input type="datetime-local" {...register("entryDate")} />
          </div>
        </CardContent>
      </Card>

      {mode === "produto" && (
        <Card>
          <CardHeader>
            <CardTitle>Importação de XML</CardTitle>
          </CardHeader>
          <CardContent>
            <Input type="file" accept=".xml" disabled={uploading} onChange={(e) => onUploadXml(e.target.files?.[0] || null)} />
            {xmlPreview && (
              <div className="mt-4 text-sm">
                <div>Total: {xmlPreview?.totals?.vNF || xmlPreview?.totals?.vProd}</div>
                <div>Itens: {Array.isArray(xmlPreview?.items) ? xmlPreview.items.length : 0}</div>
                <div className="mt-2 flex gap-2">
                  <Button type="button" variant="outline" onClick={() => setShowNFModal(true)}>Abrir modal de Recebimento</Button>
                  <Button type="button" variant="secondary" onClick={() => {
                    if (!xmlRaw) return toast({ title: "XML", description: "Faça upload de um XML para visualizar", variant: "destructive" });
                    setShowNFModal(true);
                  }}>Visualizar XML</Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Centro de Custo e Plano de Contas</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Centro de Custo</Label>
            <Select onValueChange={(v) => setValue("costCenterId", Number(v))}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {costCenters.map((cc) => (<SelectItem key={cc.id} value={String(cc.id)}>{cc.code} - {cc.name}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Plano de Contas</Label>
            <Select onValueChange={(v) => setValue("chartOfAccountsId", Number(v))}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {chartAccounts.map((pc) => (<SelectItem key={pc.id} value={String(pc.id)}>{pc.code} - {pc.description}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={handleSubmit(onSubmit)}>Salvar Rascunho</Button>
      </div>

      <Dialog open={showNFModal} onOpenChange={setShowNFModal}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto" aria-describedby="nf-receipt-desc">
          <div className="flex items-center justify-between">
            <DialogTitle>Recebimento de Nota Fiscal</DialogTitle>
            <DialogClose asChild>
              <button aria-label="Fechar" className="p-2 rounded">✕</button>
            </DialogClose>
          </div>
          <p id="nf-receipt-desc" className="sr-only">Modal dedicado para conferência de NF-e</p>

          <Card>
            <CardHeader><CardTitle>Fornecedor</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Razão Social</Label>
                <p className="mt-1">{po?.supplierName || po?.supplier?.name || "N/A"}</p>
              </div>
              <div>
                <Label>CNPJ</Label>
                <p className="mt-1">{po?.supplierCnpj || po?.supplier?.cnpj || "N/A"}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Dados da Nota Fiscal</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><Label>Número</Label><p className="mt-1">{watch("documentNumber") || xmlPreview?.header?.documentNumber || ""}</p></div>
              <div><Label>Série</Label><p className="mt-1">{watch("documentSeries") || xmlPreview?.header?.documentSeries || ""}</p></div>
              <div><Label>Data de Emissão</Label><p className="mt-1">{watch("issueDate") || xmlPreview?.header?.issueDate || ""}</p></div>
              <div><Label>Data de Entrada</Label><p className="mt-1">{watch("entryDate") || xmlPreview?.header?.entryDate || ""}</p></div>
              <div className="md:col-span-2"><Label>Valor Total</Label><p className="mt-1">{watch("totalAmount") || xmlPreview?.totals?.vNF || xmlPreview?.totals?.vProd || ""}</p></div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Tributos Destacados</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div><Label>ICMS</Label><p className="mt-1">{totals.icms.toFixed(2)}</p></div>
              <div><Label>IPI</Label><p className="mt-1">{totals.ipi.toFixed(2)}</p></div>
              <div><Label>PIS</Label><p className="mt-1">{totals.pis.toFixed(2)}</p></div>
              <div><Label>COFINS</Label><p className="mt-1">{totals.cofins.toFixed(2)}</p></div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Transporte</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm">{xmlPreview?.header?.transport?.modFrete ? `Modalidade: ${xmlPreview.header.transport.modFrete}` : "Não informado"}</p>
            </CardContent>
          </Card>

          <Separator />

          <Card>
            <CardHeader><CardTitle>Itens da Nota Fiscal</CardTitle></CardHeader>
            <CardContent>
              <div className="rounded border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead className="text-center">Qtd</TableHead>
                      <TableHead className="text-right">Valor Unit.</TableHead>
                      <TableHead className="text-right">Valor Total</TableHead>
                      <TableHead className="text-center">Unidade</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead className="text-center">Ação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {nfItemsDecorated.map(({ nf, poItem, status }: any, idx: number) => (
                      <TableRow key={idx} className={
                        status === "red" ? "bg-red-50 dark:bg-red-900/20" :
                        status === "yellow" ? "bg-yellow-50 dark:bg-yellow-900/20" :
                        status === "orange" ? "bg-orange-50 dark:bg-orange-900/20" : ""
                      }>
                        <TableCell>{nf.itemCode || poItem?.itemCode || "-"}</TableCell>
                        <TableCell>{nf.description}</TableCell>
                        <TableCell className="text-center">{nf.quantity}</TableCell>
                        <TableCell className="text-right">{nf.unitPrice}</TableCell>
                        <TableCell className="text-right">{nf.totalPrice}</TableCell>
                        <TableCell className="text-center">{nf.unit}</TableCell>
                        <TableCell className="text-center">
                          {status === "ok" && <Badge variant="outline">OK</Badge>}
                          {status === "red" && <Badge variant="destructive">Divergência</Badge>}
                          {status === "yellow" && <Badge variant="secondary">Qtd diferente</Badge>}
                          {status === "orange" && <Badge variant="default">Não previsto</Badge>}
                        </TableCell>
                        <TableCell className="text-center">
                          <label className="inline-flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={itemDecisions[idx]?.confirmed || false}
                              onChange={(e) => setItemDecisions((prev) => ({ ...prev, [idx]: { confirmed: e.target.checked } }))}
                            /> Confirmar
                          </label>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowNFModal(false)}>Cancelar</Button>
            <Button onClick={() => {
              if (typeCategoryError) {
                return toast({ title: "Validação", description: typeCategoryError, variant: "destructive" });
              }
              setShowNFModal(false);
              toast({ title: "Conferência", description: "Itens conferidos. Você pode salvar o rascunho." });
            }}>Confirmar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
