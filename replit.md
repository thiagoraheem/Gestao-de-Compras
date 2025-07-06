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