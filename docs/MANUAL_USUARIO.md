# 📖 Manual do Usuário - Sistema de Gestão de Compras

## 🎯 Bem-vindo ao Sistema de Gestão de Compras

Este manual irá guiá-lo através de todas as funcionalidades do sistema, desde o primeiro acesso até a conclusão completa de um processo de compra.

---

## 🚀 Primeiros Passos

### Acessando o Sistema

1. **Abra seu navegador** e acesse o endereço do sistema
2. **Tela de Login**: Digite seu usuário/email e senha
3. **Esqueceu a senha?**: Clique em "Esqueci minha senha" para redefinir

### Primeiro Acesso
- Você receberá suas credenciais do administrador do sistema
- É recomendado alterar sua senha no primeiro acesso
- Acesse **Perfil** → **Alterar Senha** para definir uma nova senha

---

## 🏠 Navegação Principal

### Menu Superior
O sistema possui um menu superior com as seguintes opções:

#### 🏢 **Processo de Compras** (Kanban)
- Visualização principal do sistema
- Mostra todas as solicitações em formato Kanban
- Permite arrastar cards entre as fases

#### 📊 **Dashboard** (Apenas Gerentes)
- Métricas e indicadores do sistema
- Gráficos de performance
- Relatórios executivos

#### 📋 **Gestão de Solicitações**
- Lista completa de solicitações
- Filtros avançados
- Busca por número ou descrição

#### 🏭 **Empresas** (Apenas Administradores)
- Cadastro e gestão de empresas
- Upload de logos
- Dados corporativos

#### 🚚 **Fornecedores** (Compradores e Administradores)
- Cadastro de fornecedores
- Dados de contato e condições
- Histórico de cotações

#### 👥 **Usuários**
- Gestão de usuários do sistema
- Permissões e roles
- Associação com departamentos

#### 🏢 **Departamentos**
- Estrutura organizacional
- Centros de custo
- Hierarquia empresarial

#### 📍 **Locais de Entrega**
- Endereços para entrega
- Contatos e observações
- Ativação/desativação

---

## 🔄 Workflow de Compras - Guia Completo

O sistema utiliza um workflow Kanban com 8 fases fixas. Cada fase tem responsáveis específicos e ações permitidas.

### 📝 Fase 1: Solicitação

#### Quem pode usar: Todos os usuários autenticados

#### Como criar uma nova solicitação:

1. **Clique no botão "+" flutuante** (canto inferior direito) ou
2. **Menu** → **Nova Solicitação**

#### Preenchendo o formulário:

**📋 Dados Obrigatórios:**
- **Empresa**: Selecione a empresa (geralmente pré-selecionada)
- **Centro de Custo**: Escolha o centro de custo apropriado
- **Categoria**: 
  - 🔧 **Produto**: Materiais físicos, equipamentos
  - 🛠️ **Serviço**: Manutenção, consultoria, treinamento
  - 📦 **Outros**: Demais necessidades
- **Urgência**:
  - 🟢 **Baixo**: Processo normal (15-30 dias)
  - 🟡 **Médio**: Necessidade moderada (7-15 dias)
  - 🔴 **Alto**: Urgente (até 7 dias)
- **Justificativa**: Explique detalhadamente a necessidade

**📦 Itens da Solicitação:**
Para cada item, informe:
- **Descrição**: Nome/descrição do produto/serviço
- **Unidade**: UN, KG, M², HR, etc.
- **Quantidade**: Quantidade necessária
- **Especificação Técnica**: Detalhes técnicos, marca preferida, normas

**📅 Dados Opcionais:**
- **Prazo Ideal de Entrega**: Quando você precisa receber
- **Orçamento Disponível**: Valor estimado/limite
- **Informações Adicionais**: Observações extras

#### Dicas importantes:
- ✅ Seja específico nas especificações técnicas
- ✅ Justifique adequadamente a necessidade
- ✅ Verifique se o centro de custo está correto
- ✅ Revise todos os dados antes de enviar

