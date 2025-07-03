# Prompts para Refatoração do Sistema de Compras com IA

Este documento contém prompts detalhados para orientar uma IA na implementação das mudanças necessárias no sistema de solicitação de compras.

## Prompt 1: Modelo de Dados para Itens de Solicitação

```
Preciso criar um novo modelo de dados para armazenar os itens de uma solicitação de compra no sistema. 

O contexto é: Atualmente temos um sistema de compras que permite criar solicitações, mas não armazena os itens individuais da solicitação. Quero expandir isso para armazenar uma lista de itens para cada solicitação.

Cada item deve ter:
- ID único
- Referência à solicitação de compra principal
- Número do item (texto)
- Descrição detalhada
- Unidade de medida
- Quantidade em estoque (numérico)
- Quantidade média mensal (numérico)
- Quantidade requisitada (numérico)
- Quantidade aprovada (numérico, opcional)
- Campos de data de criação e atualização

O banco usa PostgreSQL através do ORM Drizzle. Crie o modelo completo com as relações apropriadas e tipos TypeScript.
```

## Prompt 2: Componente de Importação de Excel

```
Preciso criar um componente React em TypeScript que permita importar dados de um arquivo Excel para a solicitação de compra.

O componente deve:
1. Exibir uma área de upload de arquivos com estilo "arrastar e soltar"
2. Aceitar arquivos nos formatos .xlsx, .xls e .csv
3. Processar o arquivo e extrair as seguintes colunas: Item, Descrição, Unid., Quant. Estoque, Quant. Média/mês, Quant. Requisitada, Quant. Aprovado
4. Mapear essas colunas para um formato de dados TypeScript consistente
5. Fornecer feedback visual durante o carregamento e processamento
6. Notificar o componente pai quando os dados forem importados com sucesso

O sistema usa React 18, TailwindCSS e a biblioteca 'xlsx' para processamento de Excel. O componente deve ter boa usabilidade e acessibilidade.
```

## Prompt 3: Tabela Editável de Itens

```
Preciso criar um componente de tabela editável em React para gerenciar os itens de uma solicitação de compra.

O componente deve:
1. Receber um array de itens e uma função de callback para alterações
2. Exibir os itens em formato de tabela com colunas para: Item, Descrição, Unidade, Qtd. Estoque, Qtd. Média/mês, Qtd. Requisitada
3. Permitir que o usuário edite diretamente os valores na tabela
4. Permitir adicionar novos itens com um botão "Adicionar Item"
5. Permitir remover itens existentes
6. Exibir uma mensagem amigável quando não houver itens
7. Ter estilo consistente com o restante da aplicação (usando TailwindCSS)

A interface do item deve conter: item (string), description (string), unit (string), stockQuantity (number), averageMonthlyQuantity (number), requestedQuantity (number).
```

## Prompt 4: Atualização do Formulário de Solicitação

```
Preciso atualizar o componente de criação de solicitação de compra para incluir a gestão de itens. 

O componente atual já tem campos para:
- Centro de Custo
- Categoria
- Urgência
- Prazo de Entrega
- Orçamento
- Justificativa

Quero adicionar:
1. Uma seção para upload de arquivo Excel com os itens
2. Uma tabela editável para visualizar e modificar os itens
3. Validação para garantir que pelo menos um item seja adicionado
4. Envio dos itens junto com os dados da solicitação na API

O formulário usa react-hook-form com validação Zod. 
Atualmente, o componente envia os dados via API REST para o endpoint '/api/purchase-requests'.
As novas mudanças devem manter a consistência visual e de UX com o resto da aplicação.
```

## Prompt 5: Botão de Fechar em Todos os Modais

```
Preciso garantir que todos os modais da aplicação tenham um botão de fechar (X) no canto superior direito.

A aplicação usa componentes de modal baseados no Radix UI Dialog, com a seguinte estrutura:

- DialogContent: Componente base do modal
- DialogHeader: Parte superior com título
- DialogTitle: Título do modal

Implementação desejada:
1. Adicionar um botão X consistente no canto superior direito de todos os modais
2. O botão deve ter estilo adequado (ícone X da biblioteca lucide-react)
3. Deve ser acessível (incluir texto para leitores de tela)
4. Deve fechar o modal quando clicado
5. A modificação deve ser aplicada globalmente, para que todos os modais da aplicação herdem esta característica

A aplicação usa componentes reutilizáveis em client/src/components/ui/dialog.tsx que são extensões dos componentes do Radix UI.
```

