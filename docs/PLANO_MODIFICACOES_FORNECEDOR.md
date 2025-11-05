# Plano de Modificações - Tabela de Fornecedores

## Visão Geral
Este documento detalha as modificações necessárias na tabela de fornecedores para implementar os requisitos de tipos de fornecedor (Pessoa Jurídica, Online, Pessoa Física), validações dinâmicas e campos adicionais.

## 1. Modificações no Banco de Dados

### 1.1 Alterações na Tabela `suppliers`

```sql
-- Adicionar campo CPF para fornecedores pessoa física
ALTER TABLE suppliers ADD COLUMN cpf TEXT;

-- Adicionar campo ID do fornecedor no ERP externo
ALTER TABLE suppliers ADD COLUMN idSupplierERP INTEGER DEFAULT NULL;

-- Atualizar constraint do campo type para aceitar apenas valores 0, 1, 2
-- Remover constraint existente e criar novo
ALTER TABLE suppliers DROP CONSTRAINT IF EXISTS suppliers_type_check;
ALTER TABLE suppliers ADD CONSTRAINT suppliers_type_check 
  CHECK (type IN (0, 1, 2));

-- Criar índice para performance
CREATE INDEX idx_suppliers_type ON suppliers(type);
CREATE INDEX idx_suppliers_cpf ON suppliers(cpf);
CREATE INDEX idx_suppliers_idSupplierERP ON suppliers(idSupplierERP);
```

### 1.2 Migration Script
Criar arquivo: `db_scripts/migration_fornecedor_tipos.sql`

```sql
-- Migration: Implementação de Tipos de Fornecedor
-- Data: $(date)
-- Descrição: Adiciona suporte a Pessoa Jurídica, Online e Pessoa Física

BEGIN;

-- Adicionar novos campos
ALTER TABLE suppliers 
  ADD COLUMN IF NOT EXISTS cpf TEXT,
  ADD COLUMN IF NOT EXISTS idSupplierERP INTEGER DEFAULT NULL;

-- Atualizar constraint do tipo
ALTER TABLE suppliers 
  DROP CONSTRAINT IF EXISTS suppliers_type_check;

ALTER TABLE suppliers 
  ADD CONSTRAINT suppliers_type_check 
  CHECK (type IN (0, 1, 2));

-- Atualizar descrições existentes
UPDATE suppliers 
SET type = 0 
WHERE type NOT IN (0, 1, 2);

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_suppliers_type ON suppliers(type);
CREATE INDEX IF NOT EXISTS idx_suppliers_cpf ON suppliers(cpf);
CREATE INDEX IF NOT EXISTS idx_suppliers_idSupplierERP ON suppliers(idSupplierERP);

COMMIT;
```

## 2. Modificações no Backend

### 2.1 Atualização do Schema (shared/schema.ts)

```typescript
// Atualizar definição da tabela suppliers
export const suppliers = pgTable("suppliers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: integer("type").notNull().default(0), // 0: Pessoa Jurídica, 1: Online, 2: Pessoa Física
  cnpj: text("cnpj"),
  cpf: text("cpf"), // NOVO CAMPO
  contact: text("contact"),
  email: text("email"),
  phone: text("phone"),
  website: text("website"),
  address: text("address"),
  paymentTerms: text("payment_terms"),
  productsServices: text("products_services"),
  companyId: integer("company_id").references(() => companies.id),
  idSupplierERP: integer("idSupplierERP"), // NOVO CAMPO
  createdAt: timestamp("created_at").defaultNow(),
});

// Atualizar schemas de validação
export const insertSupplierSchema = createInsertSchema(suppliers).omit({
  id: true,
  createdAt: true,
}).refine((data) => {
  // Validações por tipo de fornecedor
  if (data.type === 0) {
    // Pessoa Jurídica: CNPJ obrigatório
    return data.cnpj && data.cnpj.length > 0;
  } else if (data.type === 2) {
    // Pessoa Física: CPF obrigatório
    return data.cpf && data.cpf.length > 0;
  } else if (data.type === 1) {
    // Online: Website obrigatório
    return data.website && data.website.length > 0;
  }
  return true;
}, {
  message: "Campos obrigatórios não preenchidos para o tipo de fornecedor selecionado",
  path: ["type"],
}).refine((data) => {
  // Validação de CNPJ
  if (data.type === 0 && data.cnpj) {
    return validateCNPJ(data.cnpj);
  }
  return true;
}, {
  message: "CNPJ inválido",
  path: ["cnpj"],
}).refine((data) => {
  // Validação de CPF
  if (data.type === 2 && data.cpf) {
    return validateCPF(data.cpf);
  }
  return true;
}, {
  message: "CPF inválido",
  path: ["cpf"],
});
```

