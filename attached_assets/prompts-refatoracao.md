# Prompts para Refatoração do Sistema de Solicitação de Compras

## 1. Atualização do Modelo de Dados

```typescript
// Adicionar novo modelo para os itens da solicitação de compra
export const purchaseRequestItems = pgTable(
  "purchase_request_items",
  {
    id: serial("id").primaryKey(),
    purchaseRequestId: integer("purchase_request_id")
      .references(() => purchaseRequests.id, { onDelete: "cascade" })
      .notNull(),
    itemNumber: text("item_number").notNull(),
    description: text("description").notNull(),
    unit: text("unit").notNull(),
    stockQuantity: numeric("stock_quantity").default("0"),
    averageMonthlyQuantity: numeric("average_monthly_quantity").default("0"),
    requestedQuantity: numeric("requested_quantity").notNull(),
    approvedQuantity: numeric("approved_quantity"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  }
);

// Adicionar tipo para o modelo de itens da solicitação
export type PurchaseRequestItem = typeof purchaseRequestItems.$inferSelect;
export type NewPurchaseRequestItem = typeof purchaseRequestItems.$inferInsert;
```

## 2. Componente para Importação de Excel

```typescript
// Criar componente para importação de dados do Excel
import { useState } from "react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { CloudUpload } from "lucide-react";

interface ExcelImporterProps {
  onDataImported: (data: PurchaseRequestItemData[]) => void;
}

// Definir estrutura de dados para itens importados
export interface PurchaseRequestItemData {
  item: string;
  description: string;
  unit: string;
  stockQuantity: number;
  averageMonthlyQuantity: number;
  requestedQuantity: number;
  approvedQuantity?: number;
}

export function ExcelImporter({ onDataImported }: ExcelImporterProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [fileName, setFileName] = useState("");

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setFileName(file.name);

    try {
      const data = await readExcelFile(file);
      onDataImported(data);
    } catch (error) {
      console.error("Erro ao processar arquivo:", error);
      // Adicionar notificação de erro aqui
    } finally {
      setIsLoading(false);
    }
  };

  const readExcelFile = (file: File): Promise<PurchaseRequestItemData[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: "binary" });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];

          // Converter para JSON
          const jsonData = XLSX.utils.sheet_to_json(worksheet);

          // Mapear os dados para o formato esperado
          const mappedData = jsonData.map((row: any) => ({
            item: row["Item"] || "",
            description: row["Descrição"] || "",
            unit: row["Unid."] || "",
            stockQuantity: Number(row["Quant. Estoque"]) || 0,
            averageMonthlyQuantity: Number(row["Quant. Média/mês"]) || 0,
            requestedQuantity: Number(row["Quant. Requisitada"]) || 0,
            approvedQuantity: row["Quant. Aprovado"] ? Number(row["Quant. Aprovado"]) : undefined
          }));

          resolve(mappedData);
        } catch (error) {
          reject(error);
        }
      };

      reader.onerror = (error) => reject(error);
      reader.readAsBinaryString(file);
    });
  };

  return (
    <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md hover:border-primary transition-colors">
      <div className="space-y-1 text-center">
        <CloudUpload className="mx-auto h-12 w-12 text-gray-400" />
        <div className="flex text-sm text-gray-600">
          <label className="relative cursor-pointer bg-white rounded-md font-medium text-primary hover:text-primary/80">
            <span>{fileName ? "Alterar arquivo" : "Clique para fazer upload"}</span>
            <input 
              type="file" 
              className="sr-only" 
              accept=".xlsx,.xls,.csv"
              onChange={handleFileUpload}
              disabled={isLoading}
            />
          </label>
          {!fileName && <p className="pl-1">ou arraste e solte</p>}
        </div>
        {fileName ? (
          <p className="text-xs text-gray-500">{fileName}</p>
        ) : (
          <p className="text-xs text-gray-500">XLS, XLSX, CSV até 10MB</p>
        )}
        {isLoading && <p className="text-xs text-primary">Processando...</p>}
      </div>
    </div>
  );
}
```

## 3. Componente para Tabela de Itens