#### Após criar a solicitação:
- O sistema gera um **número único** (ex: SOL-2025-001)
- A solicitação aparece na fase "Solicitação" do Kanban
- **Aprovadores A1** recebem notificação por e-mail
- Você pode **editar** a solicitação enquanto estiver nesta fase

### ✅ Fase 2: Aprovação A1

#### Quem pode usar: Usuários com permissão "Aprovador A1"

#### Restrições importantes:
- Aprovadores A1 só veem solicitações dos **centros de custo associados** ao seu perfil
- Não é possível aprovar solicitações de outros centros de custo

#### Como aprovar/reprovar:

1. **Acesse o Kanban** e localize a solicitação na coluna "Aprovação A1"
2. **Clique no card** para ver os detalhes
3. **Revise cuidadosamente**:
   - Justificativa da necessidade
   - Especificações técnicas dos itens
   - Orçamento disponível
   - Urgência solicitada

#### Opções disponíveis:

**✅ Aprovar:**
- Clique em **"Aprovar"**
- A solicitação move automaticamente para **"Cotação"**
- **Compradores** recebem notificação
- Histórico de aprovação é registrado

**❌ Reprovar:**
- Clique em **"Reprovar"**
- **Obrigatório**: Informe o motivo da reprovação
- A solicitação volta para **"Solicitação"**
- Solicitante recebe notificação com o motivo
- Solicitante pode corrigir e reenviar

#### Dicas para aprovadores A1:
- ✅ Verifique se a necessidade está bem justificada
- ✅ Confirme se o centro de custo está correto
- ✅ Avalie se a urgência é adequada
- ✅ Seja específico nos motivos de reprovação

### 💰 Fase 3: Cotação (RFQ)

#### Quem pode usar: Usuários com permissão "Comprador"

Esta é uma das fases mais importantes do processo, onde são obtidas as propostas dos fornecedores.

#### Criando uma RFQ (Request for Quotation):

1. **Clique no card** da solicitação na coluna "Cotação"
2. **Clique em "Criar Solicitação de Cotação"**

#### Preenchendo a RFQ:

**📋 Dados da Cotação:**
- **Número da Cotação**: Gerado automaticamente
- **Local de Entrega**: Selecione onde o material deve ser entregue
- **Prazo para Cotação**: Data limite para fornecedores responderem
- **Termos e Condições**: Condições gerais da cotação
- **Especificações Técnicas**: Detalhes técnicos consolidados

**🏭 Seleção de Fornecedores:**
- Marque os fornecedores que devem receber a RFQ
- Mínimo: 1 fornecedor
- Recomendado: 3 ou mais para competitividade

#### Enviando a RFQ:

1. **Clique em "Enviar RFQ para Fornecedores"**
2. O sistema envia **automaticamente** e-mails para todos os fornecedores selecionados
3. E-mail contém:
   - Dados da empresa
   - Detalhes da cotação
   - Itens solicitados
   - Prazo de resposta
   - Instruções para envio da proposta

#### Recebendo e Analisando Propostas:

**📄 Upload de Propostas:**
- Fornecedores enviam propostas por e-mail
- Comprador faz upload dos arquivos no sistema
- Tipos aceitos: PDF, DOC, DOCX, XLS, XLSX, TXT, PNG, JPG
- Limite: 10MB por arquivo

**📊 Análise Comparativa:**
- Compare preços, prazos e condições
- Avalie qualidade técnica das propostas
- Considere histórico do fornecedor
- Negocie melhorias se necessário

**🏆 Seleção do Vencedor:**
- Marque o fornecedor escolhido
- Informe o motivo da escolha:
  - Melhor preço
  - Melhor prazo
  - Melhor qualidade
  - Melhor relacionamento
  - Outros motivos
- Registre valor negociado
- Informe descontos obtidos

#### Funcionalidades Especiais:

**🔄 Nova RFQ:**
- Se necessário, crie uma nova versão da RFQ
- Útil quando A2 reprova e solicita recotação
- Mantém histórico de todas as versões

**📚 Histórico de RFQs:**
- Visualize todas as versões criadas
- Compare resultados entre versões
- Auditoria completa do processo

