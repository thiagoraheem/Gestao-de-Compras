# Kanban Purchase Management System

## Overview

This is a full-stack web application for managing purchase requests using a Kanban-style workflow. The system allows users to create, track, and manage purchase requests through various phases from initial request to completion. The application is designed to support both human users and AI agents for automated processing.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite for fast development and optimized builds
- **UI Library**: Shadcn/ui components built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS variables for theming
- **State Management**: TanStack Query for server state management
- **Routing**: Wouter for lightweight client-side routing
- **Form Handling**: React Hook Form with Zod validation

### Backend Architecture
- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js for API server
- **Database**: PostgreSQL with Drizzle ORM
- **Database Provider**: Neon serverless PostgreSQL
- **Session Management**: Session storage table prepared for future authentication
- **API Style**: RESTful endpoints with JSON responses

### Data Storage Solutions
- **Primary Database**: PostgreSQL hosted on Neon
- **ORM**: Drizzle ORM with TypeScript-first schema definitions
- **Migrations**: Drizzle Kit for database schema migrations
- **Connection**: WebSocket-enabled connection pool for serverless compatibility

## Key Components

### Purchase Request Workflow
The system implements a fixed 8-phase Kanban workflow:
1. **Solicitação** (Request) - Initial request creation
2. **Aprovação A1** (Approval A1) - First level approval
3. **Cotação** (RFQ) - Request for quotation
4. **Aprovação A2** (Approval A2) - Second level approval
5. **Pedido de Compra** (Purchase Order) - Official purchase order
6. **Conclusão de Compra** (Purchase Completion) - Purchase finalization
7. **Recebimento** (Receipt) - Material receipt
8. **Arquivado** (Archived) - Completed and archived

### User Management System
- Role-based access control with buyer, approver A1, and approver A2 roles
- Department-based organization with cost center associations
- User authentication prepared for JWT implementation
- Password hashing with bcryptjs

### Data Models
Key entities include:
- **Users**: Authentication and role management
- **Departments**: Organizational structure
- **Cost Centers**: Budget allocation tracking
- **Suppliers**: Vendor management
- **Purchase Requests**: Core workflow entities
- **Attachments**: File upload support
- **Payment Methods**: Payment processing options

## Data Flow

### Request Lifecycle
1. User creates purchase request with required information
2. Request enters approval workflow based on configured rules
3. Approvers can approve, reject, or request modifications
4. Buyers handle quotation and supplier selection
5. Final approval triggers purchase order creation
6. Material receipt completes the workflow

### API Integration
- RESTful endpoints for all CRUD operations
- Standardized JSON responses for AI agent compatibility
- Query-based data fetching with TanStack Query
- Form validation using Zod schemas shared between client and server

## External Dependencies