### 2.2 Adicionar Validadores CPF/CNPJ (server/cnpj-cpf-validator.ts)

```typescript
// Adicionar ao arquivo existente server/cnpj-validator.ts

/**
 * Valida CPF
 * @param cpf - CPF a ser validado (com ou sem formatação)
 * @returns boolean - true se válido, false se inválido
 */
export function validateCPF(cpf: string): boolean {
  const cleanCpf = cpf.replace(/[^\d]+/g, '');
  
  if (cleanCpf.length !== 11) return false;
  
  // Elimina CPFs inválidos conhecidos
  if (['00000000000', '11111111111', '22222222222', '33333333333',
       '44444444444', '55555555555', '66666666666', '77777777777',
       '88888888888', '99999999999'].includes(cleanCpf)) {
    return false;
  }
  
  // Valida 1o digito
  let add = 0;
  for (let i = 0; i < 9; i++) {
    add += parseInt(cleanCpf.charAt(i)) * (10 - i);
  }
  let rev = 11 - (add % 11);
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(cleanCpf.charAt(9))) return false;
  
  // Valida 2o digito
  add = 0;
  for (let i = 0; i < 10; i++) {
    add += parseInt(cleanCpf.charAt(i)) * (11 - i);
  }
  rev = 11 - (add % 11);
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(cleanCpf.charAt(10))) return false;
  
  return true;
}

/**
 * Formata CPF para exibição
 * @param cpf - CPF a ser formatado
 * @returns string - CPF formatado (XXX.XXX.XXX-XX)
 */
export function formatCPF(cpf: string): string {
  const cleanCpf = cpf.replace(/[^\d]+/g, '');
  
  if (cleanCpf.length !== 11) return cpf;
  
  return cleanCpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}
```

### 2.3 Atualizar Rotas do Servidor (server/routes.ts)

```typescript
// Importar novos validadores
import { validateCNPJ, validateCPF } from "./cnpj-cpf-validator";

// Atualizar rota POST /api/suppliers
app.post(
  "/api/suppliers",
  isAuthenticated,
  isAdminOrBuyer,
  async (req, res) => {
    try {
      const supplierData = insertSupplierSchema.parse(req.body);
      
      // Validar CNPJ se fornecido
      if (supplierData.cnpj && !validateCNPJ(supplierData.cnpj)) {
        return res.status(400).json({ message: "CNPJ inválido" });
      }
      
      // Validar CPF se fornecido
      if (supplierData.cpf && !validateCPF(supplierData.cpf)) {
        return res.status(400).json({ message: "CPF inválido" });
      }
      
      const supplier = await storage.createSupplier(supplierData);
      res.status(201).json(supplier);
    } catch (error) {
      console.error("Error creating supplier:", error);
      res.status(400).json({ message: "Invalid supplier data" });
    }
  },
);

// Atualizar rota PUT /api/suppliers/:id
app.put(
  "/api/suppliers/:id",
  isAuthenticated,
  isAdminOrBuyer,
  async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const supplierData = updateSupplierSchema.parse(req.body);

      // Validar CNPJ se fornecido
      if (supplierData.cnpj && !validateCNPJ(supplierData.cnpj)) {
        return res.status(400).json({ message: "CNPJ inválido" });
      }
      
      // Validar CPF se fornecido
      if (supplierData.cpf && !validateCPF(supplierData.cpf)) {
        return res.status(400).json({ message: "CPF inválido" });
      }

      const supplier = await storage.updateSupplier(id, supplierData);
      res.json(supplier);
    } catch (error) {
      console.error("Error updating supplier:", error);
      res.status(400).json({ message: "Erro ao atualizar fornecedor" });
    }
  },
);
```

## 3. Modificações no Frontend

### 3.1 Criar Componente de Máscara (client/src/components/masked-input.tsx)