```typescript
import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import { PurchaseRequestItemData } from "./excel-importer";

interface ItemsTableProps {
  items: PurchaseRequestItemData[];
  onChange: (items: PurchaseRequestItemData[]) => void;
}

export function ItemsTable({ items, onChange }: ItemsTableProps) {
  const handleAddItem = () => {
    const newItem: PurchaseRequestItemData = {
      item: "",
      description: "",
      unit: "",
      stockQuantity: 0,
      averageMonthlyQuantity: 0,
      requestedQuantity: 0,
    };
    onChange([...items, newItem]);
  };

  const handleRemoveItem = (index: number) => {
    const newItems = [...items];
    newItems.splice(index, 1);
    onChange(newItems);
  };

  const handleItemChange = (index: number, field: keyof PurchaseRequestItemData, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    onChange(newItems);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Itens da Solicitação</h3>
        <Button onClick={handleAddItem} type="button" size="sm">
          <Plus className="h-4 w-4 mr-1" /> Adicionar Item
        </Button>
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[80px]">Item</TableHead>
              <TableHead className="min-w-[200px]">Descrição</TableHead>
              <TableHead className="w-[80px]">Unid.</TableHead>
              <TableHead className="w-[100px]">Estoque</TableHead>
              <TableHead className="w-[100px]">Média/mês</TableHead>
              <TableHead className="w-[100px]">Requisitado</TableHead>
              <TableHead className="w-[80px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-6 text-muted-foreground">
                  Nenhum item adicionado. Importe um arquivo Excel ou adicione itens manualmente.
                </TableCell>
              </TableRow>
            ) : (
              items.map((item, index) => (
                <TableRow key={index}>
                  <TableCell>
                    <Input 
                      value={item.item} 
                      onChange={(e) => handleItemChange(index, "item", e.target.value)}
                      className="w-full"
                    />
                  </TableCell>
                  <TableCell>
                    <Input 
                      value={item.description} 
                      onChange={(e) => handleItemChange(index, "description", e.target.value)}
                      className="w-full"
                    />
                  </TableCell>
                  <TableCell>
                    <Input 
                      value={item.unit} 
                      onChange={(e) => handleItemChange(index, "unit", e.target.value)}
                      className="w-full"
                    />
                  </TableCell>
                  <TableCell>
                    <Input 
                      type="number" 
                      value={item.stockQuantity} 
                      onChange={(e) => handleItemChange(index, "stockQuantity", Number(e.target.value))}
                      className="w-full"
                    />
                  </TableCell>
                  <TableCell>
                    <Input 
                      type="number" 
                      value={item.averageMonthlyQuantity} 
                      onChange={(e) => handleItemChange(index, "averageMonthlyQuantity", Number(e.target.value))}
                      className="w-full"
                    />
                  </TableCell>
                  <TableCell>
                    <Input 
                      type="number" 
                      value={item.requestedQuantity} 
                      onChange={(e) => handleItemChange(index, "requestedQuantity", Number(e.target.value))}
                      className="w-full"
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveItem(index)}
                      className="text-destructive hover:text-destructive/90"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
```

## 4. Atualização do Modal de Nova Solicitação

```typescript
// Atualizar o schema do Zod para incluir os itens
const requestSchema = z.object({
  costCenterId: z.coerce.number().min(1, "Centro de custo é obrigatório"),
  category: z.string().min(1, "Categoria é obrigatória"),
  urgency: z.string().min(1, "Urgência é obrigatória"),
  justification: z.string().min(10, "Justificativa deve ter pelo menos 10 caracteres"),
  idealDeliveryDate: z.string().optional(),
  availableBudget: z.string().optional(),
  additionalInfo: z.string().optional(),
  items: z.array(
    z.object({
      item: z.string().min(1, "Item é obrigatório"),
      description: z.string().min(1, "Descrição é obrigatória"),
      unit: z.string().min(1, "Unidade é obrigatória"),
      stockQuantity: z.number().min(0),
      averageMonthlyQuantity: z.number().min(0),
      requestedQuantity: z.number().min(1, "Quantidade requisitada deve ser maior que 0"),
      approvedQuantity: z.number().optional(),
    })
  ).min(1, "Adicione pelo menos um item à solicitação"),
});

// Dentro do componente NewRequestModal
const [requestItems, setRequestItems] = useState<PurchaseRequestItemData[]>([]);

// No mutationFn
mutationFn: async (data: RequestFormData) => {
  const requestData = {
    ...data,
    requesterId: 1, // TODO: Get from auth context
    costCenterId: Number(data.costCenterId),
    availableBudget: data.availableBudget ? parseFloat(data.availableBudget) : undefined,
    idealDeliveryDate: data.idealDeliveryDate || undefined,
    items: requestItems,
  };
  await apiRequest("POST", "/api/purchase-requests", requestData);
},

// Adicionar na parte do formulário
<div>
  <FormLabel>Itens da Solicitação *</FormLabel>
  <div className="mt-2">
    <ExcelImporter onDataImported={setRequestItems} />
  </div>
</div>

<div className="mt-4">
  <ItemsTable items={requestItems} onChange={setRequestItems} />
</div>
```

## 5. Botão de Fechar em Modais (X no topo)

```typescript
// Modificação para adicionar botão de fechar no topo dos modais
import { X } from 'lucide-react';

// Atualizar o componente DialogHeader no arquivo client/src/components/ui/dialog.tsx
export function DialogHeader({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex flex-row items-center justify-between space-y-1.5 text-center sm:text-left",
        className
      )}
      {...props}
    >
      <div>{children}</div>
      <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
        <X className="h-4 w-4" />
        <span className="sr-only">Fechar</span>
      </DialogPrimitive.Close>
    </div>
  );
}

// Ou alternativa: Adicionar o botão diretamente nos modais específicos
<DialogHeader>
  <DialogTitle>Nova Solicitação de Compra</DialogTitle>
  <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
    <X className="h-4 w-4" />
    <span className="sr-only">Fechar</span>
  </DialogPrimitive.Close>
</DialogHeader>
```

