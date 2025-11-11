// Teste de validação de mensagens detalhadas de issues na integração de fornecedores
// Reproduz a lógica essencial do backend para gerar mensagens por campo, regra e sugestão

const { z } = require('zod');

// Validações CPF/CNPJ (algoritmo simplificado porém funcional)
function onlyDigits(value) {
  return (value || '').replace(/\D+/g, '');
}

function isAllSameDigits(digits) {
  return /^([0-9])\1*$/.test(digits);
}

function validateCPF(cpf) {
  const digits = onlyDigits(cpf);
  if (digits.length !== 11) return false;
  if (isAllSameDigits(digits)) return false;
  // cálculo dos dígitos verificadores
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(digits.charAt(i), 10) * (10 - i);
  let rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(digits.charAt(9), 10)) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(digits.charAt(i), 10) * (11 - i);
  rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  return rev === parseInt(digits.charAt(10), 10);
}

function validateCNPJ(cnpj) {
  const digits = onlyDigits(cnpj);
  if (digits.length !== 14) return false;
  if (isAllSameDigits(digits)) return false;
  const calc = (base) => {
    let size = base.length;
    let numbers = base.substring(0, size);
    let sum = 0;
    let pos = size - 7;
    for (let i = size; i >= 1; i--) {
      sum += parseInt(numbers.charAt(size - i), 10) * pos--;
      if (pos < 2) pos = 9;
    }
    const result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
    return result;
  };
  const dv1 = calc(digits.slice(0, 12));
  if (dv1 !== parseInt(digits.charAt(12), 10)) return false;
  const dv2 = calc(digits.slice(0, 13));
  return dv2 === parseInt(digits.charAt(13), 10);
}

// Schema semelhante ao insertSupplierSchema com regra de refine por tipo
const insertSupplierSafeSchema = z
  .object({
    name: z.string().min(1, 'Nome é obrigatório'),
    type: z.number(),
    cnpj: z.string().optional(),
    cpf: z.string().optional(),
    contact: z.string().optional(),
    email: z.string().optional(),
    phone: z.string().optional(),
    website: z.string().optional(),
    address: z.string().optional(),
    paymentTerms: z.string().optional(),
    idSupplierERP: z.number(),
  })
  .refine(
    (data) => {
      if (data.type === 0) {
        return data.cnpj && data.contact && data.email && data.phone;
      }
      if (data.type === 1) {
        return !!data.website;
      }
      if (data.type === 2) {
        return data.cpf && data.contact && data.email && data.phone;
      }
      return true;
    },
    {
      message:
        'Para fornecedores Pessoa Jurídica (Tipo 0): CNPJ, Contato, E-mail e Telefone são obrigatórios. Para fornecedores Online (Tipo 1): Site é obrigatório. Para fornecedores Pessoa Física (Tipo 2): CPF, Contato, E-mail e Telefone são obrigatórios.',
      path: ['type'],
    },
  );

