# 📋 Fluxo de Compras Completo - Prompts de Implementação

## 1. Fase de Cotação (RFQ - Request for Quotation)

### 1.1 Componente de Criação de RFQ
```prompt
Crie um componente React para gerenciar o processo de cotação que inclua:

1. Cabeçalho com:
   - Número da solicitação
   - Solicitante
   - Data de criação
   - Prazo para envio de cotações

2. Lista de itens da solicitação:
   - Código do item
   - Descrição
   - Quantidade
   - Unidade de medida
   - Especificações técnicas
   - Prazo de entrega desejado

3. Fornecedores:
   - Seleção múltipla de fornecedores pré-cadastrados
   - Opção para adicionar novos fornecedores
   - Histórico de cotações anteriores por fornecedor

4. Anexos:
   - Upload de documentos de referência
   - Termos e condições
   - Especificações técnicas detalhadas

5. Controles:
   - Botão "Enviar para Cotações"
   - Botão "Salvar como Rascunho"
   - Botão "Cancelar"

Use os componentes da biblioteca shadcn/ui já existente no projeto e mantenha o padrão visual.
```

### 1.2 Página de Acompanhamento de Cotações
```prompt
Desenvolva uma página para acompanhar as cotações enviadas:

1. Lista de cotações com status:
   - Em andamento
   - Aguardando aprovação
   - Aprovadas
   - Expiradas
   - Canceladas

2. Filtros:
   - Por fornecedor
   - Por data
   - Por valor
   - Por status

3. Visualização em grade ou lista:
   - Número da cotação
   - Fornecedor
   - Data de envio
   - Data limite
   - Valor total
   - Status
   - Ações (visualizar, editar, cancelar)

4. Gráficos de análise:
   - Tempo médio de resposta
   - Comparativo de preços
   - Histórico de variação de preços
```

## 2. Fase de Análise e Aprovação de Cotações

### 2.1 Componente de Análise de Cotações
```prompt
Crie um componente para análise comparativa de cotações que inclua:

1. Visão geral:
   - Tabela comparativa com todos os itens cotados por fornecedor
   - Destaque para o melhor preço de cada item
   - Cálculo automático do valor total por fornecedor

2. Análise por item:
   - Variação percentual em relação à média
   - Histórico de preços
   - Comentários da equipe de compras

3. Aprovação:
   - Campo para justificativa de escolha
   - Aprovação em múltiplos níveis (comercial, técnico, financeiro)
   - Assinatura digital

4. Anexos:
   - Proposta comercial
   - Ficha técnica
   - Certificações
   - Referências
```

## 3. Fase de Emissão de Pedido de Compra

### 3.1 Geração de Pedido de Compra
```prompt
Desenvolva o fluxo de geração de pedido de compra:

1. Dados do pedido:
   - Número do pedido (sequencial automático)
   - Fornecedor selecionado
   - Condições de pagamento
   - Prazo de entrega
   - Local de entrega
   - Contato do fornecedor

2. Itens aprovados:
   - Lista de itens com quantidades e preços
   - Códigos internos
   - Centro de custo
   - Conta contábil

3. Aprovações necessárias:
   - Fluxo de aprovação configurável
   - Notificações por e-mail
   - Aprovação móvel

4. Documentos gerados:
   - Pedido de compra em PDF
   - XML para envio ao fornecedor
   - Arquivo para integração com ERP
```

## 4. Fase de Acompanhamento de Pedidos

### 4.1 Dashboard de Acompanhamento
```prompt
Crie um dashboard para acompanhamento de pedidos em andamento:

1. Visão geral:
   - Pedidos em aberto
   - Pedidos atrasados
   - Pedidos a vencer
   - Valor total em aberto

2. Lista de pedidos:
   - Número do pedido
   - Fornecedor
   - Data de emissão
   - Previsão de entrega
   - Status
   - Valor total
   - Ações (visualizar, cancelar, receber)

3. Detalhes do pedido:
   - Itens solicitados x entregues
   - Histórico de alterações
   - Comunicados com o fornecedor
   - Anexos (notas fiscais, comprovantes)

4. Alertas:
   - Atrasos na entrega
   - Itens divergentes
   - Pagamentos pendentes
```

## 5. Fase de Recebimento e Conferência

### 5.1 Módulo de Recebimento
```prompt
Desenvolva o módulo de recebimento de mercadorias:

1. Registro de recebimento:
   - Leitura de código de barras/QR Code
   - Confirmação de quantidade
   - Inspeção visual
   - Registro de não conformidades

2. Conferência de itens:
   - Comparação com pedido de compra
   - Registro de avarias
   - Amostragem para inspeção
   - Aprovação de qualidade

3. Documentação:
   - Check-list de recebimento
   - Fotos de evidência
   - Relatório de não conformidade
   - Liberação para estoque

4. Fluxo de exceção:
   - Devolução de mercadorias
   - Reclamação de qualidade
   - Ajustes de estoque
```

## 6. Integração com Fornecedores

### 6.1 Portal do Fornecedor
```prompt
Implemente um portal para fornecedores com:

1. Acesso autenticado
2. Visualização de cotações em aberto
3. Envio de propostas
4. Acompanhamento de pedidos
5. Faturamento eletrônico
6. Mensageria com a equipe de compras
7. Atualização de cadastro
8. Histórico de negociações
```

## 7. Fluxo de Aprovações

### 7.1 Workflow de Aprovações
```prompt
Crie um sistema de aprovações com:

1. Regras configuráveis por:
   - Valor total
   - Categoria de despesa
   - Departamento solicitante
   - Tipo de compra

2. Níveis de aprovação:
   - Aprovação gerencial
   - Aprovação financeira
   - Aprovação de diretoria

3. Notificações:
   - E-mail
   - Notificações no sistema
   - Aprovação por WhatsApp

4. Delegação de aprovação:
   - Temporária
   - Por tipo de despesa
   - Por valor
```

## 8. Relatórios e Análises

### 8.1 Módulo de Relatórios
```prompt
Desenvolva o módulo de relatórios com:

1. Relatórios padrão:
   - Compras por fornecedor
   - Compras por departamento
   - Análise de preços
   - Desempenho de fornecedores

2. Personalização:
   - Construtor de relatórios
   - Filtros avançados
   - Agendamento de envio

3. Exportação:
   - PDF
   - Excel
   - CSV
   - Gráficos interativos
```

## Instruções para Implementação

1. Comece pela fase de cotação (RFQ)
2. Implemente o fluxo sequencialmente
3. Adicione integrações conforme necessário
4. Teste cada fase antes de prosseguir
5. Documente as alterações
6. Treine os usuários finais
