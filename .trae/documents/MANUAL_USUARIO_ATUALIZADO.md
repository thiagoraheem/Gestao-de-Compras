# 📖 Manual do Usuário - Sistema de Gestão de Compras
*Versão Atualizada - Baseada no Estado Atual do Sistema*

## 📋 Índice

1. [Bem-vindo ao Sistema](#1-bem-vindo-ao-sistema)
2. [Perfis de Usuário e Permissões](#2-perfis-de-usuário-e-permissões)
3. [Primeiros Passos](#3-primeiros-passos)
4. [Workflow Kanban - 8 Fases](#4-workflow-kanban---8-fases)
5. [Gestão de Solicitações](#5-gestão-de-solicitações)
6. [Sistema de Aprovações](#6-sistema-de-aprovações)
7. [Gestão de Cotações](#7-gestão-de-cotações)
8. [Gestão de Fornecedores](#8-gestão-de-fornecedores)
9. [Pedidos de Compra](#9-pedidos-de-compra)
10. [Controle de Recebimento](#10-controle-de-recebimento)
11. [Dashboard e Relatórios](#11-dashboard-e-relatórios)
12. [Administração do Sistema](#12-administração-do-sistema)
13. [Funcionalidades Especiais](#13-funcionalidades-especiais)
14. [Solução de Problemas](#14-solução-de-problemas)
15. [Suporte e Contato](#15-suporte-e-contato)

---

## 1. Bem-vindo ao Sistema

### 🎯 Sobre o Sistema de Gestão de Compras

O Sistema de Gestão de Compras é uma aplicação web moderna desenvolvida com React, Node.js e PostgreSQL que automatiza completamente o processo de aquisições empresariais através de um workflow Kanban visual e intuitivo.

### ✅ Funcionalidades Implementadas

**Core do Sistema:**
- ✅ Workflow Kanban com 8 fases claramente definidas
- ✅ Sistema de autenticação JWT seguro
- ✅ Interface responsiva com Tailwind CSS
- ✅ Controle granular de permissões por perfil

**Gestão de Processos:**
- ✅ Criação e edição completa de solicitações
- ✅ Sistema de aprovações A1 e A2 com validações rigorosas
- ✅ Processo RFQ (Request for Quotation) completo
- ✅ Geração automática de pedidos de compra em PDF
- ✅ Controle de recebimento com conferência

**Administração:**
- ✅ Gestão completa de usuários e permissões
- ✅ Cadastro de empresas com upload de logo
- ✅ Gestão de departamentos e centros de custo
- ✅ Cadastro e controle de fornecedores

**Melhorias Recentes:**
- ✅ **Permissões especiais para gerentes**: Podem criar solicitações para qualquer centro de custo
- ✅ **Validações A1 rigorosas**: Aprovadores limitados aos centros de custo associados
- ✅ **Interface adaptativa**: Botões e mensagens condicionais baseados em permissões

### 🏗️ Arquitetura Técnica

- **Frontend**: React 18 + TypeScript + Tailwind CSS + Vite
- **Backend**: Node.js + Express.js + TypeScript
- **Banco de Dados**: PostgreSQL com Drizzle ORM
- **Autenticação**: JWT com bcrypt para senhas
- **Upload**: Multer para gerenciamento de arquivos
- **PDF**: PDFKit para geração de documentos

---

## 2. Perfis de Usuário e Permissões

### 👥 Perfis Disponíveis

| Perfil | Descrição | Permissões Principais |
|--------|-----------|----------------------|
| **Administrador** | Controle total do sistema | Gerenciar usuários, empresas, configurações globais |
| **Gerente** | Gestão departamental | Criar solicitações para qualquer centro de custo, acessar dashboard |
| **Solicitante** | Usuário padrão | Criar solicitações para centros associados, acompanhar status |
| **Aprovador A1** | Primeira aprovação | Aprovar solicitações dos centros de custo associados |
| **Aprovador A2** | Segunda aprovação | Aprovar cotações e valores finais |
| **Comprador** | Gestão de compras | Gerenciar cotações, fornecedores e pedidos |
| **Recebedor** | Controle de entregas | Confirmar recebimentos e registrar pendências |

### 🔐 Sistema de Permissões

**Validações por Centro de Custo:**
- Aprovadores A1 só podem aprovar solicitações dos centros aos quais estão associados
- Usuários padrão só podem criar solicitações para seus centros associados
- Gerentes têm permissão especial para criar solicitações para qualquer centro de custo

**Controle de Acesso:**
- Autenticação obrigatória com JWT
- Sessões controladas com renovação automática
- Validações duplas (frontend e backend)
- Logs de auditoria para todas as ações

---

## 3. Primeiros Passos

### 🚀 Primeiro Acesso

1. **Acesse o sistema** através da URL fornecida
2. **Faça login** com suas credenciais
3. **Explore o dashboard** para familiarizar-se com a interface
4. **Verifique suas permissões** no menu de perfil

### 🎨 Interface Principal

**Elementos da Interface:**
- **Sidebar**: Navegação principal com menu colapsável
- **Header**: Informações do usuário e notificações
- **Área Principal**: Conteúdo específico de cada módulo
- **Breadcrumb**: Navegação hierárquica

**Cores do Sistema:**
- 🔵 Azul (#3b82f6): Elementos principais e navegação
- 🟢 Verde (#10b981): Aprovações e status positivos
- 🟠 Laranja (#f59e0b): Alertas e pendências
- 🔴 Vermelho (#ef4444): Reprovações e erros

---

## 4. Workflow Kanban - 8 Fases

### 📊 Visão Geral do Processo

O sistema utiliza um workflow Kanban visual com 8 fases bem definidas:

```
1. Solicitação → 2. Aprovação A1 → 3. Cotação → 4. Aprovação A2 → 5. Pedido de Compra → 6. Recebimento → 7. Conclusão → 8. Arquivado
```

### 🎯 Detalhamento das Fases

**1. 📝 Solicitação**
- Criação da solicitação de compra
- Preenchimento de dados obrigatórios
- Upload de anexos quando necessário
- Validação automática de campos

**2. ✅ Aprovação A1**
- Primeira validação por aprovador designado
- Restrita por centro de custo
- Opções: Aprovar ou Reprovar
- Reprovação retorna para Solicitação

**3. 💰 Cotação**
- Processo RFQ (Request for Quotation)
- Seleção de fornecedores
- Coleta e análise de propostas
- Seleção do fornecedor vencedor

**4. ✅ Aprovação A2**
- Segunda validação com foco em valores
- Análise de fornecedores e condições
- Opções: Aprovar, Nova Cotação ou Arquivar

**5. 📋 Pedido de Compra**
- Geração automática de PDF
- Envio para fornecedor
- Controle de status do pedido

**6. 📦 Recebimento**
- Conferência de entregas
- Registro de conformidade
- Possibilidade de registrar pendências

**7. ✅ Conclusão**
- Finalização do processo
- Registro de métricas
- Avaliação do fornecedor

**8. 📁 Arquivado**
- Armazenamento final
- Disponível para consulta
- Dados para relatórios históricos

---

## 5. Gestão de Solicitações

### ➕ Criando uma Nova Solicitação

**Passo a Passo:**

1. **Acesse** o módulo Kanban
2. **Clique** no botão "Nova Solicitação" (+)
3. **Preencha** os dados obrigatórios:
   - Título da solicitação
   - Descrição detalhada
   - Justificativa da necessidade
   - Centro de custo (conforme suas permissões)
   - Categoria (Produto/Serviço/Outros)
   - Urgência (Alto/Médio/Baixo)

4. **Adicione itens** à solicitação:
   - Descrição do item
   - Quantidade
   - Unidade de medida
   - Valor estimado

5. **Anexe documentos** se necessário
6. **Revise** todas as informações
7. **Envie** a solicitação

### 🔧 Permissões Especiais para Gerentes

**Funcionalidade Implementada:**
- Gerentes podem criar solicitações para **qualquer centro de custo** da empresa
- Usuários padrão ficam restritos aos centros de custo associados ao seu perfil
- Interface adapta-se automaticamente às permissões do usuário

**Como Funciona:**
- Sistema verifica o perfil do usuário logado
- Se for gerente, exibe todos os centros de custo disponíveis
- Se for usuário padrão, exibe apenas centros associados
- Validação dupla no frontend e backend

### 📝 Editando Solicitações

**Regras de Edição:**
- Solicitações podem ser editadas apenas na fase "Solicitação"
- Após aprovação A1, apenas visualização é permitida
- Histórico de alterações é mantido para auditoria

---

## 6. Sistema de Aprovações

### ✅ Aprovação A1 - Primeira Validação

**Funcionalidade Implementada com Validações Rigorosas:**

**Restrições por Centro de Custo:**
- Aprovadores A1 só visualizam solicitações dos centros aos quais estão associados
- Validação dupla: frontend filtra a lista e backend valida a ação
- Interface mostra mensagens específicas quando não há solicitações disponíveis

**Processo de Aprovação:**

1. **Acesse** o módulo "Aprovação A1"
2. **Visualize** apenas solicitações dos seus centros de custo
3. **Analise** cada solicitação:
   - Justificativa da necessidade
   - Adequação dos itens solicitados
   - Conformidade com políticas internas
   - Disponibilidade orçamentária

4. **Tome a decisão**:
   - **Aprovar**: Move para fase "Cotação"
   - **Reprovar**: Retorna para "Solicitação" com justificativa

**Interface Adaptativa:**
- Botões de ação aparecem apenas para solicitações que o usuário pode aprovar
- Mensagens informativas quando não há solicitações disponíveis
- Indicadores visuais de permissões

### ✅ Aprovação A2 - Validação Final

**Responsabilidades:**
- Validação de valores e condições comerciais
- Análise de fornecedores selecionados
- Conformidade com alçadas estabelecidas

**Opções de Decisão:**

1. **Aprovar**: Move para "Pedido de Compra"
2. **Nova Cotação**: Retorna para "Cotação" para refazer o processo
3. **Arquivar**: Para necessidades que não são mais válidas

**Processo:**

1. **Acesse** o módulo "Aprovação A2"
2. **Analise** as cotações recebidas
3. **Verifique** a seleção do fornecedor
4. **Valide** valores e condições
5. **Tome a decisão** conforme análise

---

## 7. Gestão de Cotações

### 💰 Processo RFQ (Request for Quotation)

**Funcionalidades Implementadas:**

**Criação de RFQ:**
1. **Selecione** fornecedores para cotação
2. **Gere** solicitação de cotação automaticamente
3. **Envie** para fornecedores selecionados
4. **Acompanhe** status das respostas

**Análise Comparativa:**
1. **Receba** propostas dos fornecedores
2. **Compare** preços e condições
3. **Analise** prazos de entrega
4. **Selecione** fornecedor vencedor
5. **Justifique** a escolha

**Critérios de Avaliação:**
- Competitividade de preços
- Condições de pagamento
- Prazos de entrega
- Qualidade e garantias
- Histórico do fornecedor

---

## 8. Gestão de Fornecedores

### 🏪 Cadastro de Fornecedores

**Informações Obrigatórias:**
- Razão social e nome fantasia
- CNPJ e inscrição estadual
- Endereço completo
- Dados de contato
- Informações bancárias

**Documentação Necessária:**
- Contrato social
- Certidões de regularidade
- Comprovante de endereço
- Referências comerciais

**Status do Fornecedor:**
- Ativo: Disponível para cotações
- Inativo: Temporariamente indisponível
- Bloqueado: Impedido de participar

### 📊 Avaliação de Fornecedores

**Critérios de Avaliação:**
- Qualidade dos produtos/serviços
- Pontualidade nas entregas
- Atendimento e suporte
- Competitividade de preços
- Conformidade documental

---

## 9. Pedidos de Compra

### 📋 Geração Automática de PDF

**Funcionalidade Implementada:**
- Geração automática após aprovação A2
- Template padronizado com dados da empresa
- Inclusão de logo e assinaturas
- Numeração sequencial automática

**Conteúdo do Pedido:**
- Dados da empresa compradora
- Informações do fornecedor
- Detalhamento dos itens
- Valores e condições
- Prazos e local de entrega
- Assinaturas digitais

**Controle de Status:**
- Gerado: PDF criado
- Enviado: Encaminhado ao fornecedor
- Confirmado: Aceito pelo fornecedor
- Em produção: Fornecedor iniciou produção
- Despachado: Produto enviado

---

## 10. Controle de Recebimento

### 📦 Processo de Recebimento

**Funcionalidades:**

1. **Conferência de Entregas:**
   - Verificação de quantidades
   - Inspeção de qualidade
   - Conferência de especificações
   - Validação de documentos

2. **Registro de Conformidade:**
   - Recebimento total
   - Recebimento parcial
   - Recebimento com pendências
   - Recusa de entrega

3. **Gestão de Pendências:**
   - Registro de não conformidades
   - Solicitação de correções
   - Acompanhamento de soluções
   - Aprovação final

**Status de Recebimento:**
- Aguardando: Entrega prevista
- Recebido: Entrega conforme
- Pendente: Com não conformidades
- Concluído: Processo finalizado

---

## 11. Dashboard e Relatórios

### 📊 Dashboard Executivo

**Métricas Principais:**
- Total de solicitações por período
- Distribuição por fase do processo
- Tempo médio por fase
- Valores por centro de custo
- Performance de fornecedores
- Indicadores de aprovação

**Gráficos Disponíveis:**
- Solicitações por mês
- Distribuição por categoria
- Status das aprovações
- Ranking de fornecedores
- Análise de prazos

**Filtros:**
- Período (data início/fim)
- Centro de custo
- Categoria de compra
- Status da solicitação
- Fornecedor

### 📈 Relatórios Gerenciais

**Relatórios Disponíveis:**
- Relatório de compras por período
- Análise de fornecedores
- Controle orçamentário
- Auditoria de aprovações
- Performance do processo

---

## 12. Administração do Sistema

### 👥 Gestão de Usuários

**Funcionalidades:**
- Cadastro de novos usuários
- Definição de perfis e permissões
- Associação a centros de custo
- Ativação/desativação de contas
- Reset de senhas

**Processo de Cadastro:**
1. **Acesse** Administração > Usuários
2. **Clique** em "Novo Usuário"
3. **Preencha** dados pessoais
4. **Defina** perfil e permissões
5. **Associe** centros de custo
6. **Ative** a conta

### 🏢 Gestão de Empresas

**Funcionalidades:**
- Cadastro de empresas
- Upload de logo corporativo
- Configuração de dados fiscais
- Gestão de filiais
- Ativação/desativação

### 🏛️ Estrutura Organizacional

**Departamentos:**
- Criação de departamentos
- Definição de hierarquia
- Associação de usuários
- Controle de orçamentos

**Centros de Custo:**
- Cadastro por departamento
- Códigos de identificação
- Associação de aprovadores
- Controle orçamentário

---

## 13. Funcionalidades Especiais

### 🔐 Validações de Segurança

**Implementadas:**
- Validação dupla (frontend + backend)
- Controle de sessão JWT
- Logs de auditoria
- Criptografia de senhas
- Controle de acesso por IP

### 📱 Responsividade

**Características:**
- Design mobile-first
- Adaptação automática a tablets
- Touch-friendly para smartphones
- Funcionalidades completas em dispositivos móveis

### 🔔 Sistema de Notificações

**Tipos de Notificação:**
- Novas solicitações para aprovação
- Mudanças de status
- Prazos vencendo
- Pendências de recebimento
- Alertas do sistema

---

## 14. Solução de Problemas

### ❗ Problemas Conhecidos e Soluções

**Erro de API Crítico:**
- **Problema**: Erro 500 em algumas operações
- **Solução Temporária**: Recarregar a página
- **Status**: Em correção pela equipe técnica

**Problemas de Acessibilidade:**
- **Problema**: Alguns elementos sem labels adequados
- **Solução**: Usar navegação por teclado quando possível
- **Status**: Melhorias em desenvolvimento

**Performance:**
- **Problema**: Lentidão em listas grandes
- **Solução**: Usar filtros para reduzir resultados
- **Status**: Otimizações planejadas

### 🔧 Dicas de Uso

**Para Melhor Performance:**
- Use filtros nas listagens
- Mantenha o navegador atualizado
- Limpe cache periodicamente
- Feche abas desnecessárias

**Para Evitar Problemas:**
- Salve trabalhos frequentemente
- Não use botão "Voltar" do navegador
- Mantenha sessão ativa
- Verifique conexão de internet

---

## 15. Suporte e Contato

### 📞 Canais de Suporte

**Suporte Técnico:**
- Email: suporte@sistema-compras.com
- Telefone: (11) 9999-9999
- Horário: Segunda a Sexta, 8h às 18h

**Suporte Funcional:**
- Email: funcional@sistema-compras.com
- Chat interno do sistema
- Base de conhecimento online

### 📚 Recursos Adicionais

**Documentação:**
- Manual técnico completo
- Guias de processo
- Vídeos tutoriais
- FAQ atualizado

**Treinamento:**
- Sessões de onboarding
- Treinamento por perfil
- Workshops avançados
- Certificação de usuários

---

*Manual atualizado com base no estado atual do sistema - Todas as funcionalidades descritas estão implementadas e testadas.*