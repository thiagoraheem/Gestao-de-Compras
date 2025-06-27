# 📘 Prompts para Sistema de Gestão de Compras - Estilo Kanban com Agentes de IA

Este documento reúne os prompts estruturados para a criação de um sistema de **Gestão de Compras estilo Kanban** que será operado por usuários e também por **agentes de IA automatizados**. O conteúdo foi separado por módulos para facilitar a leitura e interpretação por agentes.

---

## 🚀 Plataforma recomendada para desenvolvimento

Implemente o sistema usando:

* **Frontend:** React com TypeScript
* **Backend:** Node.js com NestJS (ou Express)
* **Banco de Dados:** PostgreSQL
* **Autenticação:** JWT com controle de papéis (roles)
* **API:** RESTful com documentação via Swagger/OpenAPI
* **Upload de Arquivos:** suporte a Amazon S3, Firebase ou armazenamento local temporário
* **Integração com IA:** endpoints preparados para agentes, suporte a Webhooks, filas de eventos (RabbitMQ ou Kafka) e payloads JSON padronizados

---

## 🧠 1. Estrutura Base do Sistema Kanban

```prompt
Crie um sistema web de gestão de compras com interface estilo Kanban com as seguintes fases fixas no fluxo:
- Solicitação
- Aprovação de Solicitação (A1)
- Cotação (RFQ)
- Aprovação de Compra (A2)
- Pedido de Compra
- Conclusão de Compra
- Recebimento de Material
- Arquivado

Cada fase pode conter campos específicos (obrigatórios ou opcionais), com transições controladas por regras de negócio, usuários e permissões. O sistema será operado também por agentes de IA automatizados, portanto, deve ter endpoints claros, bem definidos e eventos disparáveis por agentes externos.
```

---

## 🔐 2. Sistema de Usuários, Permissões e Departamentos

```prompt
Implemente um sistema de autenticação e autorização com gestão de usuários, papéis e permissões.
- Usuários pertencem a um ou mais Departamentos.
- Cada Departamento pode estar associado a um ou mais Centros de Custo.
- Um usuário pode visualizar ou gerenciar solicitações de todos os departamentos que ele estiver vinculado.
- Crie uma tabela de Departamentos com seus Centros de Custo.
- A tabela de usuários deve conter: nome, e-mail, senha, se é comprador (booleano), se é aprovador A1 ou A2 (booleans), lista de departamentos vinculados.
```

---

## 📝 3. Cadastro de Nova Solicitação (Formulário)

```prompt
Implemente um formulário de criação de nova solicitação de compra com os seguintes campos:

Obrigatórios:
- Solicitante (usuário logado)
- Centro de Custo (drop-down com base na tabela de departamentos disponíveis)
- Categoria de Compra (Produto, Serviço, Outros)
- Upload de Planilha (arquivo de Requisição de Compra conforme template)
- Grau de Urgência (Baixo, Médio, Alto)
- Justificativa (texto)

Opcionais:
- Prazo Ideal de Entrega (data)
- Orçamento Disponível (valor monetário)
- Mais Informações (texto livre)
- Anexos adicionais

Essa ação deve criar um Card na fase inicial do Kanban (Solicitação).
```

---

## ✅ 4. Aprovação de Solicitação (Fase A1)

```prompt
Na fase "Aprovação de Solicitação", o sistema deve:

- Identificar automaticamente o(s) aprovador(es) vinculados ao Centro de Custo informado.
- Preencher o campo "Aprovador".
- Permitir ao aprovador marcar um campo booleano: "Aprovado".
- Se "Aprovado = false", exibir o campo "Justificativa da não aprovação".
- Se "Aprovado = true", mover automaticamente para a próxima fase: Cotação.
```

---

## 💸 5. Fase de Cotação (RFQ)

```prompt
Na fase "Cotação", o sistema deve permitir:

- Preencher o campo "Comprador" com um usuário com a flag "é comprador".
- Associar um ou mais fornecedores (previamente cadastrados em outra tela).
- Fazer upload de arquivos de cotações recebidas.
- Informar:
  - Valor Total da Compra
  - Método de Pagamento (usar tabela de métodos com: Boleto, Cheque, Transferência, Cartão de Crédito, Dinheiro, Pix)

Apenas usuários com permissão de comprador podem editar essa fase.
```

---

## 🧾 6. Aprovação de Compra (Fase A2)

```prompt
Na fase "Aprovação de Compra", somente usuários com permissão de aprovação A2 podem editar.

Deve-se informar:
- Fornecedor Escolhido
- Motivo da Escolha (múltipla escolha com opções: Melhor Preço, Melhor Relacionamento, Melhor Prazo, Melhor Qualidade)
- Valor Negociado
- Descontos Obtidos
- Data de Entrega

Se todos os dados forem preenchidos corretamente, permitir avanço para a fase Pedido de Compra.
```

---

## 📄 7. Pedido de Compra

```prompt
Na fase "Pedido de Compra", o sistema deve permitir:

- Preencher Data de Realização da Compra
- Fazer upload dos arquivos de Pedido de Compra
- Informar "Texto Longo" com observações livres

Depois de preenchido, mover o card para a fase "Conclusão de Compra".
```

---

## 📦 8. Recebimento de Material

```prompt
Na fase "Recebimento de Material", o sistema deve:

- Permitir indicar o "Usuário que recebeu"
- Confirmar recebimento de material para permitir transição final para a fase "Arquivado".
```

---

## 🧰 9. Tela de Fornecedores e Métodos de Pagamento

```prompt
Crie uma interface para cadastro de Fornecedores com os seguintes campos:
- Nome
- CNPJ
- Contato
- E-mail
- Produtos/Serviços fornecidos

Crie também uma tabela para "Métodos de Pagamento", com os seguintes valores padrão:
- Boleto
- Cheque
- Transferência Bancária
- Cartão de Crédito
- Dinheiro
- Pix
```

---

## 🤖 10. Preparação para Agentes de IA

```prompt
Crie um conjunto de endpoints REST ou GraphQL para que agentes de IA possam:

- Criar cards de solicitação automaticamente
- Validar regras de transição entre fases
- Preencher campos obrigatórios por fase
- Serem notificados de eventos (ex: cotação recebida, aprovação pendente, material entregue)

Implemente sistema de webhooks para cada fase do processo para disparar eventos customizados com payload contendo os dados do card atualizado.
```