function buildInsertData(erpSupplier) {
  const issues = [];
  const sanitizedCnpj = erpSupplier.cnpj;
  const sanitizedCpf = erpSupplier.cpf;

  if (sanitizedCnpj && !validateCNPJ(sanitizedCnpj)) {
    issues.push(
      `Validação falhou: CNPJ — Valor atual: ${sanitizedCnpj} — Regra: CNPJ deve conter 14 dígitos válidos — Sugestão: Informe apenas números e verifique o dígito verificador`,
    );
  }

  if (sanitizedCpf && !validateCPF(sanitizedCpf)) {
    issues.push(
      `Validação falhou: CPF — Valor atual: ${sanitizedCpf} — Regra: CPF deve conter 11 dígitos válidos — Sugestão: Informe apenas números e verifique o dígito verificador`,
    );
  }

  const type = sanitizedCnpj ? 0 : sanitizedCpf ? 2 : (erpSupplier.type ?? 0);

  const candidate = {
    name: erpSupplier.name,
    type,
    cnpj: sanitizedCnpj ?? undefined,
    cpf: sanitizedCpf ?? undefined,
    contact: erpSupplier.contact ?? undefined,
    email: erpSupplier.email ?? undefined,
    phone: erpSupplier.phone ?? undefined,
    website: erpSupplier.website ?? undefined,
    address: erpSupplier.address ?? undefined,
    paymentTerms: erpSupplier.paymentTerms ?? undefined,
    idSupplierERP: erpSupplier.id ?? 0,
  };

  try {
    const parsed = insertSupplierSafeSchema.parse(candidate);
    return { success: true, data: parsed, issues };
  } catch (error) {
    const label = (field) => {
      switch (field) {
        case 'cnpj':
          return 'CNPJ';
        case 'cpf':
          return 'CPF';
        case 'contact':
          return 'Contato';
        case 'email':
          return 'E-mail';
        case 'phone':
          return 'Telefone';
        case 'website':
          return 'Website';
        case 'name':
          return 'Nome';
        default:
          return field;
      }
    };

    const formatVal = (val) => {
      if (val === null || val === undefined || val === '') return '<vazio>';
      return String(val);
    };

    const requiredByType = {
      0: ['cnpj', 'contact', 'email', 'phone'],
      1: ['website'],
      2: ['cpf', 'contact', 'email', 'phone'],
    };

    const requiredFields = requiredByType[type] || [];
    for (const field of requiredFields) {
      const value = candidate[field];
      const has = value !== undefined && value !== null && String(value).trim() !== '';
      if (!has) {
        const rule =
          field === 'cnpj'
            ? 'Pessoa Jurídica requer CNPJ'
            : field === 'cpf'
            ? 'Pessoa Física requer CPF'
            : field === 'website'
            ? 'Fornecedores Online requerem Website'
            : 'Campo obrigatório para o tipo selecionado';
        const suggestion =
          field === 'cnpj'
            ? 'Informe um CNPJ válido com 14 dígitos (apenas números).'
            : field === 'cpf'
            ? 'Informe um CPF válido com 11 dígitos (apenas números).'
            : field === 'email'
            ? 'Informe um e-mail válido (ex: nome@dominio.com).'
            : field === 'phone'
            ? 'Informe telefone com DDD (ex: 11999999999).'
            : field === 'contact'
            ? 'Informe o nome do contato responsável.'
            : field === 'website'
            ? 'Informe uma URL (ex: https://exemplo.com).'
            : 'Preencha o campo obrigatório.';
        issues.push(
          `Campo obrigatório ausente: ${label(String(field))} — Valor atual: ${formatVal(
            value,
          )} — Regra: ${rule} — Sugestão: ${suggestion}`,
        );
      }
    }

    if (!candidate.name || String(candidate.name).trim() === '') {
      issues.push(
        `Campo obrigatório ausente: Nome — Valor atual: ${formatVal(
          candidate.name,
        )} — Regra: Nome é obrigatório — Sugestão: Informe o nome do fornecedor.`,
      );
    }

    if (error instanceof z.ZodError) {
      for (const issue of error.issues) {
        const pathField = issue.path?.[0];
        const currentVal = pathField ? candidate[pathField] : undefined;
        const base = pathField
          ? `${label(pathField)} — Valor atual: ${formatVal(currentVal)}`
          : `Validação — Valor atual: ${formatVal(null)}`;
        let rule = issue.message || 'Regra de validação não atendida';
        if (issue.code === z.ZodIssueCode.invalid_type) rule = 'Tipo inválido ou campo ausente';
        else if (issue.code === z.ZodIssueCode.too_small) rule = 'Campo com tamanho abaixo do mínimo';
        else if (issue.code === z.ZodIssueCode.custom) rule = issue.message || 'Regra personalizada não atendida';
        const suggestion =
          pathField === 'name'
            ? 'Informe o nome do fornecedor.'
            : pathField === 'cnpj'
            ? 'Informe um CNPJ válido com 14 dígitos (apenas números).'
            : pathField === 'cpf'
            ? 'Informe um CPF válido com 11 dígitos (apenas números).'
            : pathField === 'email'
            ? 'Informe um e-mail válido (ex: nome@dominio.com).'
            : pathField === 'phone'
            ? 'Informe telefone com DDD (ex: 11999999999).'
            : pathField === 'website'
            ? 'Informe uma URL (ex: https://exemplo.com).'
            : 'Corrija o valor conforme a regra.';
        const detailed = `Validação falhou: ${base} — Regra: ${rule} — Sugestão: ${suggestion}`;
        if (!issues.some((i) => i === detailed)) issues.push(detailed);
      }
    } else {
      issues.push('Erro inesperado ao validar dados do fornecedor');
    }

    return { success: false, issues };
  }
}