**🏷️ Badge "Nec.Cotação":**
- Aparece quando A2 reprova e solicita nova cotação
- Indica que é necessária uma recotação
- Prioridade no atendimento

#### Finalizando a Cotação:
- Após selecionar o vencedor, a solicitação está pronta para A2
- Clique em **"Enviar para Aprovação A2"**
- **Aprovadores A2** recebem notificação

### ✅ Fase 4: Aprovação A2

#### Quem pode usar: Usuários com permissão "Aprovador A2"

Esta é a aprovação final antes da geração do pedido de compra.

#### Como aprovar/reprovar:

1. **Clique no card** na coluna "Aprovação A2"
2. **Revise detalhadamente**:
   - Resultado da cotação
   - Fornecedor selecionado
   - Valores negociados
   - Justificativa da escolha
   - Condições de pagamento

#### Opções disponíveis:

**✅ Aprovar:**
- Clique em **"Aprovar"**
- A solicitação move para **"Pedido de Compra"**
- **Compradores** recebem notificação
- Processo pode prosseguir

**❌ Reprovar com duas opções:**

**1. 🗃️ Arquivar Definitivamente:**
- Use quando a necessidade não é mais válida
- Solicitação vai direto para **"Arquivado"**
- Processo é encerrado

**2. 🔄 Retornar para Nova Cotação:**
- Use quando cotação precisa ser refeita
- Solicitação volta para **"Cotação"**
- Badge "Nec.Cotação" aparece no card
- Comprador deve criar nova RFQ

#### Dicas para aprovadores A2:
- ✅ Avalie se o fornecedor escolhido é adequado
- ✅ Verifique se os valores estão dentro do orçamento
- ✅ Confirme se as condições são favoráveis
- ✅ Considere o histórico do fornecedor

### 📋 Fase 5: Pedido de Compra

#### Quem pode usar: Usuários com permissão "Comprador"

Nesta fase é gerado o pedido oficial de compra.

#### Funcionalidades disponíveis:

**📄 Visualização do Pedido:**
- PDF é gerado automaticamente
- Contém todos os dados da empresa
- Logo da empresa (se cadastrado)
- Dados completos do fornecedor
- Itens com preços e especificações
- Assinaturas eletrônicas com datas

**📝 Observações do Pedido:**
- Campo para observações específicas
- Instruções especiais para o fornecedor
- Condições particulares
- Informações de entrega

**🖨️ Ações disponíveis:**
- **Visualizar PDF**: Abre o pedido em nova janela
- **Baixar PDF**: Download do arquivo
- **Editar Observações**: Adicionar/alterar observações
- **Avançar para Recebimento**: Confirma envio do pedido

#### Dados incluídos no PDF:

**🏢 Dados da Empresa:**
- Logo (se cadastrado)
- Nome e razão social
- CNPJ e endereço
- Telefone e e-mail

**🏭 Dados do Fornecedor:**
- Nome e CNPJ
- Endereço e contatos
- Condições de pagamento
- Prazo de entrega

**📦 Itens do Pedido:**
- Código e descrição
- Quantidade e unidade
- Preço unitário e total
- Marca (se informada)

**✍️ Assinaturas Eletrônicas:**
- Solicitante (Comprador)
- Liberador (Aprovador A2)
- Datas e horários automáticos

#### Finalizando o Pedido:
- Após revisar, clique em **"Avançar para Recebimento"**
- **Recebedores** são notificados
- PDF final é gerado e arquivado

### 📦 Fase 6: Recebimento

#### Quem pode usar: Usuários com permissão "Recebedor"

Fase de recebimento e conferência dos materiais.

#### Informações disponíveis:

**📋 Dados do Pedido:**
- Número do pedido
- Fornecedor e dados de contato
- Itens solicitados
- Prazos de entrega
- **Observações do Pedido**: Destacadas em azul

**📊 Status do Recebimento:**
- Pendente
- Recebido parcialmente
- Recebido completamente
- Com pendências

#### Ações disponíveis:

**✅ Confirmar Recebimento:**
- Material recebido conforme pedido
- Qualidade aprovada
- Quantidades corretas
- Move para **"Conclusão"**

