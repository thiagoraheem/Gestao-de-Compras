
# Prompt: Implementar Restrição de Aprovação A1 por Centro de Custo

## Objetivo
Implementar uma restrição no fluxo de aprovação A1 onde aprovadores só podem aprovar solicitações de compra dos centros de custo aos quais estão associados.

## Contexto Atual
- Sistema possui tabela `user_cost_centers` que associa usuários a centros de custo
- Aprovadores A1 podem atualmente aprovar qualquer solicitação na fase `aprovacao_a1`
- Existe endpoint `/api/users/:id/cost-centers` que retorna centros de custo do usuário
- Componente `ApprovalA1Phase` gerencia interface de aprovação

## Alterações Necessárias

### 1. Backend - Middleware de Validação

**Arquivo: `server/routes.ts`**

Criar middleware `canApproveRequest` para validar se o aprovador pode aprovar a solicitação:

```typescript
// Middleware para validar se o aprovador pode aprovar a solicitação
async function canApproveRequest(req: Request, res: Response, next: Function) {
  try {
    const requestId = parseInt(req.params.id);
    const userId = req.session.userId;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Buscar a solicitação
    const request = await storage.getPurchaseRequestById(requestId);
    if (!request) {
      return res.status(404).json({ message: "Purchase request not found" });
    }

    // Buscar centros de custo do usuário
    const userCostCenters = await storage.getUserCostCenters(userId);
    
    // Verificar se o centro de custo da solicitação está na lista do usuário
    if (!userCostCenters.includes(request.costCenterId)) {
      return res.status(403).json({ 
        message: "Você não possui permissão para aprovar solicitações deste centro de custo" 
      });
    }

    next();
  } catch (error) {
    console.error("Error checking approval permissions:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}
```

Aplicar middleware na rota de aprovação A1:
```typescript
app.post("/api/purchase-requests/:id/approve-a1", isAuthenticated, canApproveRequest, async (req, res) => {
  // Código existente da aprovação A1
});
```

### 2. Backend - Endpoint de Validação

**Arquivo: `server/routes.ts`**

Criar endpoint para validar se usuário pode aprovar uma solicitação específica:

```typescript
app.get("/api/purchase-requests/:id/can-approve-a1", isAuthenticated, async (req, res) => {
  try {
    const requestId = parseInt(req.params.id);
    const userId = req.session.userId;

    const request = await storage.getPurchaseRequestById(requestId);
    if (!request) {
      return res.status(404).json({ message: "Purchase request not found" });
    }

    const userCostCenters = await storage.getUserCostCenters(userId);
    const canApprove = userCostCenters.includes(request.costCenterId);

    res.json({ 
      canApprove,
      requestCostCenter: request.costCenter,
      userCostCenters: userCostCenters
    });
  } catch (error) {
    console.error("Error checking approval permissions:", error);
    res.status(500).json({ message: "Failed to check approval permissions" });
  }
});
```

### 3. Frontend - Componente ApprovalA1Phase

**Arquivo: `client/src/components/approval-a1-phase.tsx`**

Adicionar validação de permissão:

```typescript
// Adicionar query para verificar permissão
const { data: approvalPermission } = useQuery<{canApprove: boolean, requestCostCenter: any, userCostCenters: number[]}>({
  queryKey: [`/api/purchase-requests/${request.id}/can-approve-a1`],
  enabled: !!user?.isApproverA1,
});

// Modificar condição de permissão
const canApprove = user?.isApproverA1 && approvalPermission?.canApprove;

// Adicionar alerta quando não pode aprovar
{user?.isApproverA1 && !approvalPermission?.canApprove && (
  <Alert className="border-amber-200 bg-amber-50">
    <AlertTriangle className="h-4 w-4 text-amber-600" />
    <AlertDescription className="text-amber-700">
      <strong>Acesso Restrito:</strong> Você não possui permissão para aprovar solicitações do centro de custo "{request.costCenter?.name}". 
      Sua aprovação está limitada aos seguintes centros de custo: {approvalPermission?.userCostCenters?.map(id => 
        // Buscar nome do centro de custo pelo ID
      ).join(', ')}.
    </AlertDescription>
  </Alert>
)}
```

### 4. Frontend - Componente KanbanBoard

**Arquivo: `client/src/components/kanban-board.tsx`**

Filtrar solicitações na fase Aprovação A1 baseado nos centros de custo do usuário:

```typescript
// Adicionar query para centros de custo do usuário
const { data: userCostCenters } = useQuery<number[]>({
  queryKey: [`/api/users/${user?.id}/cost-centers`],
  enabled: !!user?.id && user?.isApproverA1,
});

// Filtrar solicitações na fase aprovacao_a1
const filteredRequests = useMemo(() => {
  if (!allRequests) return {};
  
  const grouped = groupRequestsByPhase(allRequests);
  
  // Se usuário é aprovador A1, filtrar apenas solicitações dos seus centros de custo
  if (user?.isApproverA1 && userCostCenters && grouped.aprovacao_a1) {
    grouped.aprovacao_a1 = grouped.aprovacao_a1.filter(request => 
      userCostCenters.includes(request.costCenterId)
    );
  }
  
  return grouped;
}, [allRequests, user, userCostCenters]);
```

### 5. Backend - Notificações por E-mail

**Arquivo: `server/email-service.ts`**

Modificar função `notifyApprovalA1` para enviar notificações apenas para aprovadores dos centros de custo corretos:

```typescript
export async function notifyApprovalA1(purchaseRequest: PurchaseRequest): Promise<void> {
  try {
    const approvers = await storage.getAllUsers();
    let approverA1Users = approvers.filter((user) => user.isApproverA1);

    // Filtrar aprovadores pelos centros de custo
    if (purchaseRequest.costCenterId) {
      const relevantApprovers = [];
      
      for (const approver of approverA1Users) {
        const userCostCenters = await storage.getUserCostCenters(approver.id);
        if (userCostCenters.includes(purchaseRequest.costCenterId)) {
          relevantApprovers.push(approver);
        }
      }
      
      approverA1Users = relevantApprovers;
    }

    if (approverA1Users.length === 0) {
      console.log("Nenhum aprovador A1 encontrado para o centro de custo da solicitação");
      return;
    }

    // Resto do código de envio de e-mail permanece igual
  } catch (error) {
    console.error("Erro ao notificar aprovação A1:", error);
  }
}
```

### 6. Frontend - Dashboard e Relatórios

**Arquivo: `client/src/pages/dashboard.tsx`**

Adicionar métricas específicas por centro de custo para aprovadores A1:

```typescript
// Para aprovadores A1, mostrar apenas dados dos seus centros de custo
const filteredData = useMemo(() => {
  if (!user?.isApproverA1 || !userCostCenters || user?.isAdmin) {
    return dashboardData; // Admin e não-aprovadores veem tudo
  }
  
  // Filtrar dados pelos centros de custo do aprovador
  return {
    ...dashboardData,
    requestsByDepartment: dashboardData?.requestsByDepartment?.filter(item => {
      // Lógica para filtrar por centro de custo
    }),
    // Outros filtros conforme necessário
  };
}, [dashboardData, user, userCostCenters]);
```

### 7. Testes e Validações

**Arquivo: `server/__tests__/approval-permissions.test.ts`** (novo arquivo)

```typescript
describe('Approval A1 Permissions', () => {
  test('should allow approval for associated cost center', async () => {
    // Teste de aprovação permitida
  });
  
  test('should deny approval for non-associated cost center', async () => {
    // Teste de aprovação negada
  });
  
  test('should filter requests correctly in kanban view', async () => {
    // Teste de filtragem no kanban
  });
});
```

## Impactos e Considerações

### Impactos Positivos
- Maior controle e segregação de responsabilidades
- Redução de erros de aprovação em centros de custo incorretos
- Melhor auditoria e rastreabilidade
- Interface mais limpa para aprovadores (veem apenas o que podem aprovar)

### Impactos na Experiência do Usuário
- Aprovadores A1 verão menos solicitações no kanban
- Mensagens claras sobre restrições de acesso
- Dashboard personalizado por centro de custo

### Considerações Técnicas
- Necessário garantir que todos os usuários A1 tenham centros de custo associados
- Implementar migração de dados se necessário
- Adicionar logs para auditoria de tentativas de aprovação negadas
- Considerar cache para performance em consultas frequentes

### Pontos de Atenção
- Admin deve continuar vendo/aprovando tudo
- Usuários sem centros de custo associados não devem conseguir aprovar nada
- Notificações por e-mail devem ser direcionadas corretamente
- Interface deve ser clara sobre as restrições

## Ordem de Implementação

1. Backend: Middleware de validação e endpoint de verificação
2. Backend: Modificação nas notificações por e-mail
3. Frontend: Atualização do componente ApprovalA1Phase
4. Frontend: Filtragem no KanbanBoard
5. Frontend: Ajustes no dashboard
6. Testes e validação completa
7. Documentação e treinamento dos usuários

## Validação Final

Após implementação, validar:
- Aprovador A1 só vê solicitações dos seus centros de custo
- Tentativas de aprovação de outros centros são bloqueadas
- Notificações chegam apenas para aprovadores corretos
- Dashboard mostra dados filtrados corretamente
- Admins continuam com acesso total
- Logs de auditoria funcionando
