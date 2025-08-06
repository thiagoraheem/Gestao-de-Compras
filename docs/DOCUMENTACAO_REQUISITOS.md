# 📋 Documentação de Requisitos - Sistema de Gestão de Compras

## 📊 Visão Geral dos Requisitos

Este documento especifica todos os requisitos funcionais e não funcionais do Sistema de Gestão de Compras, detalhando as funcionalidades implementadas e as regras de negócio que governam o sistema.

---

## 🎯 Objetivos do Sistema

### Objetivo Principal
Automatizar e controlar o processo completo de compras empresariais, desde a solicitação inicial até o recebimento do material, garantindo:
- Aprovações hierárquicas adequadas
- Processo competitivo de cotações
- Rastreabilidade completa do processo
- Controle de custos e orçamentos
- Conformidade com políticas internas

### Objetivos Específicos
1. **Digitalização**: Eliminar processos manuais e papéis
2. **Transparência**: Visibilidade completa do status das solicitações
3. **Eficiência**: Reduzir tempo de processamento
4. **Controle**: Garantir aprovações adequadas por valor e centro de custo
5. **Auditoria**: Manter histórico completo para compliance

---

## 👥 Stakeholders e Usuários

### Usuários Primários
1. **Solicitantes**: Funcionários que criam solicitações de compra
2. **Aprovadores A1**: Gestores de primeira linha (aprovação inicial)
3. **Compradores**: Responsáveis por cotações e negociações
4. **Aprovadores A2**: Gestores seniores (aprovação final)
5. **Recebedores**: Responsáveis pelo recebimento de materiais
6. **Administradores**: Gestão do sistema e configurações

### Usuários Secundários
1. **Gerentes**: Visualização de dashboards e relatórios
2. **Auditores**: Consulta de histórico e conformidade
3. **Fornecedores**: Recebimento de RFQs e envio de propostas

---

## 🔄 Requisitos Funcionais

### RF001 - Gestão de Usuários e Autenticação

#### RF001.1 - Autenticação de Usuários
- **Descrição**: Sistema deve permitir login seguro com username/email e senha
- **Critérios de Aceitação**:
  - Login com username ou email
  - Senha criptografada (bcryptjs)
  - Sessão persistente no PostgreSQL
  - Logout seguro
  - Proteção contra CSRF
- **Prioridade**: Alta
- **Status**: ✅ Implementado

#### RF001.2 - Recuperação de Senha
- **Descrição**: Usuários devem poder redefinir senhas esquecidas
- **Critérios de Aceitação**:
  - Envio de token por e-mail
  - Token com expiração (24h)
  - Validação de token
  - Redefinição segura de senha
- **Prioridade**: Alta
- **Status**: ✅ Implementado

#### RF001.3 - Gestão de Perfis de Usuário
- **Descrição**: Administradores devem gerenciar usuários e permissões
- **Critérios de Aceitação**:
  - CRUD completo de usuários
  - Múltiplas permissões por usuário
  - Associação com empresas e departamentos
  - Associação com centros de custo (aprovadores A1)
- **Prioridade**: Alta
- **Status**: ✅ Implementado

### RF002 - Gestão de Estrutura Organizacional

#### RF002.1 - Gestão de Empresas
- **Descrição**: Sistema deve gerenciar múltiplas empresas
- **Critérios de Aceitação**:
  - CRUD de empresas
  - Upload de logo (base64)
  - Dados completos (CNPJ, endereço, contatos)
  - Ativação/desativação
- **Prioridade**: Alta
- **Status**: ✅ Implementado

#### RF002.2 - Gestão de Departamentos
- **Descrição**: Organização hierárquica por departamentos
- **Critérios de Aceitação**:
  - CRUD de departamentos
  - Associação com empresas
  - Descrição e responsável
- **Prioridade**: Alta
- **Status**: ✅ Implementado

#### RF002.3 - Gestão de Centros de Custo
- **Descrição**: Controle orçamentário por centro de custo
- **Critérios de Aceitação**:
  - CRUD de centros de custo
  - Código único e nome
  - Associação com departamentos
  - Controle de permissões de aprovação
- **Prioridade**: Alta
- **Status**: ✅ Implementado

#### RF002.4 - Gestão de Locais de Entrega
- **Descrição**: Cadastro de endereços para entrega
- **Critérios de Aceitação**:
  - CRUD de locais de entrega
  - Endereço completo e contatos
  - Ativação/desativação
  - Ordenação por ID
