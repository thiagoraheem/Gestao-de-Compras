# 📖 Manual do Usuário - Sistema de Gestão de Compras

## 📋 Índice

1. [Bem-vindo ao Sistema de Gestão de Compras](#-bem-vindo-ao-sistema-de-gestão-de-compras)
2. [Políticas e Diretrizes de Compras](#-políticas-e-diretrizes-de-compras)
3. [Primeiros Passos](#-primeiros-passos)
4. [Navegação Principal](#-navegação-principal)
5. [Workflow de Compras - Guia Completo](#-workflow-de-compras---guia-completo)
6. [Gestão de Fornecedores](#-gestão-de-fornecedores)
7. [Gestão de Usuários](#-gestão-de-usuários)
8. [Gestão de Empresas](#-gestão-de-empresas)
9. [Gestão de Locais de Entrega](#-gestão-de-locais-de-entrega)
10. [Gestão de Departamentos](#-gestão-de-departamentos)
11. [Dashboard](#-dashboard)
12. [Relatórios Avançados](#-relatórios-avançados)
13. [Conferência de Material (Recebimento)](#-conferência-de-material-recebimento)
14. [Configurações Pessoais](#-configurações-pessoais)
15. [Uso em Dispositivos Móveis](#-uso-em-dispositivos-móveis)
16. [Sistema de Notificações](#-sistema-de-notificações)
17. [Solução de Problemas (Troubleshooting)](#-solução-de-problemas-troubleshooting)
18. [Auditoria e Controles Internos](#-auditoria-e-controles-internos)
19. [Suporte e Contato](#-suporte-e-contato)

---

## 🎯 Bem-vindo ao Sistema de Gestão de Compras

Este manual irá guiá-lo através de todas as funcionalidades do sistema, desde o primeiro acesso até a conclusão completa de um processo de compra. O sistema foi atualizado para incluir 9 fases de controle, garantindo maior rigor fiscal e integração com ERP.

### O que há de novo nesta versão:
- **Fase de Conferência Fiscal**: Nova etapa dedicada à validação fiscal e financeira.
- **Integração com ERP**: Logs de envio e status de integração.
- **Validação Estrita de Recebimento**: Controle rigoroso de quantidades no recebimento físico.
- **Novos Relatórios**: Análise de Itens Comprados e Consulta de Notas Fiscais.
- **Página de Conferência de Material**: Interface dedicada para a equipe de almoxarifado.

---

## 📜 Políticas e Diretrizes de Compras

### 🎯 Objetivo da Política

A Blomaq Locação de Equipamentos e Imóveis Ltda. estabelece diretrizes, critérios e procedimentos para as compras de materiais e serviços, visando assegurar eficiência, controle, economicidade e conformidade.

### 🏛️ Estrutura de Aprovações e Alçadas

#### Níveis de Aprovação por Valor (Configurável)
- **Limite configurável**: O valor limite para dupla aprovação é definido pelo Administrador (Padrão: R$ 2.500,00).
- **Aprovação Simples (≤ limite)**: Requer apenas aprovação do nível A2.
- **Dupla Aprovação (> limite)**: Requer aprovação sequencial de um Diretor e depois do CEO.

#### Aprovação A1 (Técnica/Gerencial)
- **Responsabilidade**: Aprovadores designados por centro de custo.
- **Critério**: Validação da necessidade técnica e orçamentária.
- **Restrição**: Limitado aos centros de custo associados ao usuário.

#### Aprovação A2 (Financeira/Diretoria)
- **Responsabilidade**: Aprovadores com visão ampla (CFO/CEO).
- **Critério**: Validação comercial, fornecedor e condições de pagamento.
- **Opções**: Aprovar, Arquivar (cancelar) ou Solicitar Nova Cotação.

---

## 🚀 Primeiros Passos

### Acessando o Sistema
1. **Abra seu navegador** e acesse o endereço do sistema.
2. **Login**: Digite seu usuário/email e senha.
3. **Primeiro Acesso**: Recomendamos alterar sua senha imediatamente em **Perfil** → **Alterar Senha**.

---

## 🏠 Navegação Principal

O sistema utiliza um menu lateral ou superior dependendo do dispositivo. As principais seções são:

- **Kanban de Compras**: Visão geral de todas as solicitações em andamento.
- **Gestão de Solicitações**: Lista detalhada com filtros avançados.
- **Conferência de Material**: Área dedicada para recebimento físico (Almoxarifado).
- **Relatórios**: Acesso aos relatórios de itens, notas fiscais, fornecedores e solicitações.
- **Cadastros**: Empresas, Fornecedores, Usuários, Departamentos, Locais de Entrega.
- **Configurações**: Aprovação por valor e configurações do sistema (Admin).

---

## 🔄 Workflow de Compras - Guia Completo

O sistema utiliza um workflow Kanban com **9 fases** sequenciais.

### 📝 Fase 1: Solicitação
- **Objetivo:** Formalizar a necessidade de compra de produtos ou serviços para a empresa.
- **Ações do Solicitante:**
  - Preencher formulário com descrição detalhada dos itens.
  - Indicar quantidade, unidade de medida e urgência.
  - Selecionar o Centro de Custo apropriado.
  - Justificar a necessidade da compra.
- **Ações do Sistema/Backend:**
  - Validação de campos obrigatórios.
  - Associação automática da solicitação ao usuário logado.
  - Notificação aos aprovadores do centro de custo selecionado.
- **Resultado Esperado:** Solicitação criada e aguardando aprovação técnica (Status: Pendente A1).

### ✅ Fase 2: Aprovação A1 (Técnica)
- **Objetivo:** Validar tecnicamente a necessidade e a adequação ao orçamento do centro de custo.
- **Ações do Gestor:**
  - Revisar itens, quantidades e justificativa.
  - **Aprovar:** Autoriza o início da cotação.
  - **Reprovar:** Devolve ao solicitante com motivo obrigatório.
- **Ações do Sistema/Backend:**
  - Verificação de permissões por Centro de Custo.
  - Registro de log de aprovação (quem e quando).
  - Bloqueio de edição dos itens após aprovação.
- **Resultado Esperado:** Solicitação aprovada e encaminhada para o setor de compras.

### 💰 Fase 3: Cotação (RFQ)
- **Objetivo:** Obter os melhores preços e condições comerciais com fornecedores homologados.
- **Ações do Comprador:**
  - Selecionar fornecedores para envio de RFQ.
  - Registrar propostas recebidas (Preço, Prazo, Pagamento).
  - Fazer upload dos orçamentos (PDF/Imagem).
  - Selecionar o fornecedor vencedor.
- **Ações do Sistema/Backend:**
  - Cálculo automático do valor total por fornecedor.
  - Destaque visual para a melhor oferta (menor preço).
  - Validação de anexos obrigatórios antes de avançar.
- **Resultado Esperado:** Fornecedor definido e valores registrados para validação financeira.

### ✅ Fase 4: Aprovação A2 (Financeira)
- **Objetivo:** Validação final da diretoria/financeiro sobre os valores negociados e impacto no fluxo de caixa.
- **Ações do Aprovador:**
  - Analisar quadro comparativo de preços.
  - Verificar condições de pagamento.
  - **Aprovar:** Autoriza compra.
  - **Nova Cotação:** Exige renegociação.
- **Ações do Sistema/Backend:**
  - Verificação de alçadas de valor (Aprovação Simples vs Dupla).
  - Encaminhamento para CEO se valor exceder limite configurado.
- **Resultado Esperado:** Compra autorizada financeiramente.

### 🛒 Fase 5: Pedido de Compra
- **Objetivo:** Oficializar o compromisso de compra junto ao fornecedor através de documento formal.
- **Ações do Comprador:**
  - Revisar dados finais de faturamento e entrega.
  - Gerar documento PDF do pedido.
  - Enviar pedido ao fornecedor (E-mail/WhatsApp).
  - Confirmar envio no sistema.
- **Ações do Sistema/Backend:**
  - Geração de número sequencial de PO (Purchase Order).
  - Criação de PDF com assinatura eletrônica interna.
  - Disparo de e-mail automático (se configurado).
- **Resultado Esperado:** Pedido enviado ao fornecedor e aguardando entrega.

### 📦 Fase 6: Recebimento Físico
- **Objetivo:** Garantir que os produtos recebidos fisicamente correspondem exatamente ao que foi pedido.
- **Ações do Recebedor:**
  - Conferir mercadoria física vs Nota Fiscal.
  - Informar quantidade recebida para cada item.
  - Anexar foto do canhoto ou mercadoria.
  - Reportar avarias ou divergências.
- **Ações do Sistema/Backend:**
  - **Validação Estrita:** Bloqueia entrada se Qtd > Pedido.
  - Controle de saldo parcial (permite múltiplas entregas).
  - Atualização automática de status de estoque.
- **Resultado Esperado:** Entrada física confirmada e registrada.

### 📋 Fase 7: Conferência Fiscal
- **Objetivo:** Validação tributária, lançamento da Nota Fiscal e integração com o sistema ERP.
- **Ações do Fiscal:**
  - Importar XML da NF-e ou digitar chave de acesso.
  - Conferir impostos e valores totais.
  - Preencher dados financeiros (Vencimento, Parcelas).
  - Confirmar integração.
- **Ações do Sistema/Backend:**
  - Leitura automática de dados do XML.
  - Envio de dados via API para o ERP.
  - Validação de consistência (Soma dos itens = Total NF).
  - Exibição de logs de erro/sucesso da integração.
- **Resultado Esperado:** Nota fiscal lançada no ERP e contas a pagar gerado.

### 🏁 Fase 8: Conclusão
- **Objetivo:** Revisão final e consolidação de todos os documentos do processo para auditoria.
- **Ações do Usuário:**
  - Visualizar resumo executivo do processo.
  - Baixar "Kit de Auditoria" (Zip com todos os docs).
  - Clicar em "Arquivar Processo".
- **Ações do Sistema/Backend:**
  - Compilação da timeline completa.
  - Verificação de pendências finais.
- **Resultado Esperado:** Processo pronto para arquivamento definitivo.

### 🗃️ Fase 9: Arquivado
- **Objetivo:** Manter um registro histórico seguro e imutável para fins de auditoria e consulta futura.
- **Ações do Usuário:**
  - Consulta em modo somente leitura.
  - Recuperação de histórico.
- **Ações do Sistema/Backend:**
  - Garantia de integridade dos dados (bloqueio total de edição).
  - Indexação para busca rápida em relatórios.
- **Resultado Esperado:** Registro histórico preservado.

---

## 📊 Relatórios Avançados

O sistema agora conta com uma suíte de relatórios para análise gerencial:

### 1. Análise de Itens Comprados
- **Caminho**: Menu → Relatórios → Análise de Itens.
- **Objetivo**: Analisar histórico de preços, volatilidade e volume de compras por item.
- **Métricas**: Preço médio, mínimo, máximo, total gasto, fornecedores por item.
- **Filtros**: Por período, tipo (com/sem código ERP) e busca textual.

### 2. Consulta de Notas Fiscais (Invoices)
- **Caminho**: Menu → Relatórios → Invoices.
- **Objetivo**: Listar todas as notas fiscais registradas e seus status de integração.
- **Detalhes**: Permite visualizar itens da nota, XML (se disponível) e status (Pendente, Integrado, Erro).
- **Exportação**: Permite exportar a lista para CSV.

### 3. Relatório de Solicitações
- **Caminho**: Menu → Relatórios → Solicitações.
- **Objetivo**: Acompanhar o status de todas as solicitações, tempos de aprovação e gargalos.

### 4. Relatório de Fornecedores
- **Caminho**: Menu → Relatórios → Fornecedores.
- **Objetivo**: Avaliar performance e volume de compras por fornecedor.

---

## 📦 Conferência de Material (Recebimento)

Uma página dedicada para operadores de logística e almoxarifado, focada exclusivamente no recebimento físico, sem a complexidade do Kanban.

- **Acesso**: Menu → Conferência de Material.
- **Interface**: Lista simplificada de pedidos aguardando recebimento.
- **Funcionalidade**:
  - Busca rápida por número do pedido ou nota.
  - Visualização clara dos itens pendentes.
  - Registro de entrada física com validação de quantidade.
    - Campos de quantidade aceitam valores decimais (ex.: 1,25), permitindo unidades fracionadas.
    - O sistema bloqueia valores negativos e quantidades que excedam o saldo do pedido.
  - Upload de fotos/comprovantes (se configurado).

---

## 🚨 Solução de Problemas (Troubleshooting)

### Recebimento Físico
**Problema**: "Não consigo digitar a quantidade no recebimento."
**Causa**: O item já foi totalmente recebido.
**Solução**: Verifique a coluna "Recebido Anteriormente". O sistema bloqueia entradas que excedam a quantidade pedida para evitar erros de estoque. Se houver erro no pedido, reporte uma divergência.

### Conferência Fiscal
**Problema**: "Erro na integração com ERP ao confirmar conferência fiscal."
**Causa**: Falha de comunicação ou dados inválidos (ex: CNPJ fornecedor não cadastrado no ERP).
**Solução**: Verifique o log de erro exibido na tela (box vermelho). Corrija os dados (ex: data de vencimento, parcelas) e clique em "Reenviar ao ERP". Se o erro for de conexão, aguarde e tente novamente.

**Problema**: "Botão de confirmar fiscal desabilitado."
**Causa**: Campos obrigatórios financeiros não preenchidos.
**Solução**: Acesse a aba "Financeiro" e preencha a Forma de Pagamento, Data de Vencimento e Parcelas.

### Acesso e Permissões
**Problema**: "Não vejo o botão de aprovar."
**Causa**: Seu usuário não tem permissão para o Centro de Custo da solicitação ou o valor excede sua alçada (para aprovação simples).
**Solução**: Verifique com o administrador se seu usuário está associado corretamente aos Centros de Custo.

---

## 📞 Suporte e Contato

Para problemas técnicos não listados acima ou solicitações de acesso:
- **Administrador do Sistema**: Responsável por usuários e configurações.
- **Suporte Técnico**: Para erros de sistema e falhas de integração.

---
*Versão do Manual: 2.0 - Atualizado em Janeiro/2026*