```typescript
import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';

interface MaskedInputProps {
  mask: 'cpf' | 'cnpj';
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function MaskedInput({ mask, value, onChange, placeholder, disabled, className }: MaskedInputProps) {
  const [formattedValue, setFormattedValue] = useState('');

  useEffect(() => {
    if (value !== formattedValue.replace(/[^\d]/g, '')) {
      setFormattedValue(formatValue(value, mask));
    }
  }, [value, mask]);

  const formatValue = (val: string, type: 'cpf' | 'cnpj'): string => {
    const clean = val.replace(/[^\d]/g, '');
    
    if (type === 'cpf') {
      return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    } else {
      return clean.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    const clean = input.replace(/[^\d]/g, '');
    
    if (mask === 'cpf' && clean.length > 11) return;
    if (mask === 'cnpj' && clean.length > 14) return;
    
    const formatted = formatValue(clean, mask);
    setFormattedValue(formatted);
    onChange(clean);
  };

  return (
    <Input
      value={formattedValue}
      onChange={handleChange}
      placeholder={placeholder || (mask === 'cpf' ? '000.000.000-00' : '00.000.000/0000-00')}
      disabled={disabled}
      className={className}
      maxLength={mask === 'cpf' ? 14 : 18}
    />
  );
}
```

### 3.2 Atualizar Componente de Fornecedores (client/src/pages/suppliers.tsx)

```typescript
// Importar novo componente
import { MaskedInput } from '@/components/masked-input';

// Atualizar schema de validação
const supplierSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  type: z.number().default(0),
  cnpj: z.string().optional(),
  cpf: z.string().optional(), // NOVO CAMPO
  contact: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  website: z.string().optional(),
  address: z.string().optional(),
  paymentTerms: z.string().optional(),
  idSupplierERP: z.number().optional(), // NOVO CAMPO
}).refine((data) => {
  // Validações por tipo
  if (data.type === 0) {
    // Pessoa Jurídica
    return data.cnpj && data.cnpj.length > 0;
  } else if (data.type === 2) {
    // Pessoa Física
    return data.cpf && data.cpf.length > 0;
  } else if (data.type === 1) {
    // Online
    return data.website && data.website.length > 0;
  }
  return true;
}, {
  message: "Campos obrigatórios não preenchidos para o tipo de fornecedor",
  path: ["type"],
});

// Atualizar formulário
<FormField
  control={form.control}
  name="type"
  render={({ field }) => (
    <FormItem>
      <FormLabel>Tipo de Fornecedor *</FormLabel>
      <Select onValueChange={(value) => field.onChange(Number(value))} value={field.value?.toString()}>
        <FormControl>
          <SelectTrigger>
            <SelectValue placeholder="Selecione o tipo" />
          </SelectTrigger>
        </FormControl>
        <SelectContent>
          <SelectItem value="0">Pessoa Jurídica</SelectItem>
          <SelectItem value="1">Online</SelectItem>
          <SelectItem value="2">Pessoa Física</SelectItem>
        </SelectContent>
      </Select>
      <FormMessage />
    </FormItem>
  )}
/>

<FormField
  control={form.control}
  name="cnpj"
  render={({ field }) => {
    const supplierType = form.watch("type");
    const isVisible = supplierType === 0;
    const isRequired = supplierType === 0;
    
    if (!isVisible) return null;
    
    return (
      <FormItem>
        <FormLabel>CNPJ {isRequired ? "*" : ""}</FormLabel>
        <FormControl>
          <MaskedInput
            mask="cnpj"
            value={field.value || ''}
            onChange={field.onChange}
            placeholder="00.000.000/0000-00"
          />
        </FormControl>
        <FormMessage />
      </FormItem>
    );
  }}
/>

<FormField
  control={form.control}
  name="cpf"
  render={({ field }) => {
    const supplierType = form.watch("type");
    const isVisible = supplierType === 2;
    const isRequired = supplierType === 2;
    
    if (!isVisible) return null;
    
    return (
      <FormItem>
        <FormLabel>CPF {isRequired ? "*" : ""}</FormLabel>
        <FormControl>
          <MaskedInput
            mask="cpf"
            value={field.value || ''}
            onChange={field.onChange}
            placeholder="000.000.000-00"
          />
        </FormControl>
        <FormMessage />
      </FormItem>
    );
  }}
/>

<FormField
  control={form.control}
  name="website"
  render={({ field }) => {
    const supplierType = form.watch("type");
    const isRequired = supplierType === 1;
    
    return (
      <FormItem>
        <FormLabel>Website {isRequired ? "*" : ""}</FormLabel>
        <FormControl>
          <Input 
            placeholder="https://exemplo.com" 
            {...field} 
          />
        </FormControl>
        <FormMessage />
      </FormItem>
    );
  }}
/>

<FormField
  control={form.control}
  name="idSupplierERP"
  render={({ field }) => (
    <FormItem>
      <FormLabel>ID Fornecedor ERP</FormLabel>
      <FormControl>
        <Input 
          type="number"
          placeholder="ID no sistema ERP externo" 
          {...field} 
          value={field.value || ''}
          onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
        />
      </FormControl>
      <FormMessage />
    </FormItem>
  )}
/>
```