- **Prioridade**: Média
- **Status**: ✅ Implementado

### RF003 - Workflow Kanban de Compras

#### RF003.1 - Fase 1: Solicitação
- **Descrição**: Criação de nova solicitação de compra
- **Critérios de Aceitação**:
  - Formulário com campos obrigatórios e opcionais
  - Validação de dados
  - Geração automática de número sequencial
  - Associação com empresa e centro de custo
  - Múltiplos itens por solicitação
- **Campos Obrigatórios**:
  - Empresa
  - Centro de custo
  - Categoria (Produto/Serviço/Outros)
  - Urgência (Baixo/Médio/Alto)
  - Justificativa
  - Itens (descrição, unidade, quantidade, especificação técnica)
- **Campos Opcionais**:
  - Prazo ideal de entrega
  - Orçamento disponível
  - Informações adicionais
- **Prioridade**: Alta
- **Status**: ✅ Implementado

#### RF003.2 - Fase 2: Aprovação A1
- **Descrição**: Primeira aprovação hierárquica
- **Critérios de Aceitação**:
  - Apenas aprovadores A1 podem aprovar
  - Restrição por centro de custo associado
  - Opções: Aprovar ou Reprovar
  - Motivo obrigatório para reprovação
  - Notificação automática por e-mail
  - Movimentação automática para próxima fase
- **Regras de Negócio**:
  - Aprovador só vê solicitações dos seus centros de custo
  - Aprovação move para "Cotação"
  - Reprovação volta para "Solicitação"
- **Prioridade**: Alta
- **Status**: ✅ Implementado

#### RF003.3 - Fase 3: Cotação (RFQ)
- **Descrição**: Processo de cotação com fornecedores
- **Critérios de Aceitação**:
  - Apenas compradores podem gerenciar
  - Criação de RFQ com múltiplos fornecedores
  - Envio automático de e-mail para fornecedores
  - Upload de propostas de fornecedores
  - Análise comparativa de cotações
  - Seleção de fornecedor vencedor
  - Suporte a múltiplas versões de RFQ
  - Histórico completo de cotações
- **Funcionalidades Especiais**:
  - Badge "Nec.Cotação" para reprovações A2
  - Botão "Nova RFQ" para recotações
  - Botão "Histórico" para versões anteriores
- **Prioridade**: Alta
- **Status**: ✅ Implementado

#### RF003.4 - Fase 4: Aprovação A2
- **Descrição**: Segunda aprovação para valores e fornecedores
- **Critérios de Aceitação**:
  - Apenas aprovadores A2 podem aprovar
  - Visualização completa da cotação
  - Opções de aprovação/reprovação
  - Reprovação com duas opções:
    - Arquivar definitivamente
    - Retornar para nova cotação
  - Justificativa obrigatória para reprovação
- **Regras de Negócio**:
  - Aprovação move para "Pedido de Compra"
  - Reprovação para arquivo move para "Arquivado"
  - Reprovação para recotação volta para "Cotação"
- **Prioridade**: Alta
- **Status**: ✅ Implementado

#### RF003.5 - Fase 5: Pedido de Compra
- **Descrição**: Geração e envio do pedido oficial
- **Critérios de Aceitação**:
  - Apenas compradores podem gerenciar
  - Geração automática de PDF
  - Dados dinâmicos da empresa
  - Assinaturas eletrônicas
  - Campo para observações específicas
  - Controle de pendências
  - Botão para avançar para recebimento
- **Funcionalidades do PDF**:
  - Logo da empresa (base64)
  - Dados completos da empresa
  - Informações do fornecedor
  - Itens com preços e especificações
  - Assinaturas eletrônicas com datas
- **Prioridade**: Alta
- **Status**: ✅ Implementado

#### RF003.6 - Fase 6: Recebimento
- **Descrição**: Recebimento e conferência de materiais
- **Critérios de Aceitação**:
  - Apenas recebedores podem gerenciar
  - Registro de recebimento
  - Controle de qualidade
  - Gestão de pendências
  - Possibilidade de retorno para Pedido de Compra
  - Visualização das observações do pedido
- **Regras de Negócio**:
  - Recebimento OK move para "Conclusão"
  - Pendência retorna para "Pedido de Compra"
- **Prioridade**: Alta
- **Status**: ✅ Implementado