## Prompt 6: API de Backend para Itens de Solicitação

```
Preciso atualizar a rota da API que processa solicitações de compra para também lidar com os itens da solicitação.

Atualmente, a API '/api/purchase-requests' (método POST) salva apenas os dados básicos da solicitação. 

As modificações necessárias são:
1. Adaptar a rota para aceitar um array de itens no corpo da requisição
2. Implementar uma transação de banco de dados que:
   - Primeiro insere a solicitação principal
   - Depois insere todos os itens associados a essa solicitação
   - Garante que se houver erro em qualquer parte, toda a operação é revertida
3. Mapear corretamente os campos do frontend para o modelo do banco de dados
4. Retornar uma resposta adequada com os dados da solicitação criada

A aplicação usa Express.js no backend e Drizzle ORM para acesso ao banco PostgreSQL.
```

## Prompt 7: Visualização dos Itens da Solicitação

```
Preciso criar um componente para visualizar os itens de uma solicitação de compra existente.

Requisitos:
1. Exibir os itens em formato de tabela com colunas para: Item, Descrição, Unidade, Qtd. Estoque, Qtd. Média Mensal, Qtd. Requisitada, Qtd. Aprovada
2. Incluir um botão para exportar os dados para Excel
3. Exibir mensagem apropriada quando não houver itens
4. Manter consistência visual com o resto da aplicação

O componente receberá como props:
- Um array de itens da solicitação
- O ID da solicitação (para uso na exportação)

Para a exportação, use a biblioteca xlsx e file-saver para gerar e fazer download do arquivo Excel.
```

## Prompt 8: Instalação e Configuração de Dependências

```
Preciso instalar e configurar as dependências necessárias para implementar a funcionalidade de importação/exportação de Excel e tabelas avançadas.

Adicione os seguintes pacotes ao projeto:
1. xlsx - Para processamento de arquivos Excel
2. @tanstack/react-table - Para tabelas avançadas e editáveis
3. file-saver - Para download de arquivos no navegador

Em seguida, configure corretamente os tipos TypeScript para essas bibliotecas e quaisquer outras configurações necessárias.

O projeto usa npm como gerenciador de pacotes e é baseado em TypeScript.
```

## Prompt 9: Implementação Completa da Funcionalidade

```
Implemente a funcionalidade completa de gerenciamento de itens nas solicitações de compra.

A implementação deve incluir:

1. Modelo de dados no backend usando Drizzle ORM
2. Componente de importação de Excel no frontend
3. Tabela editável para os itens
4. Atualização do formulário de solicitação
5. API para salvar os itens junto com a solicitação
6. Componente de visualização dos itens
7. Exportação para Excel
8. Integração de todos os componentes

Além disso, certifique-se de que todos os modais da aplicação tenham um botão X de fechar no canto superior direito.

O código deve seguir as melhores práticas de React e TypeScript, ser bem tipado, componentizado e manter consistência de estilo com o resto da aplicação.
```

## Prompt 10: Teste e Depuração

```
Preciso de uma estratégia para testar e depurar a nova funcionalidade de gerenciamento de itens nas solicitações de compra.

Crie:
1. Um conjunto de dados de teste em formato Excel que cobre todos os casos (dados válidos, inválidos, limites, etc.)
2. Uma lista de verificação manual para testar todas as funcionalidades:
   - Upload de Excel
   - Edição manual de itens
   - Validação de formulário
   - Salvamento dos dados
   - Visualização dos itens
   - Exportação para Excel
3. Estratégias para depurar problemas comuns que podem surgir
4. Sugestões para melhorar a performance se necessário

Forneça também dicas sobre como garantir que a experiência do usuário seja fluida e intuitiva ao lidar com potencialmente muitos itens em uma solicitação.
```