### Core Dependencies
- **@neondatabase/serverless**: Database connectivity
- **drizzle-orm**: Type-safe database queries
- **@tanstack/react-query**: Server state management
- **@radix-ui/**: Accessible UI component primitives
- **tailwindcss**: Utility-first CSS framework
- **wouter**: Minimalist routing library

### Development Dependencies
- **vite**: Fast build tool and dev server
- **typescript**: Type safety across the stack
- **tsx**: TypeScript execution for development
- **esbuild**: Fast JavaScript bundler for production

## Deployment Strategy

### Development Environment
- Vite dev server with hot module replacement
- TypeScript compilation with strict mode enabled
- Database migrations using Drizzle Kit
- Environment variable configuration for database connection

### Production Build
- Vite builds optimized client bundle
- esbuild creates serverless-compatible server bundle
- Static assets served from Express server
- Database connection uses connection pooling for scalability

### Environment Configuration
- `DATABASE_URL` environment variable required for PostgreSQL connection
- Separate build processes for client and server code
- Production deployment uses Node.js server with built assets

## Changelog
- July 8, 2025. Sistema de comparação de fornecedores aprimorado para permitir seleção parcial:
  - ✓ Corrigida lógica de comparação para permitir seleção quando pelo menos um fornecedor respondeu
  - ✓ Removido requisito de que TODOS os fornecedores precisam responder antes da comparação
  - ✓ Melhorada condição `canCompareSuppliers` na quotation-phase.tsx
  - ✓ Atualizada lógica em purchase-card.tsx para distinguir entre "sem respostas" e "algumas respostas"
  - ✓ Sistema agora permite comparação e seleção mesmo quando alguns fornecedores marcam "não respondeu"
  - ✓ Mantida funcionalidade de alert sobre fornecedores que não responderam
  - ✓ Comparação filtra automaticamente apenas fornecedores que responderam
  - ✓ Processo de cotação mais flexível e alinhado com realidade do mercado
- July 8, 2025. Calendário de seleção de data implementado mantendo máscara brasileira:
  - ✓ Adicionado ícone de calendário no lado direito dos campos DateInput
  - ✓ Calendário visual integrado usando Popover e Calendar do shadcn/ui
  - ✓ Mantida funcionalidade de digitação manual com máscara DD/MM/AAAA
  - ✓ Localização em português brasileiro (ptBR) para o calendário
  - ✓ Conversão automática entre seleção visual e formato brasileiro
  - ✓ Ambos os métodos (digitação e calendário) funcionam simultaneamente
  - ✓ Validação de data mantida para ambos os inputs
  - ✓ Interface intuitiva com ícone de calendário sempre visível
- July 8, 2025. Correção crítica da fase de conclusão - linha do tempo e valores dos itens implementada com sucesso:
  - ✓ Corrigido problema de valores zerados nos itens da fase de conclusão
  - ✓ Implementado carregamento correto de itens de cotação do fornecedor selecionado
  - ✓ Corrigido mapeamento entre itens de solicitação e itens de cotação por descrição
  - ✓ Melhorado cálculo de valores totais baseado nos preços do fornecedor escolhido
  - ✓ Corrigida linha do tempo para mostrar informações completas das fases
  - ✓ Adicionado suporte a labels de fase em português (PHASE_LABELS)
  - ✓ Melhorado display de aprovadores com nomes completos
  - ✓ Implementado status visual diferenciado para aprovações e rejeições
  - ✓ Adicionado tratamento para histórico vazio com mensagem informativa
  - ✓ Corrigido estado de loading para incluir carregamento de itens de cotação
  - ✓ Valores agora exibem corretamente R$ 200,00 em vez de R$ 0,00
  - ✓ Timeline mostra fases como "Aprovação A1", "Cotação (RFQ)" etc. em vez de valores vazios
- July 8, 2025. Máscara de data brasileira implementada em todos os campos de data:
  - ✓ Criado componente DateInput com formatação brasileira DD/MM/AAAA
  - ✓ Substituído input type="date" por DateInput customizado em todos os formulários
  - ✓ Atualizado modal de nova solicitação com máscara de data brasileira
  - ✓ Atualizado modal de nova solicitação aprimorado com máscara de data brasileira
  - ✓ Atualizado modal de edição para campos de data de entrega e prazo ideal
  - ✓ Atualizado formulário de criação de RFQ para prazo de cotação e entrega de itens
  - ✓ Implementada conversão automática entre formato de exibição (DD/MM/AAAA) e formato ISO para banco
  - ✓ Adicionada validação de data para garantir datas válidas
  - ✓ Campos de data agora seguem padrão brasileiro como solicitado pelo usuário
- July 8, 2025. Migração completa do Replit Agent para ambiente Replit realizada com sucesso:
  - ✓ Verificação de pacotes instalados e dependências
  - ✓ Confirmação de funcionamento da aplicação no ambiente Replit
  - ✓ Banco de dados PostgreSQL inicializado com dados padrão
  - ✓ Servidor Express rodando corretamente na porta 5000
  - ✓ Interface React funcionando com hot-reload
  - ✓ Sistema de autenticação operacional
  - ✓ Todos os endpoints da API respondendo adequadamente
- July 8, 2025. Correção crítica dos valores zerados na fase Pedido de Compra e sistema de PDF implementada com sucesso e erro de geração de PDF corrigido:
  - ✓ Corrigido problema de valores zerados nos itens da fase Pedido de Compra
  - ✓ Implementado sistema de combinação de itens com preços do fornecedor selecionado
  - ✓ Corrigido cálculo de valores totais baseado nos preços dos itens do fornecedor
  - ✓ Adicionada query para buscar itens do fornecedor selecionado com preços unitários
  - ✓ Melhorado display de informações incluindo marca e tempo de entrega
  - ✓ Corrigido sistema de geração de PDF com configuração adequada do Chromium
  - ✓ Instalado chromium como dependência do sistema e configurado path correto
  - ✓ Implementado sistema de fallback para geração de PDF em caso de falha
  - ✓ Aplicado correções tanto para PDF do dashboard quanto para pedido de compra
  - ✓ Valores agora são exibidos corretamente nos cards e PDFs gerados
  - ✓ Corrigido erro "unitPrice.toFixed is not a function" tanto na interface quanto no PDF service
  - ✓ Implementado verificação de tipo adequada para valores numéricos
  - ✓ Corrigido mapeamento entre itens de solicitação e cotação usando descrições
  - ✓ Aplicado Number() conversion para garantir cálculos corretos de subtotal
  - ✓ PDF e interface agora mostram valores R$ 200,00 corretamente para cada item
- July 8, 2025. Correção crítica do erro de database query em send-to-approval implementada com sucesso:
  - ✓ Corrigido erro "Cannot convert undefined or null to object" no getPurchaseRequestById
  - ✓ Refatorado método para usar queries separadas em vez de JOINs complexos do Drizzle
  - ✓ Melhorado tratamento de dados de usuário nulos/indefinidos
  - ✓ Sistema de envio para aprovação A1 totalmente funcional
  - ✓ Erro que impedia movimentação de cards para aprovação resolvido
  - ✓ Migração completa para ambiente Replit finalizada com sucesso
- July 8, 2025. Remoção do campo "Orçamento Disponível" e seção de anexos da RFQ implementada com sucesso:
  - ✓ Removido campo "availableBudget" de todos os formulários de criação de solicitação
  - ✓ Campo removido de new-request-modal.tsx, enhanced-new-request-modal.tsx e edit-request-modal.tsx
  - ✓ Campo mantido no schema do banco para retrocompatibilidade mas tornado opcional na interface
  - ✓ Removida completamente a seção de upload de anexos da criação de RFQ (rfq-creation.tsx)
  - ✓ Removido estado attachments, funções handleFileUpload e removeAttachment
  - ✓ Removido import Upload e Card de anexos da tela de criação de RFQ
  - ✓ Mantidos apenas anexos da solicitação original para visualização
  - ✓ Interface mais limpa e focada nas informações essenciais da cotação
- July 7, 2025. Correção crítica das rotas de status de cotação e eliminação de erros "Invalid quotation ID":
  - ✓ Corrigida rota incorreta `/api/quotations/by-request/${id}` para `/api/quotations/purchase-request/${id}` em kanban-board.tsx
  - ✓ Melhorada query key do status de cotação para usar formato ['quotation-status', requestId] em purchase-card.tsx
  - ✓ Adicionado tratamento de erro robusto que retorna status padrão em vez de gerar exceções
  - ✓ Configurado staleTime de 5 segundos e retry de 2 tentativas para melhor performance
  - ✓ Eliminados logs de erro "Invalid quotation ID" que apareciam no console
  - ✓ Sistemas de verificação de status de cotação agora funcionam sem erros
  - ✓ Interface visual mantém indicadores corretos: vermelho, laranja e verde conforme status
  - ✓ Todos os cards na fase "Cotação (RFQ)" exibem status correto sem causar erros de rede
- July 7, 2025. Correção crítica dos problemas de cache e atualização em tempo real implementada com sucesso:
  - ✓ Corrigidos problemas de demora na atualização de informações após criação de RFQ
  - ✓ Melhorada invalidação abrangente de cache em todas as mutações críticas
  - ✓ Corrigido erro de quotation ID indefinido que causava chamadas para rotas inexistentes
  - ✓ Eliminadas chamadas para /api/quotations/undefined/supplier-quotations
  - ✓ Adicionado refetch automático para componentes críticos (5-10 segundos)
  - ✓ Cache invalidation com predicados para limpeza abrangente de queries relacionadas
  - ✓ Melhorado feedback visual imediato após operações de criação e movimentação
  - ✓ Sistema de cache mais responsivo com staleTime otimizado
  - ✓ Interface agora reflete mudanças imediatamente sem necessidade de F5
- July 7, 2025. Correção dos filtros de Departamento e Urgência do Kanban implementada com sucesso:
  - ✓ Filtro de Departamento corrigido para usar request.department.id em vez de request.departmentId
  - ✓ Filtro de Urgência corrigido para usar valores corretos: "alto", "medio", "baixo"
  - ✓ Ambos os filtros (mobile e desktop) atualizados com valores consistentes
  - ✓ Filtros agora funcionam corretamente em vez de fazer todos os itens sumirem
- July 7, 2025. Melhoria na tela de comparação de fornecedores implementada com sucesso:
  - ✓ Substituída exibição de "Item #" por descrições reais dos itens na comparação detalhada
  - ✓ Adicionada consulta aos itens da cotação para obter descrições completas
  - ✓ Atualizada tanto a tabela de comparação quanto os cards dos fornecedores
  - ✓ Interface mais intuitiva mostrando "Colheres" em vez de "Item #20"
  - ✓ Mantido fallback para casos onde a descrição não está disponível
- July 7, 2025. Correção crítica do status de cotação nos cards do Kanban implementada com sucesso:
  - ✓ Corrigida rota de verificação de status de cotação de `/api/quotations/by-request/${id}/status` (inexistente) para `/api/quotations/purchase-request/${id}` (existente)
  - ✓ Melhorado tratamento de erros para evitar mensagens de "Erro ao verificar status"
  - ✓ Adicionada validação para cotações inexistentes com status "Nenhuma cotação criada"
  - ✓ Verificação aprimorada do status de cotações de fornecedores (received vs pending)
  - ✓ Indicadores visuais diferenciados para status de erro, carregamento e diferentes fases
  - ✓ Sistema de retry configurado para melhor reliability
  - ✓ Status específicos: "Nenhuma cotação criada", "Aguardando cotações", "Aguardando seleção", "Pronto para A2"
  - ✓ Eliminadas chamadas para rotas inexistentes que causavam erros 400
- July 7, 2025. Validações de progressão de fase e botão de avanço implementados com sucesso:
  - ✓ Validação obrigatória para progressão Cotação → Aprovação A2
  - ✓ Verificação automática de cotação completa com fornecedor selecionado
  - ✓ Bloqueio de movimentação sem análise finalizada e fornecedor vencedor escolhido
  - ✓ Botão "Avançar para Recebimento" implementado na fase Pedido de Compra
  - ✓ Funcionalidade de avanço disponível no card do Kanban e no modal PurchaseOrderPhase
  - ✓ Confirmação obrigatória antes de mover para fase Recebimento
  - ✓ Indicadores visuais de status em cards da fase Cotação
  - ✓ Status "Pronto para Aprovação A2" vs "Aguardando seleção de fornecedor"
  - ✓ API endpoint /api/purchase-requests/:id/advance-to-receipt implementado
  - ✓ Validações de segurança no backend para progressões de fase
  - ✓ Mensagens de erro específicas e descritivas para validações falhadas
  - ✓ Integração completa com sistema de notificações e histórico
  - ✓ Interface responsiva com feedback visual em tempo real
- July 7, 2025. Sistema de controle de permissões rigoroso implementado com sucesso:
  - ✓ Controle de permissões por perfil para movimentação de cards no Kanban
  - ✓ Cards na fase "Aprovação A1" só podem ser movidos por usuários com isApproverA1: true
  - ✓ Cards na fase "Aprovação A2" só podem ser movidos por usuários com isApproverA2: true
  - ✓ Aprovação automática por movimentação implementada no backend
  - ✓ Movimento A1→Cotação registra automaticamente aprovação A1 com histórico
  - ✓ Movimento A2→Pedido de Compra registra automaticamente aprovação A2 com histórico
  - ✓ Visualização restrita com modal informativo para usuários sem permissão
  - ✓ Modais A1/A2 mostram dados completos em modo somente leitura quando sem permissão
  - ✓ Feedback visual: cards não arrastáveis têm cursor "not-allowed" e opacidade reduzida
  - ✓ Validações de segurança no frontend (UX) e backend (segurança)
  - ✓ Mensagens de erro específicas para tentativas de movimentação não autorizadas
  - ✓ Drag handles desabilitados com tooltip explicativo para cards sem permissão
  - ✓ Alertas visuais em cards restritos indicando permissão necessária
  - ✓ Sistema mantém experiência fluida para usuários com permissões adequadas
- July 7, 2025. Dashboard Executivo implementado com sucesso:
  - ✓ Criado Dashboard page com KPIs executivos e análises completas
  - ✓ Implementado sistema de permissões (isManager) para acesso ao dashboard
  - ✓ Adicionado campo isManager à tabela de usuários via schema
  - ✓ Criado ManagerRoute component para controle de acesso
  - ✓ Dashboard integrado ao header principal com ícone BarChart3
  - ✓ API endpoint /api/dashboard com cálculos de métricas executivas
  - ✓ Gráficos interativos: departamentos, urgência, tendências mensais, funil de conversão
  - ✓ Filtros funcionais por período, departamento e status
  - ✓ Tabelas de top departamentos, fornecedores e solicitações atrasadas
  - ✓ Funcionalidade de exportação em PDF implementada
  - ✓ Serviço PDF com template executivo profissional
  - ✓ Endpoint /api/dashboard/export-pdf para download de relatórios
  - ✓ Interface responsiva com design moderno usando Recharts
  - ✓ Métricas de performance: tempo médio de aprovação, taxa de aprovação
  - ✓ Sistema de cores baseado em status (verde, amarelo, vermelho)
  - ✓ Navegação contextual baseada em roles (managers + admins)
- July 7, 2025. Componente ConclusionPhase implementado com funcionalidade completa:
  - ✓ Criado componente React ConclusionPhase para fase "Conclusão de Compra"
  - ✓ Resumo completo da solicitação com dados do solicitante, departamento e centro de custo
  - ✓ Visualização detalhada do fornecedor selecionado com dados de contato
  - ✓ Exibição de dados do pedido de compra e informações de recebimento
  - ✓ Timeline visual do processo com histórico de aprovações
  - ✓ Lista detalhada de itens recebidos com status e valores
  - ✓ Cards de métricas (tempo total, valor, economia, status)
  - ✓ Funcionalidades de exportação PDF, impressão e envio por e-mail
  - ✓ Sistema de arquivamento com observações finais
  - ✓ Visualizador de anexos do processo
  - ✓ Interface responsiva seguindo padrões do projeto
  - ✓ Integração completa com sistema de modais do Kanban
  - ✓ API endpoints para arquivamento, PDF e notificação por e-mail
  - ✓ Componente autossuficiente com visão 360° do processo de compra
- July 7, 2025. Sistema de notificações por e-mail com URLs configuráveis e autenticação com redirecionamento:
  - ✓ URLs de acesso configuráveis através do arquivo config.ts usando BASE_URL
  - ✓ Detecção automática do domínio Replit via REPLIT_DOMAINS
  - ✓ Links diretos para solicitações específicas nos e-mails (/kanban?request=ID&phase=FASE)
  - ✓ Sistema de redirecionamento pós-login para URLs de acesso direto via e-mail
  - ✓ Armazenamento de URL de destino no sessionStorage quando usuário não autenticado
  - ✓ Abertura automática de solicitações específicas via parâmetros de URL
  - ✓ Configuração centralizada de e-mail usando config.ts em vez de variáveis espalhadas
  - ✓ Links específicos para cada fase: Ver Solicitação, Revisar e Aprovar A1, Revisar e Aprovar A2
  - ✓ Arquivo .env.example com documentação das variáveis de ambiente necessárias
- July 7, 2025. Migração para Replit e melhorias na interface:
  - ✓ Migração bem-sucedida do projeto para ambiente Replit
  - ✓ Correção do layout dos botões na fase de recebimento (responsivo e melhor ajuste)
  - ✓ Implementação de filtro por período de data no kanban
  - ✓ Filtro de data padrão para o mês atual e aplicado especificamente a itens arquivados
  - ✓ Layout responsivo para filtros tanto em mobile quanto desktop
  - ✓ Conexão com banco PostgreSQL configurada adequadamente
  - ✓ Sistema totalmente funcional no ambiente Replit
  - ✓ Criação da tela detalhada de recebimento com informações completas da solicitação
  - ✓ Exibição de solicitante, aprovadores, itens de compra e fornecedor selecionado na fase de recebimento
  - ✓ Botões de confirmação e pendência integrados na interface de recebimento
  - ✓ Refatoração completa da tela de atualização de cotação com valores por item
  - ✓ Implementação de cálculo automático do valor total baseado nos itens
  - ✓ Interface para upload de arquivos de proposta dos fornecedores
  - ✓ Comparação detalhada entre fornecedores com visualização de todos os itens e valores
  - ✓ Tabela de comparação item por item mostrando preços unitários, totais, prazos e marcas
  - ✓ Correção do campo de valor monetário para permitir digitação natural sem formatação automática
  - ✓ Aplicação do filtro de período para fase Conclusão (igual à fase Arquivado)
  - ✓ Estilo acinzentado aplicado nas fases finais (Conclusão e Arquivado) seguindo padrão Pipefy
  - ✓ Remoção do botão "Arquivar" da fase Conclusão por ser uma fase final
- July 7, 2025. Correção do nome do solicitante na tela de cotação:
  - ✓ Corrigido método getPurchaseRequestById para incluir dados do usuário solicitante
  - ✓ Simplificada consulta SQL para evitar erros com JOINs complexos
  - ✓ Corrigido componente QuotationPhase para acessar dados do requester corretamente
  - ✓ Nome do solicitante agora aparece corretamente na interface de gestão de cotações
  - ✓ Suporte tanto para request.requesterName quanto request.requester.firstName/lastName
- July 7, 2025. Correção de problemas críticos na tela de Atualizar Cotação:
  - ✓ Corrigido problema de valores incorretos (1000 → R$ 1,00 em vez de R$ 1.000,00)
  - ✓ Melhorada lógica de formatação de valores monetários para entrada natural
  - ✓ Corrigida condição para mostrar botão "Comparar e Selecionar Fornecedor"
  - ✓ Botão agora aparece quando TODOS os fornecedores responderam (não apenas alguns)
  - ✓ Sistema de valores monetários totalmente funcional e consistente
- July 7, 2025. Sistema de notificações por e-mail implementado:
  - ✓ Notificações automáticas para compradores quando nova solicitação é criada
  - ✓ Notificações para aprovadores A1 quando solicitação entra na fase de aprovação A1
  - ✓ Notificações para aprovadores A2 quando solicitação entra na fase de aprovação A2
  - ✓ Templates de e-mail responsivos com detalhes completos da solicitação
  - ✓ Sistema assíncrono para evitar bloqueio do workflow principal
  - ✓ Filtros por roles (isBuyer, isApproverA1, isApproverA2) para envio direcionado
  - ✓ Configuração via variáveis de ambiente (SMTP_HOST, SMTP_USER, SMTP_PASS, FROM_EMAIL)
  - ✓ Integração com criação de solicitações e transições de fase via Kanban
- July 6, 2025. Sistema de geração de PDF do Pedido de Compra implementado:
  - ✓ Criado serviço de geração de PDF baseado no template Excel fornecido (PDFService)
  - ✓ Implementado componente PurchaseOrderPhase com resumo completo do processo
  - ✓ Adicionado botão de download de PDF na fase Pedido de Compra
  - ✓ Rota API /api/purchase-requests/:id/pdf para gerar e baixar PDFs
  - ✓ Interface mostra histórico de aprovações, fornecedor selecionado e todos os dados relevantes
  - ✓ PDF segue estrutura do template da empresa com dados dinâmicos da solicitação
- July 6, 2025. Correções de interface mobile e implementação de filtros funcionais:
  - ✓ Corrigido posicionamento do menu hambúrguer em dispositivos móveis (agora totalmente visível)
  - ✓ Melhorado layout responsivo do header com flexbox otimizado
  - ✓ Implementado sistema de filtros funcionais no kanban (departamento e urgência)
  - ✓ Filtros carregam dados reais do banco (departamentos) e aplicam filtros em tempo real
  - ✓ Layout mobile do kanban aprimorado com títulos e filtros verticais
  - ✓ Adicionado scrollbar customizado para melhor experiência no kanban
- July 6, 2025. Migração para Replit e correções críticas:
  - ✓ Migração bem-sucedida do projeto para ambiente Replit
  - ✓ Correção da contagem incorreta de anexos nos cards do kanban (substituído Math.random por busca real de dados)
  - ✓ Implementação de menu responsivo para dispositivos móveis no header principal
  - ✓ Menu hambúrguer funcional com navegação completa para mobile
  - ✓ Mapeamento correto de campos decimal do banco para interface (requestedQuantity)
  - ✓ Sistema de anexos totalmente funcional nos cards do kanban
- July 6, 2025. Correção crítica no sistema de aprovação (dados incorretos):
  - ✓ Corrigido bug grave onde a tela de aprovação exibia itens de TODAS as solicitações em vez de apenas a específica
  - ✓ Problema estava nas query keys do React Query usando arrays multi-elemento incorretamente
  - ✓ Corrigido query keys para usar URLs completas: `/api/purchase-requests/${id}/items`
  - ✓ Aplicado fix nas fases de aprovação A1 e A2 para garantir dados corretos
  - ✓ Sistema agora exibe apenas os itens da solicitação específica sendo aprovada
- July 6, 2025. Melhorias na interface e funcionalidade do Kanban:
  - ✓ Removido botão global "+" de criação de RFQ da tela principal
  - ✓ Adicionado botão "Criar RFQ" dentro dos cards da fase de cotação (apenas quando não há RFQ criada)
  - ✓ Campo "Solicitante" incluído em todos os cards do Kanban
  - ✓ Campo "Aprovador" incluído nos cards a partir da fase de cotação
  - ✓ Interface mais limpa e contextual para criação de RFQs
- July 6, 2025. Correção do sistema de comparação de fornecedores:
  - ✓ Corrigido problema que exibia valores zerados na tela de comparação
  - ✓ Sistema agora usa o valor total armazenado na base de dados
  - ✓ Valores corretos são exibidos (R$ 1.500,00 e R$ 9.999,10)
  - ✓ Removido campo de especificações técnicas da tela de criação de RFQ
  - ✓ Comparação de fornecedores totalmente funcional
- July 4, 2025. Sistema de comparação e seleção de fornecedores implementado:
  - ✓ Corrigidas rotas duplicadas que causavam exibição incorreta de anexos e histórico
  - ✓ Sistema completo de comparação de fornecedores na fase de cotação
  - ✓ Interface para seleção de fornecedor vencedor com justificativa
  - ✓ Validação que impede avanço da fase de cotação sem seleção de fornecedor
  - ✓ Componente SupplierComparison com visualização detalhada de propostas
  - ✓ Integração com API para persistir seleção e avançar automaticamente para Aprovação A2
  - ✓ Migração completa para ambiente Replit com correção de problemas de relacionamento
- July 4, 2025. Sistema de e-mails e correção da exibição de fornecedores implementado:
  - ✓ Serviço de e-mail integrado com nodemailer para envio automático de RFQs
  - ✓ Correção do método getSupplierQuotations para incluir dados dos fornecedores via JOIN
  - ✓ Funcionalidade de edição de RFQ implementada com carregamento de dados existentes
  - ✓ Modal de edição agora carrega fornecedores previamente selecionados
  - ✓ Interface aprimorada para distinguir entre criação e edição de cotações
  - ✓ Sistema de envio de e-mails com tratamento de erros e feedback ao usuário
- July 4, 2025. Refatoração do sistema de criação de RFQ com carregamento automático de itens:
  - ✓ RFQ agora carrega automaticamente todos os itens da solicitação original
  - ✓ Interface melhorada com distinção visual entre dados originais e campos de cotação
  - ✓ Campos de especificações técnicas e prazos de entrega destacados para preenchimento
  - ✓ Validação e feedback visual aprimorados para facilitar o preenchimento
  - ✓ Migração concluída para ambiente Replit com segurança e melhores práticas
- July 4, 2025. Sistema de aprovação e layout totalmente funcional:
  - ✓ Correção do layout dos cards - títulos em uma linha, botões reorganizados
  - ✓ Sistema de permissões baseado em roles implementado (isApproverA1, isApproverA2, isBuyer)
  - ✓ Fase A2 de aprovação criada com funcionalidade completa
  - ✓ Histórico de aprovações com rastreamento de usuários e timestamps
  - ✓ Visualizador de anexos integrado em todas as fases
  - ✓ Botão de fechamento adicionado na fase de cotação
  - ✓ Modal de edição corrigido para fase A2 - agora mostra interface correta
  - ✓ Validação e persistência de dados aprimoradas
  - ✓ Sistema de aprovação A1 e A2 totalmente operacional
- July 3, 2025. Migração bem-sucedida para Replit e refatoração do layout:
  - Novo layout estilo Pipefy com header fixo e navegação horizontal
  - Kanban full-width sem sidebars, otimizado para visualização das fases
  - Botão flutuante "Nova Solicitação" no canto inferior esquerdo
  - Modal de criação aprimorado com opção de cadastro manual OU upload de planilha
  - Correção de bugs na validação de campos decimais (availableBudget, etc.)
  - Melhoria na edição de itens com correção de problemas de persistência
  - Sistema de validação flexível: itens manuais OU planilha (não ambos obrigatórios)
- July 1, 2025. Implemented comprehensive Kanban phases system including:
  - Request Phase: Complete form with file upload, validation, and visual feedback
  - Approval A1 Phase: Role-based approval with detailed request review and justification
  - Quotation Phase: Multi-supplier quotation management with comparison tools
  - Request Management Page: Unified interface for managing all purchase requests by phase
  - Enhanced API endpoints for approval workflow, quotations, and attachments
- December 30, 2024. Fixed responsive sidebar with hamburger menu functionality for mobile and desktop
- December 30, 2024. Corrected layout issues by removing duplicate headers and fixing content margins
- June 27, 2025. Initial setup

## User Preferences

Preferred communication style: Simple, everyday language.