#### RF003.7 - Fase 7: Conclusão de Compra
- **Descrição**: Finalização e análise do processo
- **Critérios de Aceitação**:
  - Timeline completa do processo
  - Métricas de performance
  - Visualização de todos os anexos
  - Relatório de conclusão
  - Função de impressão otimizada
  - Botão para arquivar
- **Métricas Exibidas**:
  - Tempo total do processo
  - Valor total dos itens
  - Fornecedor selecionado
  - Dados do solicitante e centro de custo
- **Prioridade**: Alta
- **Status**: ✅ Implementado

#### RF003.8 - Fase 8: Arquivado
- **Descrição**: Processo finalizado e arquivado
- **Critérios de Aceitação**:
  - Somente leitura
  - Acesso para auditoria
  - Histórico preservado
- **Prioridade**: Média
- **Status**: ✅ Implementado

### RF004 - Gestão de Fornecedores

#### RF004.1 - Cadastro de Fornecedores
- **Descrição**: Sistema deve gerenciar fornecedores
- **Critérios de Aceitação**:
  - CRUD completo de fornecedores
  - Dados completos (CNPJ, contatos, endereço)
  - Condições de pagamento
  - Produtos/serviços oferecidos
  - Validação de CNPJ
- **Prioridade**: Alta
- **Status**: ✅ Implementado

#### RF004.2 - Integração com RFQ
- **Descrição**: Fornecedores devem receber RFQs automaticamente
- **Critérios de Aceitação**:
  - Seleção múltipla para RFQ
  - Envio automático de e-mail
  - Template profissional de RFQ
  - Prazo de resposta definido
- **Prioridade**: Alta
- **Status**: ✅ Implementado

### RF005 - Sistema de Notificações

#### RF005.1 - Notificações por E-mail
- **Descrição**: Sistema deve enviar notificações automáticas
- **Critérios de Aceitação**:
  - Templates HTML responsivos
  - Configuração SMTP/SendGrid
  - Envio assíncrono
  - Filtros por role de usuário
- **Triggers de Notificação**:
  - Nova solicitação → Aprovadores A1
  - Aprovação A1 → Compradores
  - RFQ criada → Fornecedores
  - Aprovação A2 → Compradores
  - Pedido gerado → Recebedores
- **Prioridade**: Alta
- **Status**: ✅ Implementado

### RF006 - Gestão de Documentos

#### RF006.1 - Upload de Arquivos
- **Descrição**: Sistema deve permitir upload de documentos
- **Critérios de Aceitação**:
  - Tipos suportados: PDF, DOC, DOCX, XLS, XLSX, TXT, PNG, JPG
  - Limite de 10MB por arquivo
  - Validação de tipo e tamanho
  - Armazenamento seguro
- **Prioridade**: Alta
- **Status**: ✅ Implementado

#### RF006.2 - Geração de PDFs
- **Descrição**: Sistema deve gerar documentos PDF
- **Critérios de Aceitação**:
  - PDF do Pedido de Compra
  - PDF de RFQ para fornecedores
  - Relatório de Conclusão
  - Layout profissional
  - Dados dinâmicos
- **Prioridade**: Alta
- **Status**: ✅ Implementado

### RF007 - Dashboard e Relatórios

#### RF007.1 - Dashboard Executivo
- **Descrição**: Gerentes devem ter visão executiva
- **Critérios de Aceitação**:
  - Métricas de performance
  - Gráficos e indicadores
  - Filtros por período
  - Acesso restrito a gerentes
- **Prioridade**: Média
- **Status**: ✅ Implementado

#### RF007.2 - Relatórios de Auditoria
- **Descrição**: Sistema deve manter histórico completo
- **Critérios de Aceitação**:
  - Timeline completa de cada processo
  - Histórico de aprovações
  - Log de mudanças
  - Rastreabilidade completa
- **Prioridade**: Alta
- **Status**: ✅ Implementado

### RF008 - Administração do Sistema

#### RF008.1 - Limpeza de Dados
- **Descrição**: Administradores devem poder limpar dados de teste
- **Critérios de Aceitação**:
  - Remoção segura respeitando constraints
  - Confirmação obrigatória
  - Log de operações
  - Acesso restrito a administradores
- **Prioridade**: Baixa
- **Status**: ✅ Implementado

---

## 🔒 Requisitos Não Funcionais

### RNF001 - Segurança

#### RNF001.1 - Autenticação e Autorização
- **Descrição**: Sistema deve ser seguro contra acessos não autorizados
- **Critérios**:
  - Senhas criptografadas (bcryptjs)
  - Sessões seguras no PostgreSQL
  - Proteção CSRF (sameSite: 'lax')
  - Tokens de reset com expiração
  - Validação de permissões em todas as rotas
