import { db } from '../server/db';
import { purchaseRequests, purchaseRequestItems, users, companies, departments, costCenters } from '../shared/schema';
import { eq } from 'drizzle-orm';

// Importar as dependências e criar uma pequena suite de testes
// Ou simplesmente rodar como script CJS.

async function runTests() {
  console.log("Iniciando testes de integração...");
  
  // Como as rotas requerem autenticação (isAuthenticated),
  // e isso pode ser complexo de mockar num script CJS sem servidor ativo,
  // vamos apenas testar a função de banco de dados e garantir que os 
  // campos são salvos e recuperados corretamente via API.

  // Alternativamente, vamos verificar se o Drizzle ORM consegue inserir e recuperar.
  try {
    // 1. Criar dependências (Company, Dept, Cost Center, User) - Assumindo que o banco de dev tem pelo menos 1 user
    const [user] = await db.select().from(users).limit(1);
    if (!user) {
      console.log("Nenhum usuário encontrado para o teste. Por favor crie um usuário primeiro.");
      return;
    }
    
    // Pegar o primeiro centro de custo
    const [costCenter] = await db.select().from(costCenters).limit(1);

    console.log("1. Criando uma nova Purchase Request");
    const [newRequest] = await db.insert(purchaseRequests).values({
      requestNumber: `TEST-BADGES-${Date.now()}`,
      requesterId: user.id,
      companyId: user.companyId || 1,
      costCenterId: costCenter?.id || 1,
      category: 'produto',
      urgency: 'baixa',
      justification: 'Teste para os badges de Price e Part Number',
      currentPhase: 'solicitacao'
    }).returning();

    console.log(`Purchase Request criada com ID: ${newRequest.id}`);

    console.log("2. Inserindo Itens com Price e Part Number");
    const [newItem] = await db.insert(purchaseRequestItems).values({
      purchaseRequestId: newRequest.id,
      description: "Produto de Teste com Badges",
      unit: "UN",
      requestedQuantity: "1.00",
      price: "150.50",
      partNumber: "PN-BADGE-123"
    }).returning();

    console.log(`Item inserido com sucesso. Price: ${newItem.price}, PartNumber: ${newItem.partNumber}`);

    // Verifica os valores
    if (Number(newItem.price) !== 150.5) {
      throw new Error(`O preço recuperado (${newItem.price}) não corresponde ao inserido (150.5)`);
    }

    if (newItem.partNumber !== "PN-BADGE-123") {
      throw new Error(`O part number recuperado (${newItem.partNumber}) não corresponde ao inserido (PN-BADGE-123)`);
    }

    console.log("✅ Teste de integração de banco de dados concluído com sucesso!");
    
    // Limpeza
    console.log("3. Limpando os dados do teste...");
    await db.delete(purchaseRequestItems).where(eq(purchaseRequestItems.id, newItem.id));
    await db.delete(purchaseRequests).where(eq(purchaseRequests.id, newRequest.id));
    console.log("Dados limpos com sucesso.");
    
    process.exit(0);
  } catch (error) {
    console.error("Erro durante o teste de integração:", error);
    process.exit(1);
  }
}

runTests();
