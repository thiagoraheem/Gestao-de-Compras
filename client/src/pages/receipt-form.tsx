import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

const schema = z.object({
  receiptType: z.enum(["produto", "servico", "avulso"]),
  documentNumber: z.string().optional(),
  documentSeries: z.string().optional(),
  issueDate: z.string().optional(),
  entryDate: z.string().optional(),
  supplierId: z.number().optional(),
  costCenterId: z.number().optional(),
  chartOfAccountsId: z.number().optional(),
  totalAmount: z.union([z.string(), z.number()]).optional(),
});

type FormData = z.infer<typeof schema>;

export default function ReceiptFormPage() {
  const { toast } = useToast();
  const [mode, setMode] = useState<"produto" | "servico" | "avulso">("produto");
  const [uploading, setUploading] = useState(false);
  const [xmlPreview, setXmlPreview] = useState<any | null>(null);
  const [costCenters, setCostCenters] = useState<any[]>([]);
  const [chartAccounts, setChartAccounts] = useState<any[]>([]);

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { receiptType: "produto" },
  });

  useEffect(() => {
    fetch("/api/centros-custo").then(r => r.json()).then(setCostCenters).catch(() => setCostCenters([]));
    fetch("/api/plano-contas").then(r => r.json()).then(setChartAccounts).catch(() => setChartAccounts([]));
  }, []);

  useEffect(() => {
    setMode(watch("receiptType") || "produto");
  }, [watch("receiptType")]);

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
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/recebimentos/import-xml", { method: "POST", body: fd });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Falha na importação");
      }
      const data = await res.json();
      setXmlPreview(data);
      setValue("documentNumber", data.receipt.documentNumber);
      setValue("documentSeries", data.receipt.documentSeries);
      setValue("totalAmount", data.totals?.vNF || data.totals?.vProd);
      toast({ title: "XML importado", description: "Dados preenchidos a partir do XML" });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

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
    </div>
  );
}

