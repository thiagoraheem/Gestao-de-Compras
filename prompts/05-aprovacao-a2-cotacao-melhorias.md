
# Prompt para Agent: Melhorias na Aprovação A2 e Sistema de Cotação

## Objetivo
Implementar melhorias no fluxo de aprovação A2 e sistema de cotação para permitir múltiplas RFQs por solicitação e melhor gestão do histórico.

## Contexto Atual
O sistema possui:
- Aprovação A2 que quando reprovada vai direto para "Arquivado"
- Sistema de cotação que permite apenas uma RFQ por solicitação
- Histórico limitado de RFQs na fase de conclusão

## Alterações Necessárias

### 1. Aprovação A2 - Reprovação com Opções
**Arquivo:** `client/src/components/approval-a2-phase.tsx`

Modificar o componente para:
- Quando reprovar, mostrar duas opções:
  - "Arquivar definitivamente" 
  - "Retornar para nova cotação"
- Adicionar campo de seleção com radio buttons
- Atualizar lógica de submissão para enviar a ação escolhida

**Código a adicionar:**
```typescript
// No schema de validação
rejectionAction: z.enum(['archive', 'recotacao']).optional(),

// Na interface do formulário (após o campo rejectionReason)
{selectedAction === 'reject' && (
  <FormField
    control={form.control}
    name="rejectionAction"
    render={({ field }) => (
      <FormItem>
        <FormLabel>Destino da Solicitação Reprovada</FormLabel>
        <FormControl>
          <RadioGroup
            onValueChange={field.onChange}
            defaultValue={field.value}
            className="flex flex-col space-y-2"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="archive" id="archive" />
              <Label htmlFor="archive">Arquivar definitivamente</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="recotacao" id="recotacao" />
              <Label htmlFor="recotacao">Retornar para nova cotação</Label>
            </div>
          </RadioGroup>
        </FormControl>
        <FormMessage />
      </FormItem>
    )}
  />
)}
```

### 2. Backend - Lógica de Aprovação A2
**Arquivo:** `server/routes.ts`

Modificar o endpoint `POST /api/purchase-requests/:id/approve-a2`:
```typescript
// Já implementado corretamente, apenas verificar se está funcionando:
let newPhase = "pedido_compra";
if (!approved) {
  if (rejectionAction === "recotacao") {
    newPhase = "cotacao"; // Return to quotation phase
  } else {
    newPhase = "arquivado"; // Archive
  }
}
```

### 3. Sistema de Múltiplas RFQs
**Arquivo:** `shared/schema.ts`

Adicionar campos na tabela `quotations`:
```typescript
// Adicionar campos para controle de múltiplas RFQs
isActive: boolean("is_active").default(true),
rfqVersion: integer("rfq_version").default(1),
parentQuotationId: integer("parent_quotation_id").references(() => quotations.id),
```

**Arquivo:** `server/storage.ts`

Adicionar métodos:
```typescript
// Método para desativar RFQs anteriores
async deactivatePreviousRFQs(purchaseRequestId: number): Promise<void> {
  await this.db
    .update(quotations)
    .set({ isActive: false })
    .where(eq(quotations.purchaseRequestId, purchaseRequestId));
}

// Método para obter RFQs ativas
async getActiveQuotationByPurchaseRequestId(purchaseRequestId: number): Promise<Quotation | undefined> {
  const result = await this.db
    .select()
    .from(quotations)
    .where(
      and(
        eq(quotations.purchaseRequestId, purchaseRequestId),
        eq(quotations.isActive, true)
      )
    )
    .limit(1);
  return result[0];
}

// Método para obter histórico de RFQs
async getQuotationHistoryByPurchaseRequestId(purchaseRequestId: number): Promise<Quotation[]> {
  return await this.db
    .select()
    .from(quotations)
    .where(eq(quotations.purchaseRequestId, purchaseRequestId))
    .orderBy(desc(quotations.createdAt));
}
```

### 4. Componente de Cotação - Múltiplas RFQs
**Arquivo:** `client/src/components/quotation-phase.tsx`

Modificar para:
- Mostrar apenas a RFQ ativa
- Adicionar botão "Criar Nova RFQ" se existir RFQ anterior
- Exibir indicador de versão da RFQ

**Código a adicionar:**
```typescript
// No componente QuotationPhase
const { data: quotationHistory = [] } = useQuery<Quotation[]>({
  queryKey: [`/api/quotations/purchase-request/${request.id}/history`],
});

// Na interface, adicionar indicador de versão
{quotation && (
  <div className="flex items-center justify-between mb-4">
    <h3>RFQ Atual - Versão {quotation.rfqVersion}</h3>
    {quotationHistory.length > 1 && (
      <Badge variant="outline">
        {quotationHistory.length} RFQs criadas
      </Badge>
    )}
  </div>
)}
```

