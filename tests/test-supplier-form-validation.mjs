// Test script for supplier form validation
import { z } from 'zod';

// Simulate the supplier schema from the modal
const supplierSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  type: z.number().min(0).max(2),
  cnpj: z.string().optional(),
  cpf: z.string().optional(),
  contact: z.string().optional(),
  email: z.string().email("Email inválido").optional(),
  phone: z.string().optional(),
  website: z.string().url("URL inválida").optional(),
  paymentTerms: z.string().optional(),
  address: z.string().optional(),
  idSupplierERP: z.union([z.number(), z.null()]).optional(),
}).superRefine((data, ctx) => {
  // Type 0 (Pessoa Jurídica) validation
  if (data.type === 0) {
    if (!data.cnpj || data.cnpj.trim() === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "CNPJ é obrigatório para Pessoa Jurídica",
        path: ["cnpj"]
      });
    }
    if (!data.contact || data.contact.trim() === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Contato é obrigatório para Pessoa Jurídica",
        path: ["contact"]
      });
    }
    if (!data.email || data.email.trim() === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Email é obrigatório para Pessoa Jurídica",
        path: ["email"]
      });
    }
    if (!data.phone || data.phone.trim() === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Telefone é obrigatório para Pessoa Jurídica",
        path: ["phone"]
      });
    }
  }

  // Type 1 (Online) validation
  if (data.type === 1) {
    if (!data.website || data.website.trim() === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Site é obrigatório para Fornecedor Online",
        path: ["website"]
      });
    }
  }

  // Type 2 (Pessoa Física) validation
  if (data.type === 2) {
    if (!data.cpf || data.cpf.trim() === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "CPF é obrigatório para Pessoa Física",
        path: ["cpf"]
      });
    }
    if (!data.contact || data.contact.trim() === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Contato é obrigatório para Pessoa Física",
        path: ["contact"]
      });
    }
    if (!data.email || data.email.trim() === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Email é obrigatório para Pessoa Física",
        path: ["email"]
      });
    }
    if (!data.phone || data.phone.trim() === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Telefone é obrigatório para Pessoa Física",
        path: ["phone"]
      });
    }
  }
});

console.log('Testing Supplier Form Validation...\n');

// Test 1: Pessoa Jurídica (Type 0) - Valid
console.log('Test 1: Pessoa Jurídica (Type 0) - Valid');
try {
  const result = supplierSchema.parse({
    name: 'Fornecedor Teste Ltda',
    type: 0,
    cnpj: '11.444.777/0001-61',
    contact: 'João Silva',
    email: 'joao@fornecedor.com.br',
    phone: '(11) 99999-9999',
    address: 'Rua Teste, 123'
  });
  console.log('✓ Valid Pessoa Jurídica accepted');
} catch (error) {
  console.log('✗ Valid Pessoa Jurídica rejected:', error.errors);
}

// Test 2: Pessoa Jurídica (Type 0) - Missing CNPJ
console.log('\nTest 2: Pessoa Jurídica (Type 0) - Missing CNPJ');
try {
  const result = supplierSchema.parse({
    name: 'Fornecedor Teste Ltda',
    type: 0,
    contact: 'João Silva',
    email: 'joao@fornecedor.com.br',
    phone: '(11) 99999-9999'
  });
  console.log('✗ Invalid Pessoa Jurídica accepted (should be rejected)');
} catch (error) {
  console.log('✓ Missing CNPJ correctly rejected:', error.errors.map(e => e.message));
}

// Test 3: Fornecedor Online (Type 1) - Valid
console.log('\nTest 3: Fornecedor Online (Type 1) - Valid');
try {
  const result = supplierSchema.parse({
    name: 'Loja Online Teste',
    type: 1,
    website: 'https://www.lojaonline.com.br',
    address: 'www.lojaonline.com.br'
  });
  console.log('✓ Valid Fornecedor Online accepted');
} catch (error) {
  console.log('✗ Valid Fornecedor Online rejected:', error.errors);
}

// Test 4: Fornecedor Online (Type 1) - Missing Website
console.log('\nTest 4: Fornecedor Online (Type 1) - Missing Website');
try {
  const result = supplierSchema.parse({
    name: 'Loja Online Teste',
    type: 1,
    address: 'www.lojaonline.com.br'
  });
  console.log('✗ Invalid Fornecedor Online accepted (should be rejected)');
} catch (error) {
  console.log('✓ Missing website correctly rejected:', error.errors.map(e => e.message));
}

// Test 5: Pessoa Física (Type 2) - Valid
console.log('\nTest 5: Pessoa Física (Type 2) - Valid');
try {
  const result = supplierSchema.parse({
    name: 'Maria Souza',
    type: 2,
    cpf: '529.982.247-25',
    contact: 'Maria Souza',
    email: 'maria@gmail.com',
    phone: '(11) 98888-8888',
    address: 'Rua das Flores, 456'
  });
  console.log('✓ Valid Pessoa Física accepted');
} catch (error) {
  console.log('✗ Valid Pessoa Física rejected:', error.errors);
}

// Test 6: Pessoa Física (Type 2) - Missing CPF
console.log('\nTest 6: Pessoa Física (Type 2) - Missing CPF');
try {
  const result = supplierSchema.parse({
    name: 'Maria Souza',
    type: 2,
    contact: 'Maria Souza',
    email: 'maria@gmail.com',
    phone: '(11) 98888-8888'
  });
  console.log('✗ Invalid Pessoa Física accepted (should be rejected)');
} catch (error) {
  console.log('✓ Missing CPF correctly rejected:', error.errors.map(e => e.message));
}

// Test 7: With idSupplierERP
console.log('\nTest 7: With idSupplierERP field');
try {
  const result = supplierSchema.parse({
    name: 'Fornecedor com ERP',
    type: 0,
    cnpj: '11.444.777/0001-61',
    contact: 'João Silva',
    email: 'joao@fornecedor.com.br',
    phone: '(11) 99999-9999',
    idSupplierERP: 12345
  });
  console.log('✓ Supplier with idSupplierERP accepted:', result.idSupplierERP);
} catch (error) {
  console.log('✗ Supplier with idSupplierERP rejected:', error.errors);
}

console.log('\nAll tests completed!');