function assertContains(str, parts) {
  for (const p of parts) {
    if (!str.includes(p)) {
      throw new Error(`Esperado conter "${p}" em: ${str}`);
    }
  }
}

function runTests() {
  let passed = 0;
  let failed = 0;

  const cases = [
    {
      name: 'PJ com campos obrigatórios ausentes',
      input: { id: 1, name: 'Empresa X', cnpj: null, contact: '', email: null, phone: null, type: 0 },
      expects: [
        ['Campo obrigatório ausente: CNPJ', 'Pessoa Jurídica requer CNPJ'],
        ['Campo obrigatório ausente: Contato', 'Campo obrigatório para o tipo selecionado'],
        ['Campo obrigatório ausente: E-mail', 'Campo obrigatório para o tipo selecionado'],
        ['Campo obrigatório ausente: Telefone', 'Campo obrigatório para o tipo selecionado'],
      ],
    },
    {
      name: 'PF com CPF inválido',
      input: { id: 2, name: 'Fulano', cpf: '12345678900', contact: 'Contato', email: 'f@e.com', phone: '11999999999', type: 2 },
      expects: [[
        'Validação falhou: CPF',
        'CPF deve conter 11 dígitos válidos',
        'Sugestão: Informe apenas números e verifique o dígito verificador',
      ]],
    },
    {
      name: 'Online sem website',
      input: { id: 3, name: 'Loja Online', website: '', type: 1 },
      expects: [[
        'Campo obrigatório ausente: Website',
        'Fornecedores Online requerem Website',
        'Sugestão: Informe uma URL (ex: https://exemplo.com).',
      ]],
    },
    {
      name: 'PJ com CNPJ inválido',
      input: { id: 4, name: 'Empresa Y', cnpj: '11111111111111', contact: 'Contato', email: 'e@x.com', phone: '11911111111', type: 0 },
      expects: [[
        'Validação falhou: CNPJ',
        'CNPJ deve conter 14 dígitos válidos',
        'Sugestão: Informe apenas números e verifique o dígito verificador',
      ]],
    },
    {
      name: 'PF válido deve ter issues vazios',
      // CPF válido de exemplo: 52998224725
      input: { id: 5, name: 'Ciclano', cpf: '529.982.247-25', contact: 'Contato', email: 'c@e.com', phone: '11922222222', type: 2 },
      expectsEmpty: true,
    },
  ];

  for (const tc of cases) {
    try {
      const result = buildInsertData(tc.input);
      const issues = result.issues || [];
      if (tc.expectsEmpty) {
        if (issues.length > 0) {
          throw new Error(`Esperado 0 issues, recebido ${issues.length}:\n${issues.join('\n')}`);
        }
      } else {
        for (const parts of tc.expects) {
          const matched = issues.find((msg) => parts.every((p) => msg.includes(p)));
          if (!matched) {
            throw new Error(
              `Mensagem esperada não encontrada para caso "${tc.name}". Issues:\n${issues.join('\n')}`,
            );
          }
        }
      }
      console.log(`OK: ${tc.name}`);
      passed++;
    } catch (err) {
      console.error(`FALHA: ${tc.name}\n${err.message}`);
      failed++;
    }
  }

  console.log(`\nResultados: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

runTests();