### 5. Endpoints para Múltiplas RFQs
**Arquivo:** `server/routes.ts`

Adicionar endpoints:
```typescript
// Histórico de RFQs
app.get("/api/quotations/purchase-request/:id/history", isAuthenticated, async (req, res) => {
  try {
    const purchaseRequestId = parseInt(req.params.id);
    const history = await storage.getQuotationHistoryByPurchaseRequestId(purchaseRequestId);
    res.json(history);
  } catch (error) {
    console.error("Error fetching quotation history:", error);
    res.status(500).json({ message: "Failed to fetch quotation history" });
  }
});

// Modificar criação de RFQ para versioning
app.post("/api/quotations", isAuthenticated, async (req, res) => {
  try {
    const quotationData = quotationApiSchema.parse(req.body);
    
    // Desativar RFQs anteriores
    await storage.deactivatePreviousRFQs(quotationData.purchaseRequestId);
    
    // Buscar última versão
    const history = await storage.getQuotationHistoryByPurchaseRequestId(quotationData.purchaseRequestId);
    const nextVersion = history.length > 0 ? Math.max(...history.map(h => h.rfqVersion || 1)) + 1 : 1;
    
    const quotation = await storage.createQuotation({
      ...quotationData,
      createdBy: req.session.userId!,
      rfqVersion: nextVersion,
      isActive: true
    });
    
    res.status(201).json(quotation);
  } catch (error) {
    console.error("Error creating quotation:", error);
    res.status(400).json({ message: "Invalid quotation data" });
  }
});
```

### 6. Fase de Conclusão - Histórico de RFQs
**Arquivo:** `client/src/components/conclusion-phase.tsx`

Adicionar seção de histórico:
```typescript
// Adicionar query para histórico
const { data: quotationHistory = [] } = useQuery<any[]>({
  queryKey: [`/api/quotations/purchase-request/${request.id}/history`],
});

// Na interface, adicionar seção de histórico
{quotationHistory.length > 0 && (
  <Card>
    <CardHeader>
      <CardTitle>Histórico de RFQs</CardTitle>
    </CardHeader>
    <CardContent>
      <div className="space-y-4">
        {quotationHistory.map((rfq, index) => (
          <div key={rfq.id} className="border rounded p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h4 className="font-semibold">{rfq.quotationNumber}</h4>
                <p className="text-sm text-gray-600">
                  Versão {rfq.rfqVersion} - {rfq.isActive ? 'Ativa' : 'Inativa'}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm">
                  Criada em: {format(new Date(rfq.createdAt), 'dd/MM/yyyy HH:mm')}
                </p>
                <Badge variant={rfq.isActive ? 'default' : 'secondary'}>
                  {rfq.status}
                </Badge>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedRFQForView(rfq)}
            >
              Ver Detalhes
            </Button>
          </div>
        ))}
      </div>
    </CardContent>
  </Card>
)}
```

### 7. Modal de Visualização de RFQ
**Arquivo:** `client/src/components/rfq-detail-modal.tsx` (novo arquivo)

Criar componente para exibir RFQ completa:
```typescript
interface RFQDetailModalProps {
  rfq: any;
  onClose: () => void;
}

export default function RFQDetailModal({ rfq, onClose }: RFQDetailModalProps) {
  // Implementar visualização completa da RFQ
  // Incluir: itens, fornecedores, prazos, termos e condições
  // Modo somente leitura
}
```

## Testes Necessários

1. **Teste de Aprovação A2:**
   - Reprovar com opção "Arquivar" → deve ir para "Arquivado"
   - Reprovar com opção "Nova cotação" → deve ir para "Cotação"

2. **Teste de Múltiplas RFQs:**
   - Criar RFQ inicial
   - Retornar para cotação e criar nova RFQ
   - Verificar se apenas uma RFQ fica ativa
   - Verificar histórico na conclusão

3. **Teste de Histórico:**
   - Verificar listagem de RFQs na conclusão
   - Testar visualização detalhada de RFQ antiga

## Ordem de Implementação

1. Primeiro: Modificar esquema do banco (migrations)
2. Segundo: Atualizar storage.ts com novos métodos
3. Terceiro: Modificar approval-a2-phase.tsx
4. Quarto: Atualizar quotation-phase.tsx
5. Quinto: Modificar routes.ts
6. Sexto: Atualizar conclusion-phase.tsx
7. Sétimo: Criar componente de visualização de RFQ

## Considerações Importantes

- Manter compatibilidade com RFQs existentes
- Garantir que apenas uma RFQ por solicitação fique ativa
- Preservar histórico completo para auditoria
- Interface intuitiva para usuários finais
- Validações adequadas em todas as etapas

Este prompt deve ser usado pelo Agent para implementar as melhorias solicitadas no sistema de aprovação A2 e cotação.