## 6. Atualização da API no Backend

```typescript
// Adicionar rota para processar a solicitação com itens
app.post('/api/purchase-requests', async (req, res) => {
  try {
    // Iniciar transação
    const result = await db.transaction(async (tx) => {
      // Inserir a solicitação principal
      const [purchaseRequest] = await tx
        .insert(purchaseRequests)
        .values({
          requesterId: req.body.requesterId,
          costCenterId: req.body.costCenterId,
          category: req.body.category,
          urgency: req.body.urgency,
          justification: req.body.justification,
          idealDeliveryDate: req.body.idealDeliveryDate,
          availableBudget: req.body.availableBudget,
          additionalInfo: req.body.additionalInfo,
          phase: PURCHASE_PHASES.SOLICITACAO,
        })
        .returning();

      // Inserir os itens da solicitação
      if (req.body.items && req.body.items.length > 0) {
        await tx
          .insert(purchaseRequestItems)
          .values(
            req.body.items.map((item: any) => ({
              purchaseRequestId: purchaseRequest.id,
              itemNumber: item.item,
              description: item.description,
              unit: item.unit,
              stockQuantity: item.stockQuantity,
              averageMonthlyQuantity: item.averageMonthlyQuantity,
              requestedQuantity: item.requestedQuantity,
              approvedQuantity: item.approvedQuantity,
            }))
          );
      }

      return purchaseRequest;
    });

    res.status(201).json(result);
  } catch (error) {
    console.error('Erro ao criar solicitação:', error);
    res.status(500).json({ error: 'Falha ao criar solicitação' });
  }
});
```

## 7. Instalação de Dependências Adicionais

```bash
npm install xlsx @tanstack/react-table file-saver
```

## 8. Exibição de Itens na Visualização da Solicitação

```typescript
// Componente para visualizar os itens de uma solicitação
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

interface RequestItemsViewProps {
  items: PurchaseRequestItem[];
  requestId: number;
}

export function RequestItemsView({ items, requestId }: RequestItemsViewProps) {
  const handleExportExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(
      items.map(item => ({
        "Item": item.itemNumber,
        "Descrição": item.description,
        "Unid.": item.unit,
        "Quant. Estoque": item.stockQuantity,
        "Quant. Média/mês": item.averageMonthlyQuantity,
        "Quant. Requisitada": item.requestedQuantity,
        "Quant. Aprovado": item.approvedQuantity || ""
      }))
    );

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Itens");

    // Gerar arquivo e fazer download
    const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    const data = new Blob([excelBuffer], { type: "application/octet-stream" });
    saveAs(data, `solicitacao-${requestId}-itens.xlsx`);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Itens da Solicitação</h3>

        <Button 
          onClick={handleExportExcel} 
          variant="outline" 
          size="sm"
        >
          <Download className="h-4 w-4 mr-1" /> Exportar Excel
        </Button>
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[80px]">Item</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead className="w-[80px]">Unid.</TableHead>
              <TableHead className="w-[100px]">Estoque</TableHead>
              <TableHead className="w-[100px]">Média/mês</TableHead>
              <TableHead className="w-[100px]">Requisitado</TableHead>
              <TableHead className="w-[100px]">Aprovado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-6 text-muted-foreground">
                  Esta solicitação não possui itens registrados.
                </TableCell>
              </TableRow>
            ) : (
              items.map((item, index) => (
                <TableRow key={index}>
                  <TableCell>{item.itemNumber}</TableCell>
                  <TableCell>{item.description}</TableCell>
                  <TableCell>{item.unit}</TableCell>
                  <TableCell>{item.stockQuantity}</TableCell>
                  <TableCell>{item.averageMonthlyQuantity}</TableCell>
                  <TableCell>{item.requestedQuantity}</TableCell>
                  <TableCell>{item.approvedQuantity || "-"}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
```

## 9. Prompt para Garantir que Todos os Modais Tenham Botão de Fechar

Para garantir que todos os modais da aplicação tenham um botão de fechar (X) no topo, siga estas instruções:

1. Modifique o componente de Dialog base usado em toda a aplicação
2. Adicione um botão de fechar consistente em todos os modais
3. Garanta que o botão tenha foco acessível e funcionalidade adequada

```typescript
// Atualizar o componente DialogContent em ui/dialog.tsx
import { X } from 'lucide-react';

export function DialogContent(
  {
    className,
    children,
    ...props
  }: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg",
          className
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
          <X className="h-4 w-4" />
          <span className="sr-only">Fechar</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}
```

Com esta modificação, TODOS os modais na aplicação herdarão automaticamente o botão de fechar no canto superior direito, garantindo uma experiência de usuário consistente em toda a aplicação.
