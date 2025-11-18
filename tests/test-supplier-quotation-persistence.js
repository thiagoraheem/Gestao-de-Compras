import fetch from 'node-fetch';

async function testSupplierQuotationPersistence() {
  try {
    console.log('🔍 Testando persistência dos campos availableQuantity e confirmedUnit...\n');

    // 1. Login
    console.log('1. Fazendo login...');
    const loginResponse = await fetch('http://localhost:5201/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: 'admin',
        password: 'admin123'
      })
    });

    if (!loginResponse.ok) {
      throw new Error(`Login falhou: ${loginResponse.status}`);
    }

    const cookies = loginResponse.headers.get('set-cookie');
    console.log('✅ Login realizado com sucesso');

    // 2. Buscar a solicitação SOL-2025-321
    console.log('\n2. Buscando solicitação SOL-2025-321...');
    const requestsResponse = await fetch('http://localhost:5201/api/purchase-requests', {
      headers: {
        'Cookie': cookies
      }
    });

    const requests = await requestsResponse.json();
    const targetRequest = requests.find(r => r.requestNumber === 'SOL-2025-321');
    
    if (!targetRequest) {
      throw new Error('Solicitação SOL-2025-321 não encontrada');
    }

    console.log(`✅ Solicitação encontrada - ID: ${targetRequest.id}`);

    // 3. Buscar cotação
    console.log('\n3. Buscando cotação...');
    const quotationResponse = await fetch(`http://localhost:5201/api/purchase-requests/${targetRequest.id}/quotations`, {
      headers: {
        'Cookie': cookies
      }
    });

    if (!quotationResponse.ok) {
      throw new Error(`Erro ao buscar cotação: ${quotationResponse.status}`);
    }

    const quotationText = await quotationResponse.text();
    console.log('Resposta da cotação:', quotationText.substring(0, 200));
    
    let quotation;
    try {
      quotation = JSON.parse(quotationText);
    } catch (e) {
      console.log('Erro ao fazer parse do JSON:', e.message);
      throw new Error('Resposta não é JSON válido');
    }
    
    console.log(`✅ Cotação encontrada - ID: ${quotation.id}`);

    // 4. Buscar itens da cotação
    console.log('\n4. Buscando itens da cotação...');
    const quotationItemsResponse = await fetch(`http://localhost:5201/api/quotations/${quotation.id}/items`, {
      headers: {
        'Cookie': cookies
      }
    });

    const quotationItems = await quotationItemsResponse.json();
    console.log(`✅ ${quotationItems.length} itens da cotação encontrados`);

    // 5. Buscar fornecedores da cotação
    console.log('\n5. Buscando cotações de fornecedores...');
    const supplierQuotationsResponse = await fetch(`http://localhost:5201/api/quotations/${quotation.id}/supplier-quotations`, {
      headers: {
        'Cookie': cookies
      }
    });

    const supplierQuotations = await supplierQuotationsResponse.json();
    console.log(`✅ ${supplierQuotations.length} cotações de fornecedores encontradas`);

    if (supplierQuotations.length === 0) {
      throw new Error('Nenhuma cotação de fornecedor encontrada');
    }

    const firstSupplier = supplierQuotations[0];
    console.log(`📋 Usando fornecedor: ${firstSupplier.supplier.name} (ID: ${firstSupplier.supplier.id})`);

    // 6. Buscar itens existentes da cotação do fornecedor
    console.log('\n6. Verificando itens existentes da cotação do fornecedor...');
    const existingItemsResponse = await fetch(`http://localhost:5201/api/quotations/${quotation.id}/supplier-quotations/${firstSupplier.supplier.id}`, {
      headers: {
        'Cookie': cookies
      }
    });

    let existingSupplierQuotation = null;
    if (existingItemsResponse.ok) {
      existingSupplierQuotation = await existingItemsResponse.json();
      console.log(`✅ Cotação existente encontrada com ${existingSupplierQuotation.items?.length || 0} itens`);
    } else {
      console.log('ℹ️ Nenhuma cotação existente encontrada');
    }

    // 7. Preparar dados de teste
    console.log('\n7. Preparando dados de teste...');
    const testItems = quotationItems.map((item, index) => ({
      quotationItemId: item.id,
      unitPrice: "100.00",
      deliveryDays: "30",
      brand: "Teste Brand",
      model: "Teste Model",
      observations: "Teste de persistência",
      discountPercentage: null,
      discountValue: null,
      isAvailable: true,
      unavailabilityReason: null,
      availableQuantity: index === 0 ? "10" : "5", // Primeiro item com 10, outros com 5
      confirmedUnit: index === 0 ? "UN" : "PC", // Primeiro item com UN, outros com PC
      quantityAdjustmentReason: index === 0 ? "Quantidade ajustada para teste" : null,
    }));

    console.log(`📋 Preparados ${testItems.length} itens para teste:`);
    testItems.forEach((item, index) => {
      console.log(`   Item ${index + 1}: availableQuantity=${item.availableQuantity}, confirmedUnit=${item.confirmedUnit}`);
    });

    // 8. Enviar atualização da cotação
    console.log('\n8. Enviando atualização da cotação do fornecedor...');
    const updateData = {
      supplierId: firstSupplier.supplier.id,
      items: testItems,
      totalValue: "1000.00",
      subtotalValue: "1000.00",
      finalValue: "1000.00",
      discountType: "none",
      discountValue: null,
      includesFreight: false,
      freightValue: null,
      paymentTerms: "30 dias",
      deliveryTerms: "FOB",
      warrantyPeriod: "12 meses",
      observations: "Teste de persistência dos campos availableQuantity e confirmedUnit"
    };

    console.log('📤 Enviando dados:', JSON.stringify(updateData, null, 2));

    const updateResponse = await fetch(`http://localhost:5201/api/quotations/${quotation.id}/update-supplier-quotation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookies
      },
      body: JSON.stringify(updateData)
    });

    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      throw new Error(`Atualização falhou: ${updateResponse.status} - ${errorText}`);
    }

    const updateResult = await updateResponse.json();
    console.log('✅ Atualização enviada com sucesso:', updateResult.message);

    // 9. Verificar se os dados foram persistidos
    console.log('\n9. Verificando persistência dos dados...');
    const verificationResponse = await fetch(`http://localhost:5201/api/quotations/${quotation.id}/supplier-quotations/${firstSupplier.supplier.id}`, {
      headers: {
        'Cookie': cookies
      }
    });

    if (!verificationResponse.ok) {
      throw new Error(`Verificação falhou: ${verificationResponse.status}`);
    }

    const verificationData = await verificationResponse.json();
    console.log('\n📊 Dados persistidos:');
    
    if (verificationData.items && verificationData.items.length > 0) {
      verificationData.items.forEach((item, index) => {
        console.log(`   Item ${index + 1}:`);
        console.log(`     - availableQuantity: ${item.availableQuantity || 'NULL'}`);
        console.log(`     - confirmedUnit: ${item.confirmedUnit || 'NULL'}`);
        console.log(`     - quantityAdjustmentReason: ${item.quantityAdjustmentReason || 'NULL'}`);
      });

      // Verificar se os campos foram persistidos corretamente
      const firstItem = verificationData.items[0];
      const hasAvailableQuantity = firstItem.availableQuantity !== null && firstItem.availableQuantity !== undefined;
      const hasConfirmedUnit = firstItem.confirmedUnit !== null && firstItem.confirmedUnit !== undefined;

      console.log('\n🔍 Resultado da verificação:');
      console.log(`   ✅ availableQuantity persistido: ${hasAvailableQuantity ? 'SIM' : 'NÃO'}`);
      console.log(`   ✅ confirmedUnit persistido: ${hasConfirmedUnit ? 'SIM' : 'NÃO'}`);

      if (hasAvailableQuantity && hasConfirmedUnit) {
        console.log('\n🎉 SUCESSO: Ambos os campos foram persistidos corretamente!');
      } else {
        console.log('\n❌ PROBLEMA: Um ou ambos os campos não foram persistidos!');
        
        // Mostrar dados brutos para debug
        console.log('\n🔧 Dados brutos do primeiro item:');
        console.log(JSON.stringify(firstItem, null, 2));
      }
    } else {
      console.log('❌ Nenhum item encontrado na verificação');
    }

  } catch (error) {
    console.error('❌ Erro durante o teste:', error.message);
    console.error(error.stack);
  }
}

testSupplierQuotationPersistence();