**⚠️ Registrar Pendência:**
- Material não conforme
- Quantidades incorretas
- Problemas de qualidade
- Atraso na entrega
- **Obrigatório**: Descrever o problema
- Retorna para **"Pedido de Compra"**
- Badge "Pendência" aparece no card

#### Controle de Qualidade:
- ✅ Confira se os itens estão conforme especificação
- ✅ Verifique quantidades
- ✅ Teste funcionalidades (se aplicável)
- ✅ Documente problemas encontrados

### 🎯 Fase 7: Conclusão de Compra

#### Quem pode acessar: Todos os usuários (visualização)

Fase final com resumo completo do processo.

#### Informações exibidas:

**📊 Métricas do Processo:**
- **Tempo Total**: Dias desde a criação
- **Valor Total**: Soma de todos os itens
- **Fornecedor Selecionado**: Dados do vencedor

**👤 Dados do Processo:**
- **Solicitante**: Quem criou a solicitação
- **Centro de Custo**: Onde será debitado
- **Departamento**: Área solicitante

**📈 Timeline Completa:**
- Histórico de todas as fases
- Usuários responsáveis por cada ação
- Datas e horários precisos
- Motivos de reprovações (se houver)

**📎 Anexos Disponíveis:**
- **Anexos da Solicitação**: Documentos iniciais
- **Anexos de Cotações**: Propostas dos fornecedores
- Download individual de cada arquivo

**🖨️ Função de Impressão:**
- Gera relatório completo para impressão
- Inclui todas as informações da tela
- Layout otimizado para papel

#### Finalizando:
- Clique em **"Arquivar"** para mover para a fase final
- Processo é considerado concluído

### 🗃️ Fase 8: Arquivado

#### Acesso: Somente leitura para auditoria

- Processos finalizados
- Dados preservados para histórico
- Consulta para auditoria
- Relatórios e estatísticas

---

## 🏭 Gestão de Fornecedores

### Acessando Fornecedores
**Menu** → **Fornecedores** (disponível para Compradores e Administradores)

### Cadastrando Novo Fornecedor

1. **Clique em "Novo Fornecedor"**
2. **Preencha os dados obrigatórios:**
   - **Nome**: Razão social do fornecedor
   - **CNPJ**: Validação automática
   - **Contato**: Pessoa responsável
   - **E-mail**: Para recebimento de RFQs
   - **Telefone**: Contato direto

3. **Dados opcionais:**
   - **Endereço**: Endereço completo
   - **Condições de Pagamento**: Ex: "30/60/90 dias"
   - **Produtos/Serviços**: Descrição do que oferece

### Editando Fornecedores
- Clique no ícone de edição
- Altere os dados necessários
- Salve as alterações

### Excluindo Fornecedores
- Clique no ícone de lixeira
- Confirme a exclusão
- **Atenção**: Não é possível excluir fornecedores com cotações ativas

---

## 👥 Gestão de Usuários

### Acessando Usuários
**Menu** → **Usuários**

### Criando Novo Usuário

1. **Clique em "Novo Usuário"**
2. **Dados pessoais:**
   - **Nome de usuário**: Login único
   - **E-mail**: E-mail válido
   - **Nome** e **Sobrenome**
   - **Senha**: Mínimo 6 caracteres

3. **Associações:**
   - **Empresa**: Selecione a empresa
   - **Departamento**: Departamento do usuário

4. **Permissões** (marque as aplicáveis):
   - ☑️ **Comprador**: Pode gerenciar cotações e pedidos
   - ☑️ **Aprovador A1**: Primeira aprovação
   - ☑️ **Aprovador A2**: Segunda aprovação
   - ☑️ **Administrador**: Acesso total ao sistema
   - ☑️ **Gerente**: Acesso a dashboards
   - ☑️ **Recebedor**: Pode receber materiais

### Editando Usuários
- Clique no ícone de edição
- Altere dados e permissões
- **Não é possível alterar**: Username (após criação)

### Associando Centros de Custo (Aprovadores A1)
- Usuários com permissão "Aprovador A1" devem ter centros de custo associados
- Clique em "Editar" → "Centros de Custo"
- Selecione os centros que o usuário pode aprovar