- **Status**: ✅ Implementado

#### RNF001.2 - Proteção de Dados
- **Descrição**: Dados sensíveis devem ser protegidos
- **Critérios**:
  - Validação de entrada (Zod schemas)
  - Sanitização de dados
  - Logs sem informações sensíveis
  - Backup seguro
- **Status**: ✅ Implementado

### RNF002 - Performance

#### RNF002.1 - Tempo de Resposta
- **Descrição**: Sistema deve ser responsivo
- **Critérios**:
  - Carregamento inicial < 3 segundos
  - Operações CRUD < 1 segundo
  - Geração de PDF < 5 segundos
  - Cache de queries frequentes
- **Status**: ✅ Implementado

#### RNF002.2 - Escalabilidade
- **Descrição**: Sistema deve suportar crescimento
- **Critérios**:
  - Arquitetura serverless-ready
  - Connection pooling
  - Otimização de queries
  - Paginação de resultados
- **Status**: ✅ Implementado

### RNF003 - Usabilidade

#### RNF003.1 - Interface Intuitiva
- **Descrição**: Sistema deve ser fácil de usar
- **Critérios**:
  - Design responsivo (mobile-first)
  - Navegação clara
  - Feedback visual imediato
  - Mensagens de erro em português
- **Status**: ✅ Implementado

#### RNF003.2 - Acessibilidade
- **Descrição**: Sistema deve ser acessível
- **Critérios**:
  - Componentes Radix UI (acessíveis)
  - Contraste adequado
  - Navegação por teclado
  - Labels descritivos
- **Status**: ✅ Implementado

### RNF004 - Confiabilidade

#### RNF004.1 - Disponibilidade
- **Descrição**: Sistema deve estar sempre disponível
- **Critérios**:
  - Uptime > 99%
  - Tratamento de erros robusto
  - Fallbacks para falhas
  - Monitoramento automático
- **Status**: ✅ Implementado

#### RNF004.2 - Integridade de Dados
- **Descrição**: Dados devem ser consistentes
- **Critérios**:
  - Transações ACID
  - Constraints de integridade
  - Validação em múltiplas camadas
  - Backup automático
- **Status**: ✅ Implementado

### RNF005 - Manutenibilidade

#### RNF005.1 - Código Limpo
- **Descrição**: Código deve ser mantível
- **Critérios**:
  - TypeScript em todo o stack
  - Padrões de código consistentes
  - Documentação inline
  - Separação de responsabilidades
- **Status**: ✅ Implementado

#### RNF005.2 - Monitoramento
- **Descrição**: Sistema deve ser monitorável
- **Critérios**:
  - Logs estruturados
  - Métricas de performance
  - Alertas automáticos
  - Dashboard de saúde
- **Status**: ⚠️ Parcialmente implementado

---

## 📊 Regras de Negócio

### RN001 - Aprovações Hierárquicas
1. **RN001.1**: Aprovadores A1 só podem aprovar solicitações dos centros de custo associados
2. **RN001.2**: Aprovadores A2 podem aprovar qualquer solicitação que chegue à fase A2
3. **RN001.3**: Reprovação em A1 retorna para "Solicitação"
4. **RN001.4**: Reprovação em A2 pode arquivar ou retornar para "Cotação"

### RN002 - Processo de Cotação
1. **RN002.1**: Apenas compradores podem gerenciar cotações
2. **RN002.2**: RFQ deve ter pelo menos 1 fornecedor selecionado
3. **RN002.3**: Fornecedor vencedor deve ser selecionado antes de A2
4. **RN002.4**: Múltiplas versões de RFQ são permitidas

### RN003 - Controle de Acesso
1. **RN003.1**: Usuários só veem dados da sua empresa
2. **RN003.2**: Aprovadores A1 só veem solicitações dos seus centros de custo
3. **RN003.3**: Administradores têm acesso total
4. **RN003.4**: Fornecedores são visíveis para compradores e administradores

### RN004 - Numeração e Identificação
1. **RN004.1**: Números de solicitação são sequenciais e únicos
2. **RN004.2**: Números de RFQ são gerados automaticamente
3. **RN004.3**: Números de pedido seguem padrão específico
4. **RN004.4**: Todas as entidades têm timestamps de criação/atualização

