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
15. [Configuração de Aprovação por Valor](#-configuração-de-aprovação-por-valor)
16. [Uso em Dispositivos Móveis](#-uso-em-dispositivos-móveis)
17. [Sistema de Notificações](#-sistema-de-notificações)
18. [Visualização Pública da Solicitação](#-visualização-pública-da-solicitação)
19. [Solução de Problemas (Troubleshooting)](#-solução-de-problemas-troubleshooting)
20. [Auditoria e Controles Internos](#-auditoria-e-controles-internos)
21. [Dicas e Boas Práticas](#-dicas-e-boas-práticas)
22. [Métricas e Indicadores](#-métricas-e-indicadores)
23. [Fluxo Completo - Exemplo Prático](#-fluxo-completo---exemplo-prático)
24. [Suporte e Contato](#-suporte-e-contato)

---

## 🎯 Bem-vindo ao Sistema de Gestão de Compras

Este manual irá guiá-lo através de todas as funcionalidades do sistema, desde o primeiro acesso até a conclusão completa de um processo de compra. O sistema foi atualizado para incluir **9 fases de controle**, garantindo maior rigor fiscal, integração com ERP e conformidade com as políticas da empresa.

### O que há de novo nesta versão:
- **Fase de Conferência Fiscal**: Nova etapa dedicada à validação fiscal e financeira.
- **Integração com ERP**: Logs de envio e status de integração em tempo real.
- **Validação Estrita de Recebimento**: Controle rigoroso de quantidades no recebimento físico (bloqueio de excessos).
- **Novos Relatórios**: Análise de Itens Comprados, Consulta de Notas Fiscais (Invoices) e Performance de Fornecedores.
- **Página de Conferência de Material**: Interface dedicada para a equipe de almoxarifado/logística.

---

## 📜 Políticas e Diretrizes de Compras

### 🎯 Objetivo da Política

A Blomaq Locação de Equipamentos e Imóveis Ltda. estabelece diretrizes, critérios e procedimentos para as compras de materiais e serviços, visando assegurar:

- **Eficiência** no processo de aquisições
- **Controle** rigoroso das operações
- **Economicidade** na aplicação de recursos
- **Qualidade** dos produtos e serviços adquiridos
- **Transparência** em todas as etapas e rastreabilidade total
- **Conformidade** com as obrigações fiscais e tributárias

### 🏛️ Estrutura de Aprovações e Alçadas

#### Níveis de Aprovação por Valor (Configurável)

**📊 Limite configurável:**
- O valor limite para dupla aprovação é definido pelo Administrador (Valor padrão atual: **R$ 2.500,00**).
- Página: Menu → Configurações → Aprovação por Valor.

**🟢 Aprovação Simples (≤ limite):**
- Requer apenas aprovação do nível **A2**.
- Critério: Revisão comercial e financeira padrão.

**🟠 Dupla Aprovação (> limite):**
- Requer aprovação sequencial: primeiro de um **Diretor** e depois do **CEO**.
- O sistema impõe automaticamente este fluxo quando o valor total excede o limite.

#### Aprovação A1 (Técnica/Gerencial)
- **Responsabilidade**: Aprovadores designados por centro de custo (Gerentes).
- **Critério**: Validação da necessidade técnica, especificações e disponibilidade orçamentária.
- **Restrição**: Limitado estritamente aos centros de custo associados ao usuário.

#### Aprovação A2 (Financeira/Diretoria)
- **Responsabilidade**: Aprovadores com visão ampla (CFO/CEO).
- **Critério**: Validação comercial, escolha do fornecedor, condições de pagamento e fluxo de caixa.
- **Opções**: Aprovar, Arquivar (cancelar definitivamente) ou Solicitar Nova Cotação (retorna ao comprador).

### 💳 Regras de Pagamento e Fornecedores
- **Cotação Obrigatória**: É mandatório realizar cotação (mínimo de 3 fornecedores recomendados) para garantir competitividade.
- **Regularidade Fiscal**: Apenas fornecedores com documentação em dia devem ser cadastrados.
- **Documentação**: Nota fiscal é obrigatória para todos os pagamentos.

---

## 🚀 Primeiros Passos

### Acessando o Sistema
1. **Abra seu navegador** e acesse o endereço do sistema.
2. **Login**: Digite seu usuário/email e senha fornecidos pelo administrador.
3. **Primeiro Acesso**: Recomendamos alterar sua senha imediatamente em **Perfil** → **Alterar Senha**.

### Recuperação de Senha
- Na tela de login, clique em "Esqueci minha senha".
- Digite seu e-mail cadastrado para receber o link de redefinição.

---

## 🏠 Navegação Principal

O sistema utiliza um menu superior intuitivo. As principais seções são:

- **Kanban de Compras**: Visão geral de todas as solicitações em andamento, organizadas por fases.
- **Gestão de Solicitações**: Lista detalhada em formato de tabela com filtros avançados e busca.
- **Conferência de Material**: Área dedicada para recebimento físico (Almoxarifado).
- **Relatórios**: Acesso aos relatórios de itens, notas fiscais, fornecedores e solicitações.
- **Cadastros**: Gestão de Empresas, Fornecedores, Usuários, Departamentos e Locais de Entrega.
- **Configurações**: Ajustes de sistema e alçadas de aprovação (Admin).

---

## 🔄 Workflow de Compras - Guia Completo

O sistema utiliza um workflow Kanban com **9 fases sequenciais**. Cada fase possui regras de negócio, validações e responsáveis específicos.

### 📝 Fase 1: Solicitação
- **Objetivo:** Formalizar a necessidade de compra de produtos ou serviços para a empresa.
- **Ações do Solicitante:**
  - Justificar a necessidade da compra.
  - Selecionar o Centro de Custo apropriado.
  - Selecionar o tipo de categoria de Produto: Produto, Serviço, Material ou Outro.
  - Preencher formulário com descrição detalhada dos itens.
    - Para tipo Produto, o usuário selecionará um item do sistema ERP e o sistema automaticamente preencherá as informações do item.
    - Para os demais tipos, o usuário preencherá manualmente as informações do item.
  - Indicar quantidade, unidade de medida e urgência.
- **Ações do Sistema:**
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
- **Ações do Sistema:**
  - Verificação de permissões por Centro de Custo.
  - Registro de log de aprovação (quem e quando).
  - Bloqueio de edição dos itens após aprovação.
- **Resultado Esperado:** Solicitação aprovada e encaminhada para o setor de compras.

### 💰 Fase 3: Cotação (RFQ)
- **Objetivo:** Obter os melhores preços e condições comerciais com fornecedores homologados.
- **Ações do Comprador:**
  - Selecionar fornecedores para envio de RFQ (Request for Quotation).
  - Registrar propostas recebidas (Preço, Prazo, Pagamento).
  - Fazer upload dos orçamentos (PDF/Imagem).
  - Selecionar o fornecedor vencedor e justificar a escolha.
- **Ações do Sistema:**
  - Cálculo automático do valor total por fornecedor.
  - Destaque visual para a melhor oferta (menor preço).
  - Validação de anexos obrigatórios antes de avançar.
- **Resultado Esperado:** Fornecedor definido e valores registrados para validação financeira.

### ✅ Fase 4: Aprovação A2 (Financeira)
- **Objetivo:** Validação final da diretoria/financeiro sobre os valores negociados e impacto no fluxo de caixa.
- **Ações do Aprovador:**
  - Analisar quadro comparativo de preços e fornecedor selecionado.
  - Verificar condições de pagamento.
  - **Aprovar:** Autoriza a compra.
  - **Nova Cotação:** Exige renegociação (retorna para fase 3).
  - **Arquivar:** Cancela a solicitação.
- **Ações do Sistema:**
  - Verificação de alçadas de valor (Aprovação Simples vs Dupla).
  - Encaminhamento para CEO se valor exceder limite configurado (Dupla Aprovação).
- **Resultado Esperado:** Compra autorizada financeiramente.

### 🛒 Fase 5: Pedido de Compra
- **Objetivo:** Oficializar o compromisso de compra junto ao fornecedor através de documento formal.
- **Ações do Comprador:**
  - Revisar dados finais de faturamento e entrega.
  - Gerar documento PDF do pedido (Purchase Order).
  - Enviar pedido ao fornecedor (E-mail/WhatsApp).
  - Confirmar envio no sistema.
- **Ações do Sistema:**
  - Geração de número sequencial de PO.
  - Criação de PDF com assinatura eletrônica interna e dados da empresa.
  - Disparo de e-mail automático (se configurado).
- **Resultado Esperado:** Pedido enviado ao fornecedor e aguardando entrega.

### 📦 Fase 6: Recebimento Físico
- **Objetivo:** Garantir que os produtos recebidos fisicamente correspondem exatamente ao que foi pedido.
- **Ações do Recebedor:**
  - Conferir mercadoria física vs Nota Fiscal e Pedido.
  - Informar quantidade recebida para cada item.
  - Anexar foto do canhoto ou mercadoria.
  - Reportar avarias ou divergências (gera pendência).
- **Ações do Sistema:**
  - **Validação Estrita:** Bloqueia entrada se Qtd Recebida > Qtd Pedida.
  - Controle de saldo parcial (permite múltiplas entregas até completar o pedido).
  - Atualização automática de status de estoque.
- **Resultado Esperado:** Entrada física confirmada e registrada no sistema.

### 📋 Fase 7: Conferência Fiscal
- **Objetivo:** Validação tributária, lançamento da Nota Fiscal e integração com o sistema ERP.
- **Ações do Fiscal:**
  - Importar XML da NF-e ou digitar chave de acesso.
  - Conferir impostos, valores totais e dados cadastrais.
  - Preencher dados financeiros (Vencimento, Parcelas, Forma de Pagamento).
  - Confirmar integração.
- **Ações do Sistema:**
  - Leitura automática de dados do XML (quando disponível).
  - Envio de dados via API para o ERP externo.
  - Validação de consistência (Soma dos itens = Total NF).
  - Exibição de logs de erro/sucesso da integração em tempo real.
- **Resultado Esperado:** Nota fiscal lançada no ERP, contas a pagar gerado e estoque fiscal atualizado.

### 🏁 Fase 8: Conclusão
- **Objetivo:** Revisão final e consolidação de todos os documentos do processo para auditoria.
- **Ações do Usuário:**
  - Visualizar resumo executivo do processo.
  - Baixar "Kit de Auditoria" (Zip com todos os docs: Pedido, Cotações, NFs, Comprovantes).
  - Clicar em "Arquivar Processo".
- **Ações do Sistema:**
  - Compilação da timeline completa.
  - Verificação de pendências finais.
- **Resultado Esperado:** Processo validado e pronto para arquivamento definitivo.

### 🗃️ Fase 9: Arquivado
- **Objetivo:** Manter um registro histórico seguro e imutável para fins de auditoria e consulta futura.
- **Ações do Usuário:**
  - Consulta em modo somente leitura.
  - Recuperação de histórico.
- **Ações do Sistema:**
  - Garantia de integridade dos dados (bloqueio total de edição).
  - Indexação para busca rápida em relatórios.
- **Resultado Esperado:** Registro histórico preservado e seguro.

---

## 🏭 Gestão de Fornecedores

### Acessando Fornecedores
**Menu** → **Fornecedores** (disponível para Compradores e Administradores).

### Cadastrando Novo Fornecedor
1. Clique em **"Novo Fornecedor"**.
2. **Dados Obrigatórios**:
   - **Nome/Razão Social**: Identificação legal.
   - **CNPJ**: O sistema realiza validação de formato.
   - **E-mail**: Fundamental para o envio de RFQs e Pedidos.
3. **Dados Opcionais**: Endereço, Telefone, Condições de Pagamento Padrão.

### Funcionalidades
- **Edição**: Atualize dados de contato ou endereço.
- **Exclusão**: Fornecedores com histórico de cotações não podem ser excluídos para manter integridade dos dados (podem ser desativados).

---

## 👥 Gestão de Usuários

### Níveis de Permissão
- **Comprador**: Gerencia cotações (Fase 3) e pedidos (Fase 5).
- **Aprovador A1**: Aprova solicitações de seus Centros de Custo (Fase 2).
- **Aprovador A2**: Aprovações financeiras/diretoria (Fase 4).
- **Recebedor**: Realiza conferência física (Fase 6) e fiscal (Fase 7).
- **Gerente**: Acesso a Dashboards e relatórios gerenciais.
- **Administrador**: Acesso total a configurações e cadastros.

### Associação de Centros de Custo
Para **Aprovadores A1**, é obrigatório associar os Centros de Custo que eles podem aprovar.
1. Edite o usuário.
2. Na aba "Centros de Custo", selecione as opções permitidas.

---

## 🏢 Gestão de Empresas e Departamentos

### Estrutura Organizacional
O sistema permite multi-empresas e estrutura hierárquica:
**Empresa** → **Departamentos** → **Centros de Custo**.

- **Empresas**: Cadastro com CNPJ, Logo (usada nos pedidos) e endereço.
- **Locais de Entrega**: Endereços físicos onde os materiais podem ser entregues. Essencial para logística.
- **Departamentos/Centros de Custo**: Unidades orçamentárias. Cada solicitação deve ser vinculada a um Centro de Custo.

---

## 📊 Dashboard (Gerentes)

Visão executiva para tomada de decisão.
- **Métricas**: Solicitações por Status, Tempo Médio de Processo, Volume por Período.
- **Filtros**: Por empresa, departamento ou período (30/60/90 dias).

---

## 📈 Relatórios Avançados

O sistema conta com uma suíte de relatórios para análise gerencial e operacional:

### 1. Análise de Itens Comprados
- **Caminho**: Menu → Relatórios → Análise de Itens.
- **Objetivo**: Histórico de preços, volatilidade e volume de compras por item.
- **Dados**: Preço médio, mínimo, máximo, total gasto e fornecedores por item.

### 2. Consulta de Notas Fiscais (Invoices)
- **Caminho**: Menu → Relatórios → Invoices.
- **Objetivo**: Listagem fiscal de todas as notas registradas.
- **Status**: Monitoramento da integração com ERP (Pendente, Integrado, Erro).
- **Ações**: Visualização de detalhes e exportação.

### 3. Relatório de Solicitações
- **Caminho**: Menu → Relatórios → Solicitações.
- **Objetivo**: Acompanhamento de status, tempos de aprovação e gargalos do processo.
- **Exportação**: CSV disponível para análise externa.

### 4. Relatório de Fornecedores
- **Caminho**: Menu → Relatórios → Fornecedores.
- **Objetivo**: Avaliação de performance e volume de compras por parceiro.

---

## 📦 Conferência de Material (Recebimento)

Interface simplificada e dedicada para operadores de logística e almoxarifado.
- **Foco**: Apenas recebimento físico, sem a complexidade visual do Kanban.
- **Busca**: Rápida por número do pedido ou nota fiscal.
- **Ação**: Registro de entrada com validação de quantidade e upload de fotos/comprovantes.

---

## 🔧 Configurações Pessoais

- **Perfil**: Atualize nome, e-mail e telefone.
- **Alterar Senha**: Recomendado periodicamente.
- **Recuperação**: Via e-mail na tela de login.

---

## ⚙️ Configuração de Aprovação por Valor

Recurso exclusivo para Administradores definirem a política de alçadas.
- **Limite de Valor**: Define o teto para Aprovação Simples (apenas A2).
- **Regra**: Solicitações acima deste valor exigem fluxo de Dupla Aprovação (Diretor + CEO).
- **Justificativa**: Obrigatória para qualquer alteração no limite, garantindo auditoria.

---

## 📱 Uso em Dispositivos Móveis

O sistema é totalmente responsivo (Web App).
- **Kanban Mobile**: Visualização adaptada em lista ou colunas deslizáveis.
- **Aprovações**: Gestores podem aprovar/reprovar facilmente pelo celular.
- **Upload**: Tire fotos de notas ou produtos direto da câmera do celular durante o recebimento.

---

## 🔔 Sistema de Notificações

O sistema envia e-mails automáticos para manter os envolvidos informados:
- **Nova Solicitação**: Para Aprovadores A1 do centro de custo.
- **Aprovação A1 Realizada**: Para Compradores (iniciar cotação).
- **Aprovação A2 Realizada**: Para Compradores (gerar pedido).
- **Pedido Enviado**: Para Recebedores (aguardar entrega).
- **Reprovação**: Para o Solicitante (com motivo).
- **Integração ERP**: Alertas de falha ou sucesso na conferência fiscal.

---

## 🔓 Visualização Pública da Solicitação

Recurso para compartilhamento externo e transparência.
- **Acesso**: Via QR Code ou Link gerado na solicitação.
- **Conteúdo**: Status atual, itens (sem valores sensíveis se configurado), e timeline básica.
- **Utilidade**: Permitir que solicitantes sem acesso total acompanhem seus pedidos.

---

## 🚨 Solução de Problemas (Troubleshooting)

### Recebimento Físico
**Problema**: "Não consigo digitar a quantidade no recebimento."
**Causa**: O item já foi totalmente recebido ou a quantidade excede o pedido.
**Solução**: Verifique a coluna "Recebido Anteriormente". O sistema bloqueia entradas excedentes. Se houver erro no pedido original, reporte uma divergência.

### Conferência Fiscal e ERP
**Problema**: "Erro na integração com ERP ao confirmar conferência fiscal."
**Causa**: Falha de conexão ou dados inválidos (ex: CNPJ não cadastrado no ERP).
**Solução**: Verifique o log de erro (box vermelho). Corrija os dados (vencimento, parcelas) e clique em "Reenviar ao ERP".

**Problema**: "Botão de confirmar fiscal desabilitado."
**Causa**: Campos financeiros obrigatórios não preenchidos.
**Solução**: Acesse a aba "Financeiro" e preencha Forma de Pagamento, Vencimento e Parcelas.

### Acesso e Permissões
**Problema**: "Não vejo o botão de aprovar."
**Causa**: Usuário sem permissão para o Centro de Custo específico.
**Solução**: Contate o administrador para ajustar a associação de Centros de Custo no seu perfil.

### Upload de Arquivos
**Problema**: "Erro ao enviar anexo."
**Solução**: Verifique se o arquivo é suportado (PDF, JPG, PNG, DOCX, XLS) e se tem menos de 10MB.

---

## 🔍 Auditoria e Controles Internos

### Rastreabilidade Completa
- **Log de Ações**: Registro imutável de quem fez o quê e quando.
- **Versionamento**: Histórico de alterações em cotações e pedidos.
- **Trilha de Aprovação**: Registro claro de todos os aprovadores envolvidos.

### Segregação de Funções (SoD)
- Solicitantes não aprovam suas próprias requisições.
- Aprovadores A1 restritos aos seus centros de custo.
- Compradores não podem realizar aprovações financeiras (A2).
- Recebimento físico e fiscal separados para maior controle.

### Compliance
- Validação automática de políticas de alçada.
- Bloqueio de pagamentos sem nota fiscal (via integração ERP).
- Obrigatoriedade de cotação mínima (auditada no sistema).

---

## 💡 Dicas e Boas Práticas

- **Solicitantes**: Detalhem bem as especificações técnicas para evitar dúvidas e devoluções. Usem a urgência "Alta" com parcimônia.
- **Aprovadores**: Verifiquem o saldo orçamentário antes de aprovar. Usem o campo de observações para orientar correções.
- **Compradores**: Mantenham o cadastro de fornecedores atualizado. Anexem todas as propostas recebidas, não apenas a vencedora.
- **Recebedores**: Tirem fotos de avarias ou embalagens danificadas no ato do recebimento.

---

## 📊 Métricas e Indicadores

O sistema monitora automaticamente:
- **SLA de Atendimento**: Tempo médio em cada fase.
- **Savings**: Comparativo entre preço orçado e preço comprado.
- **Volumetria**: Quantidade de solicitações por departamento/centro de custo.

---

## 🔄 Fluxo Completo - Exemplo Prático

### Cenário: Compra de Computadores

1.  **Solicitação (João/TI)**: Cria solicitação de 5 Desktops. Anexa especificação técnica.
2.  **Aprovação A1 (Maria/Gerente TI)**: Recebe e-mail, valida necessidade técnica e aprova.
3.  **Cotação (Carlos/Compras)**: Envia RFQ para 3 fornecedores. Recebe propostas. Seleciona Fornecedor B (Melhor preço).
4.  **Aprovação A2 (Ana/Diretora)**: Valor acima de R$ 2.500 (Exemplo). Sistema exige dupla aprovação. Ana aprova primeira etapa.
5.  **Aprovação A2 Final (Bruno/CEO)**: Aprova compra final.
6.  **Pedido (Carlos/Compras)**: Gera PDF do pedido e envia ao fornecedor.
7.  **Recebimento (Pedro/Almoxarifado)**: Recebe equipamentos fisicamente. Confere quantidade (5/5). Anexa foto.
8.  **Conferência Fiscal (Julia/Fiscal)**: Recebe NF. Lança chave de acesso. Confere impostos. Integra com ERP (Gera contas a pagar).
9.  **Conclusão**: Sistema exibe timeline completa. Usuário arquiva o processo.
10. **Arquivado**: Processo disponível apenas para consulta histórica.

---

## 📞 Suporte e Contato

### Quando contatar o suporte?
- Erros de sistema ("Bug").
- Falhas na integração com ERP.
- Problemas de acesso ou permissão.

### Informações necessárias
- Print da tela do erro.
- Número da solicitação (ex: SOL-2024-123).
- Descrição do passo-a-passo para reproduzir o erro.

---
*Manual do Usuário Consolidado - Versão 2.1 - Atualizado em Janeiro/2026*