---

## 🏢 Gestão de Empresas (Administradores)

### Cadastrando Nova Empresa

1. **Menu** → **Empresas** → **"Nova Empresa"**
2. **Dados obrigatórios:**
   - **Nome**: Razão social
   - **Nome Fantasia**: Nome comercial
   - **CNPJ**: Validação automática

3. **Dados de contato:**
   - **Endereço**: Endereço completo
   - **Telefone** e **E-mail**

4. **Logo da empresa:**
   - Clique em "Selecionar arquivo"
   - Formatos: PNG, JPG, JPEG
   - Tamanho máximo: 5MB
   - Logo é convertida para base64 automaticamente

### Ativando/Desativando Empresas
- Use o switch "Ativa" para ativar/desativar
- Empresas inativas não aparecem em formulários
- Dados são preservados para auditoria

---

## 📍 Gestão de Locais de Entrega

### Cadastrando Local de Entrega

1. **Menu** → **Locais de Entrega** → **"Novo Local"**
2. **Dados obrigatórios:**
   - **Nome**: Identificação do local
   - **Endereço**: Endereço completo

3. **Dados opcionais:**
   - **Pessoa de Contato**: Responsável no local
   - **Telefone** e **E-mail**
   - **Observações**: Instruções especiais

### Ativando/Desativando Locais
- Use o switch para ativar/desativar
- Locais inativos não aparecem em RFQs
- Filtro "Mostrar locais inativos" para reativação

---

## 🏢 Gestão de Departamentos

### Estrutura Organizacional
- **Empresas** → **Departamentos** → **Centros de Custo**
- Hierarquia bem definida
- Controle de permissões por nível

### Cadastrando Departamento
1. **Menu** → **Departamentos** → **"Novo Departamento"**
2. **Dados:**
   - **Nome**: Nome do departamento
   - **Descrição**: Função do departamento
   - **Empresa**: Empresa proprietária

### Cadastrando Centro de Custo
1. **Clique em "Novo Centro de Custo"**
2. **Dados:**
   - **Código**: Código único (ex: CC001)
   - **Nome**: Nome do centro
   - **Departamento**: Departamento pai

---

## 📊 Dashboard (Gerentes)

### Acessando o Dashboard
**Menu** → **Dashboard** (apenas usuários com permissão "Gerente")

### Métricas Disponíveis
- **Solicitações por Status**: Distribuição por fase
- **Tempo Médio de Processo**: Performance temporal
- **Volume por Período**: Tendências mensais
- **Taxa de Aprovação**: Eficiência do processo
- **Fornecedores Mais Utilizados**: Ranking de parceiros

### Filtros Disponíveis
- **Período**: Últimos 30, 60, 90 dias ou personalizado
- **Empresa**: Filtro por empresa específica
- **Departamento**: Filtro por departamento
- **Status**: Filtro por fase do processo

---

## 🔧 Configurações Pessoais

### Acessando o Perfil
**Menu do usuário** (canto superior direito) → **Perfil**

### Alterando Dados Pessoais
- **Nome** e **Sobrenome**
- **E-mail**: Usado para notificações
- **Telefone**: Contato opcional

### Alterando Senha
1. **Menu do usuário** → **Alterar Senha**
2. **Digite**:
   - Senha atual
   - Nova senha
   - Confirmação da nova senha
3. **Clique em "Alterar Senha"**

### Recuperação de Senha
1. **Tela de login** → **"Esqueci minha senha"**
2. **Digite seu e-mail**
3. **Verifique sua caixa de entrada**
4. **Clique no link recebido**
5. **Digite a nova senha**

---

## 📱 Uso em Dispositivos Móveis

### Design Responsivo
- Sistema otimizado para tablets e smartphones
- Layout adaptativo
- Navegação touch-friendly

### Funcionalidades Mobile
- ✅ Visualização do Kanban
- ✅ Criação de solicitações
- ✅ Aprovações A1 e A2
- ✅ Upload de arquivos
- ✅ Visualização de PDFs
- ✅ Notificações por e-mail