### RN005 - Notificações
1. **RN005.1**: Notificações são enviadas apenas para usuários com permissão relevante
2. **RN005.2**: E-mails de RFQ são enviados do e-mail do comprador
3. **RN005.3**: Notificações são assíncronas para não bloquear o workflow
4. **RN005.4**: Falhas de e-mail não impedem o progresso do processo

---

## 🎯 Critérios de Aceitação Gerais

### Funcionalidade
- ✅ Todas as 8 fases do workflow implementadas
- ✅ Sistema de permissões funcionando
- ✅ Notificações automáticas operacionais
- ✅ Geração de PDFs funcionando
- ✅ Upload de arquivos operacional

### Interface
- ✅ Design responsivo para desktop e mobile
- ✅ Navegação intuitiva
- ✅ Feedback visual adequado
- ✅ Mensagens em português

### Performance
- ✅ Carregamento rápido das páginas
- ✅ Operações CRUD eficientes
- ✅ Geração de PDF em tempo aceitável
- ✅ Drag & drop fluido no Kanban

### Segurança
- ✅ Autenticação segura
- ✅ Autorização por roles
- ✅ Validação de dados
- ✅ Proteção contra ataques comuns

---

## 📈 Métricas de Sucesso

### Métricas de Processo
1. **Tempo Médio de Processo**: < 15 dias úteis
2. **Taxa de Aprovação A1**: > 80%
3. **Taxa de Aprovação A2**: > 90%
4. **Tempo de Cotação**: < 5 dias úteis

### Métricas de Sistema
1. **Uptime**: > 99%
2. **Tempo de Resposta**: < 2 segundos
3. **Taxa de Erro**: < 1%
4. **Satisfação do Usuário**: > 4.5/5

### Métricas de Negócio
1. **Redução de Tempo de Processo**: > 50%
2. **Economia em Compras**: > 10%
3. **Conformidade**: 100%
4. **Rastreabilidade**: 100%

---

## 🔄 Casos de Uso Principais

### UC001 - Criar Solicitação de Compra
**Ator**: Solicitante
**Pré-condições**: Usuário autenticado
**Fluxo Principal**:
1. Usuário acessa "Nova Solicitação"
2. Preenche dados obrigatórios
3. Adiciona itens necessários
4. Submete solicitação
5. Sistema gera número único
6. Notifica aprovadores A1

### UC002 - Aprovar Solicitação A1
**Ator**: Aprovador A1
**Pré-condições**: Solicitação na fase A1, usuário tem permissão
**Fluxo Principal**:
1. Aprovador recebe notificação
2. Acessa solicitação no Kanban
3. Revisa dados e itens
4. Aprova ou reprova com justificativa
5. Sistema move para próxima fase
6. Notifica próximo responsável

### UC003 - Processar Cotação
**Ator**: Comprador
**Pré-condições**: Solicitação aprovada em A1
**Fluxo Principal**:
1. Comprador cria RFQ
2. Seleciona fornecedores
3. Define prazo e condições
4. Envia RFQ automaticamente
5. Recebe e analisa propostas
6. Seleciona fornecedor vencedor
7. Move para aprovação A2

### UC004 - Gerar Pedido de Compra
**Ator**: Comprador
**Pré-condições**: Solicitação aprovada em A2
**Fluxo Principal**:
1. Sistema gera PDF automaticamente
2. Comprador revisa dados
3. Adiciona observações se necessário
4. Confirma pedido
5. PDF é gerado com assinaturas
6. Move para recebimento

---

## 🚀 Roadmap de Requisitos

### Versão Atual (v1.0)
- ✅ Workflow Kanban completo
- ✅ Sistema de usuários e permissões
- ✅ Gestão de fornecedores
- ✅ Notificações automáticas
- ✅ Geração de PDFs

### Próximas Versões

#### v1.1 - Melhorias de UX
- 📋 Dashboard avançado com métricas
- 📋 Relatórios customizáveis
- 📋 Filtros avançados no Kanban
- 📋 Busca global

#### v1.2 - Integrações
- 📋 API REST completa
- 📋 Webhooks para sistemas externos
- 📋 Integração com ERP
- 📋 Importação de dados

#### v1.3 - Mobile e Real-time
- 📋 Aplicativo mobile
- 📋 Notificações push
- 📋 Atualizações em tempo real
- 📋 Modo offline

#### v2.0 - Recursos Avançados
- 📋 Multi-tenant
- 📋 Workflow configurável
- 📋 IA para análise de cotações
- 📋 Blockchain para auditoria