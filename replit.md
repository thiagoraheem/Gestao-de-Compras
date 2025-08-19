# Sistema de Gestão de Compras

## Overview

The Sistema de Gestão de Compras is a comprehensive purchase management system designed to automate and control the complete purchasing process from initial request to material receipt. The application features a Kanban-style workflow with 8 fixed phases (Solicitação → Aprovação A1 → Cotação → Aprovação A2 → Pedido de Compra → Conclusão → Recebimento → Arquivado) and implements hierarchical approval controls based on cost centers and user roles.

The system supports multi-company operations, supplier management, quotation handling, automated PDF generation for purchase orders, and comprehensive audit trails. It's built to digitize manual purchasing processes while ensuring proper approvals, competitive quotations, and full process traceability.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript for type safety and modern development
- **Build System**: Vite for fast development builds and Hot Module Replacement
- **UI Components**: Shadcn/ui library built on Radix UI primitives for consistent design
- **Styling**: Tailwind CSS with CSS custom properties for theming support
- **State Management**: TanStack Query for server state with caching and synchronization
- **Routing**: Wouter for lightweight client-side routing
- **Form Handling**: React Hook Form with Zod validation for robust form management
- **Drag & Drop**: @dnd-kit for Kanban board functionality

### Backend Architecture
- **Runtime**: Node.js with TypeScript for consistent typing across the stack
- **Web Framework**: Express.js providing RESTful API endpoints
- **Database Layer**: Drizzle ORM with TypeScript-first schema definitions
- **Session Management**: PostgreSQL-backed sessions using connect-pg-simple
- **File Handling**: Multer for upload processing with local storage
- **PDF Generation**: Puppeteer for server-side PDF creation
- **Email Service**: Nodemailer for notifications and RFQ distribution

### Database Design
- **Primary Database**: PostgreSQL with connection pooling for reliability
- **ORM Strategy**: Drizzle ORM chosen for type safety and performance over Prisma
- **Schema Management**: Database migrations handled through Drizzle Kit
- **Session Storage**: PostgreSQL session store for scalability over memory-based sessions

### Authentication & Authorization
- **Session Strategy**: Server-side sessions with PostgreSQL persistence
- **Role-Based Access**: Multiple user roles (admin, buyer, approver A1/A2, manager, receiver)
- **Permission System**: Granular permissions tied to departments and cost centers
- **Password Security**: Bcrypt hashing with configurable salt rounds

## External Dependencies

### Database & Infrastructure
- **PostgreSQL Database**: Neon serverless PostgreSQL for cloud hosting
- **WebSocket Connections**: Used for serverless-compatible database connections
- **File Storage**: Local filesystem storage with plans for S3 migration

### Email & Communication
- **SMTP Service**: Nodemailer with configurable SMTP providers
- **SendGrid Integration**: Available for production email delivery
- **Template Engine**: HTML email templates with inline styling

### Third-Party Services
- **ERP Integration**: External API integration for product catalog synchronization
- **PDF Processing**: Puppeteer for server-side PDF generation with fallback options
- **Excel Processing**: XLSX library for spreadsheet import/export functionality

### Development & Deployment
- **Replit Platform**: Configured for Replit environment with domain handling
- **Environment Configuration**: Separate development and production database URLs
- **Build Process**: Vite for client builds, esbuild for server bundling
- **Security**: Configurable session secrets and database credentials validation

### UI & UX Libraries
- **Radix UI**: Headless UI primitives for accessibility
- **Lucide Icons**: Consistent icon library throughout the application
- **Date-fns**: Date manipulation with Portuguese localization
- **React Hook Form**: Form state management with validation
- **Zod**: Runtime type validation for API endpoints and forms