### Dicas para Mobile
- Use orientação paisagem para melhor visualização do Kanban
- Toque longo para acessar menus contextuais
- Deslize para navegar entre colunas

---

## 🔔 Sistema de Notificações

### Notificações Automáticas por E-mail

**📧 Quando você recebe notificações:**
- **Nova solicitação criada** (se você é Aprovador A1 do centro de custo)
- **Solicitação aprovada em A1** (se você é Comprador)
- **RFQ criada** (se você é Fornecedor selecionado)
- **Solicitação aprovada em A2** (se você é Comprador)
- **Pedido gerado** (se você é Recebedor)
- **Solicitação reprovada** (se você é o Solicitante)

**📧 Conteúdo das notificações:**
- Número da solicitação
- Dados básicos do processo
- Link direto para o sistema
- Instruções sobre próximos passos

### Configurações de E-mail
- Verifique se seu e-mail está correto no perfil
- Adicione o remetente do sistema à lista de contatos seguros
- Verifique a pasta de spam se não receber notificações

---

## 🚨 Solução de Problemas Comuns

### Problemas de Login
**❌ "Usuário ou senha incorretos"**
- Verifique se está digitando corretamente
- Use "Esqueci minha senha" se necessário
- Contate o administrador se persistir

**❌ "Sessão expirada"**
- Faça login novamente
- Sessões expiram após período de inatividade

### Problemas de Permissão
**❌ "Você não tem permissão para esta ação"**
- Verifique se tem a permissão necessária
- Contate o administrador para ajustar permissões

**❌ "Não vejo solicitações para aprovar"**
- Aprovadores A1: Verifique se tem centros de custo associados
- Contate o administrador para configurar

### Problemas de Upload
**❌ "Arquivo muito grande"**
- Limite máximo: 10MB
- Comprima o arquivo se necessário

**❌ "Tipo de arquivo não suportado"**
- Tipos aceitos: PDF, DOC, DOCX, XLS, XLSX, TXT, PNG, JPG
- Converta para um formato suportado

### Problemas de E-mail
**❌ "Não recebo notificações"**
- Verifique se o e-mail está correto no perfil
- Verifique pasta de spam
- Contate o administrador para verificar configurações

### Problemas de Performance
**❌ "Sistema lento"**
- Verifique sua conexão com a internet
- Feche outras abas do navegador
- Limpe cache do navegador

---

## 📞 Suporte e Contato

### Quando Contatar o Suporte
- Problemas técnicos persistentes
- Dúvidas sobre permissões
- Solicitação de novos usuários
- Configurações de empresa/departamento
- Problemas com notificações

### Informações para o Suporte
Ao entrar em contato, forneça:
- **Seu nome de usuário**
- **Descrição detalhada do problema**
- **Passos que levaram ao erro**
- **Mensagem de erro (se houver)**
- **Navegador utilizado**
- **Horário aproximado do problema**

### Administrador do Sistema
- Responsável por configurações gerais
- Criação de usuários e permissões
- Gestão de empresas e departamentos
- Resolução de problemas técnicos

---

## 💡 Dicas e Boas Práticas

### Para Solicitantes
- ✅ **Seja específico** nas especificações técnicas
- ✅ **Justifique adequadamente** a necessidade
- ✅ **Verifique o centro de custo** antes de enviar
- ✅ **Informe prazos realistas** de entrega
- ✅ **Revise todos os dados** antes de submeter

### Para Aprovadores A1
- ✅ **Analise a justificativa** cuidadosamente
- ✅ **Verifique se o centro de custo** está correto
- ✅ **Avalie a urgência** solicitada
- ✅ **Seja específico** nos motivos de reprovação
- ✅ **Aprove rapidamente** solicitações adequadas

### Para Compradores
- ✅ **Selecione fornecedores qualificados** para RFQ
- ✅ **Defina prazos adequados** para cotação
- ✅ **Analise todas as propostas** cuidadosamente
- ✅ **Negocie melhorias** quando possível
- ✅ **Documente a escolha** do fornecedor
- ✅ **Mantenha histórico** de todas as cotações