### 3.3 Atualizar Modal de Criação de Fornecedor (client/src/components/supplier-creation-modal.tsx)

Aplicar as mesmas modificações do formulário principal no modal de criação rápida.

## 4. Testes e Validação

### 4.1 Script de Teste (tests/test-supplier-types.js)

```javascript
const { validateCPF, validateCNPJ } = require('../server/cnpj-cpf-validator');

// Testes de validação CPF
console.log('=== Testes CPF ===');
const cpfsValidos = ['529.982.247-25', '52998224725'];
const cpfsInvalidos = ['111.111.111-11', '123.456.789-00', 'invalido'];

cpfsValidos.forEach(cpf => {
  console.log(`CPF ${cpf}: ${validateCPF(cpf) ? 'VÁLIDO' : 'INVÁLIDO'}`);
});

cpfsInvalidos.forEach(cpf => {
  console.log(`CPF ${cpf}: ${validateCPF(cpf) ? 'VÁLIDO' : 'INVÁLIDO'}`);
});

// Testes de validação CNPJ
console.log('\n=== Testes CNPJ ===');
const cnpjsValidos = ['11.444.777/0001-61', '11444777000161'];
const cnpjsInvalidos = ['11.111.111/1111-11', 'invalido'];

cnpjsValidos.forEach(cnpj => {
  console.log(`CNPJ ${cnpj}: ${validateCNPJ(cnpj) ? 'VÁLIDO' : 'INVÁLIDO'}`);
});

cnpjsInvalidos.forEach(cnpj => {
  console.log(`CNPJ ${cnpj}: ${validateCNPJ(cnpj) ? 'VÁLIDO' : 'INVÁLIDO'}`);
});
```

### 4.2 Testes de Integração
- Criar fornecedor do tipo Pessoa Jurídica com CNPJ válido
- Criar fornecedor do tipo Pessoa Física com CPF válido
- Criar fornecedor Online com website válido
- Testar validações de campos obrigatórios por tipo
- Testar máscaras de formatação
- Testar atualização de fornecedores existentes

## 5. Considerações de Segurança

### 5.1 Validações no Backend
- Sempre validar CPF/CNPJ no backend independente do frontend
- Sanitizar inputs antes de processar
- Implementar rate limiting para prevenir abuso

### 5.2 Privacidade
- CPF é informação sensível - implementar criptografia se necessário
- Limitar exposição de dados pessoais em APIs
- Implementar logs de auditoria para acessos a dados sensíveis

## 6. Rollback Plan

### 6.1 Script de Rollback
```sql
-- Rollback migration
BEGIN;

-- Remover novos campos
ALTER TABLE suppliers 
  DROP COLUMN IF EXISTS cpf,
  DROP COLUMN IF EXISTS idSupplierERP;

-- Restaurar constraint original (se necessário)
ALTER TABLE suppliers 
  DROP CONSTRAINT IF EXISTS suppliers_type_check;

-- Remover índices
DROP INDEX IF EXISTS idx_suppliers_cpf;
DROP INDEX IF EXISTS idx_suppliers_idSupplierERP;

COMMIT;
```

## 7. Checklist de Implementação

- [ ] 1. Executar migration do banco de dados
- [ ] 2. Atualizar schema TypeScript
- [ ] 3. Implementar validadores CPF/CNPJ
- [ ] 4. Atualizar rotas do servidor
- [ ] 5. Criar componente MaskedInput
- [ ] 6. Atualizar formulário de fornecedores
- [ ] 7. Atualizar modal de criação
- [ ] 8. Testar validações
- [ ] 9. Testar máscaras
- [ ] 10. Testar fluxo completo
- [ ] 11. Documentar mudanças
- [ ] 12. Preparar rollback (se necessário)

## 8. Próximos Passos

Após implementação bem-sucedida:
1. Monitorar logs de erro
2. Coletar feedback de usuários
3. Otimizar performance se necessário
4. Considerar implementação de busca por CPF/CNPJ
5. Adicionar relatórios por tipo de fornecedor