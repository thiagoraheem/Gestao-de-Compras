
# Prompt: Implementação de Cadastro de Locais de Entrega

## Objetivo
Implementar o cadastro de locais de entrega e permitir a seleção durante a criação de cotações, substituindo o local fixo atual no PDF.

## Funcionalidades Necessárias

### 1. Nova Tabela no Banco de Dados
Criar tabela `delivery_locations` no arquivo `shared/schema.ts`:

```sql
delivery_locations:
- id (serial, primary key)
- name (text, not null) - Ex: "Matriz São Paulo"
- address (text, not null) - Endereço completo
- contact_person (text) - Pessoa de contato
- phone (text) - Telefone
- email (text) - Email
- observations (text) - Observações adicionais
- active (boolean, default true) - Ativo/Inativo
- created_at (timestamp)
- updated_at (timestamp)
```

### 2. Relacionamento com Cotações
- Adicionar campo `delivery_location_id` na tabela `quotations`
- Criar foreign key para `delivery_locations.id`
- Permitir NULL para compatibilidade com dados existentes

### 3. Backend - Storage (server/storage.ts)
Implementar métodos CRUD:
- `getDeliveryLocations()` - Listar todos os locais ativos
- `getDeliveryLocation(id)` - Buscar por ID
- `createDeliveryLocation(data)` - Criar novo local
- `updateDeliveryLocation(id, data)` - Atualizar local
- `deleteDeliveryLocation(id)` - Desativar local (soft delete)

### 4. Backend - Routes (server/routes.ts)
Criar endpoints:
- `GET /api/delivery-locations` - Listar locais ativos
- `GET /api/delivery-locations/:id` - Buscar por ID
- `POST /api/delivery-locations` - Criar novo
- `PUT /api/delivery-locations/:id` - Atualizar
- `DELETE /api/delivery-locations/:id` - Desativar

### 5. Frontend - Tela de Administração
Criar página `client/src/pages/delivery-locations.tsx`:
- Listagem com tabela responsiva
- Formulário de criação/edição em modal
- Ações: Criar, Editar, Ativar/Desativar
- Validação de campos obrigatórios
- Integração com React Query para cache

### 6. Frontend - Integração na Criação de RFQ
Modificar `client/src/components/rfq-creation.tsx`:
- Adicionar select de local de entrega
- Buscar locais disponíveis da API
- Tornar campo obrigatório
- Salvar `delivery_location_id` na cotação

### 7. PDF Service - Usar Local Selecionado
Modificar `server/pdf-service.ts`:
- Buscar dados do local de entrega da cotação
- Substituir endereço fixo pelo endereço do local selecionado
- Incluir informações de contato se disponíveis
- Formatar endereço corretamente no PDF

### 8. Navegação e Menu
- Adicionar link "Locais de Entrega" no menu administrativo
- Restringir acesso a usuários admin
- Usar ícone apropriado (MapPin ou Building)

## Fluxo de Funcionamento

1. **Admin cadastra locais**: Acessa tela administrativa e cria locais de entrega
2. **Criação de RFQ**: Usuário seleciona local de entrega obrigatoriamente
3. **Salva na cotação**: Local fica vinculado à cotação criada
4. **Aprovação A2**: PDF gerado usa o local selecionado
5. **Email para fornecedores**: Inclui o local de entrega correto

## Validações Importantes
- Nome do local obrigatório e único
- Endereço obrigatório
- Não permitir exclusão se houver cotações vinculadas
- Local deve estar ativo para aparecer na seleção

## Migração de Dados Existentes
- Criar um local padrão "Matriz - Endereço Atual" 
- Associar todas as cotações existentes a este local padrão
- Permitir edição posterior pelo admin

Implemente esta funcionalidade seguindo os padrões existentes no projeto, usando TypeScript, Drizzle ORM e as bibliotecas UI já configuradas.