### Para Aprovadores A2
- ✅ **Avalie o fornecedor escolhido** e sua adequação
- ✅ **Verifique se os valores** estão dentro do orçamento
- ✅ **Confirme se as condições** são favoráveis
- ✅ **Considere o histórico** do fornecedor
- ✅ **Seja claro** nos motivos de reprovação

### Para Recebedores
- ✅ **Confira todos os itens** contra o pedido
- ✅ **Verifique quantidades** e especificações
- ✅ **Teste funcionalidades** quando aplicável
- ✅ **Documente problemas** detalhadamente
- ✅ **Comunique pendências** rapidamente

### Gerais
- ✅ **Mantenha dados atualizados** no perfil
- ✅ **Verifique e-mails regularmente** para notificações
- ✅ **Use comentários** para comunicação
- ✅ **Mantenha arquivos organizados** nos uploads
- ✅ **Faça backup** de documentos importantes

---

## 📈 Métricas e Indicadores

### Acompanhando Performance
- **Tempo médio de processo**: Meta < 15 dias úteis
- **Taxa de aprovação A1**: Ideal > 80%
- **Taxa de aprovação A2**: Ideal > 90%
- **Tempo de cotação**: Meta < 5 dias úteis

### Indicadores de Qualidade
- **Solicitações sem pendência**: Meta > 95%
- **Fornecedores que respondem RFQ**: Meta > 80%
- **Economia obtida em cotações**: Acompanhar tendência
- **Satisfação dos usuários**: Feedback contínuo

---

## 🔄 Fluxo Completo - Exemplo Prático

### Cenário: Compra de Computadores

**👤 João (Solicitante) - Departamento de TI**
1. Acessa o sistema e clica no botão "+"
2. Preenche:
   - Empresa: TechCorp Ltda
   - Centro de Custo: CC-TI-001
   - Categoria: Produto
   - Urgência: Médio
   - Justificativa: "Substituição de equipamentos obsoletos"
3. Adiciona itens:
   - Descrição: "Computador Desktop"
   - Quantidade: 5
   - Unidade: UN
   - Especificação: "Intel i5, 8GB RAM, SSD 256GB, Windows 11"
4. Submete a solicitação → **SOL-2025-015**

**✅ Maria (Aprovadora A1) - Gerente de TI**
1. Recebe e-mail de notificação
2. Acessa o Kanban e clica no card SOL-2025-015
3. Revisa a justificativa e especificações
4. Aprova a solicitação
5. Sistema move para "Cotação" e notifica compradores

**💰 Carlos (Comprador)**
1. Recebe notificação
2. Acessa a solicitação na coluna "Cotação"
3. Cria RFQ selecionando 3 fornecedores de informática
4. Define prazo de 5 dias para resposta
5. Sistema envia e-mails automaticamente
6. Recebe propostas e faz upload no sistema
7. Analisa preços: Fornecedor A (R$ 15.000), B (R$ 14.500), C (R$ 16.000)
8. Seleciona Fornecedor B por melhor preço
9. Envia para Aprovação A2

**✅ Ana (Aprovadora A2) - Diretora Financeira**
1. Recebe notificação
2. Revisa cotação e escolha do fornecedor
3. Aprova por estar dentro do orçamento
4. Sistema move para "Pedido de Compra"

**📋 Carlos (Comprador) - Gerando Pedido**
1. Sistema gera PDF automaticamente
2. Revisa dados e adiciona observação: "Entrega no 3º andar"
3. Confirma pedido
4. Sistema notifica recebedores

**📦 Pedro (Recebedor)**
1. Recebe notificação
2. Aguarda entrega dos equipamentos
3. Confere itens contra o pedido
4. Testa funcionamento básico
5. Confirma recebimento sem pendências
6. Sistema move para "Conclusão"

**🎯 Conclusão**
1. Timeline completa é exibida
2. Métricas mostram: 12 dias de processo, R$ 14.500 total
3. Processo é arquivado para histórico

---

Este manual cobre todas as funcionalidades principais do sistema. Para dúvidas específicas ou problemas técnicos, entre em contato com o administrador do sistema ou suporte técnico.