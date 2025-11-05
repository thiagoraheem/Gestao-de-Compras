/**
 * Validação de CPF e CNPJ
 * Implementa algoritmos de validação e formatação
 */

/**
 * Remove todos os caracteres não numéricos
 */
function removeNonNumeric(value: string): string {
  return value.replace(/\D/g, '');
}

/**
 * Valida CPF
 * @param cpf CPF com ou sem formatação (999.999.999-99 ou 99999999999)
 * @returns boolean indicando se o CPF é válido
 */
export function validateCPF(cpf: string): boolean {
  if (!cpf) return false;
  
  const cleanCPF = removeNonNumeric(cpf);
  
  // Verifica se tem 11 dígitos
  if (cleanCPF.length !== 11) return false;
  
  // Verifica se todos os dígitos são iguais (CPF inválido)
  if (/^(\d)\1{10}$/.test(cleanCPF)) return false;
  
  // Calcula o primeiro dígito verificador
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleanCPF.charAt(i)) * (10 - i);
  }
  let remainder = sum % 11;
  let firstDigit = remainder < 2 ? 0 : 11 - remainder;
  
  if (parseInt(cleanCPF.charAt(9)) !== firstDigit) return false;
  
  // Calcula o segundo dígito verificador
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleanCPF.charAt(i)) * (11 - i);
  }
  remainder = sum % 11;
  let secondDigit = remainder < 2 ? 0 : 11 - remainder;
  
  return parseInt(cleanCPF.charAt(10)) === secondDigit;
}

/**
 * Valida CNPJ
 * @param cnpj CNPJ com ou sem formatação (99.999.999/9999-99 ou 99999999999999)
 * @returns boolean indicando se o CNPJ é válido
 */
export function validateCNPJ(cnpj: string): boolean {
  if (!cnpj) return false;
  
  const cleanCNPJ = removeNonNumeric(cnpj);
  
  // Verifica se tem 14 dígitos
  if (cleanCNPJ.length !== 14) return false;
  
  // Verifica se todos os dígitos são iguais (CNPJ inválido)
  if (/^(\d)\1{13}$/.test(cleanCNPJ)) return false;
  
  // Calcula o primeiro dígito verificador
  let sum = 0;
  const firstWeights = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  for (let i = 0; i < 12; i++) {
    sum += parseInt(cleanCNPJ.charAt(i)) * firstWeights[i];
  }
  let remainder = sum % 11;
  let firstDigit = remainder < 2 ? 0 : 11 - remainder;
  
  if (parseInt(cleanCNPJ.charAt(12)) !== firstDigit) return false;
  
  // Calcula o segundo dígito verificador
  sum = 0;
  const secondWeights = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  for (let i = 0; i < 13; i++) {
    sum += parseInt(cleanCNPJ.charAt(i)) * secondWeights[i];
  }
  remainder = sum % 11;
  let secondDigit = remainder < 2 ? 0 : 11 - remainder;
  
  return parseInt(cleanCNPJ.charAt(13)) === secondDigit;
}

/**
 * Formata CPF (99999999999 -> 999.999.999-99)
 * @param cpf CPF com ou sem formatação
 * @returns CPF formatado ou string vazia se inválido
 */
export function formatCPF(cpf: string): string {
  if (!cpf) return '';
  
  const cleanCPF = removeNonNumeric(cpf);
  
  if (cleanCPF.length !== 11) return cpf;
  
  return cleanCPF.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

/**
 * Formata CNPJ (99999999999999 -> 99.999.999/9999-99)
 * @param cnpj CNPJ com ou sem formatação
 * @returns CNPJ formatado ou string vazia se inválido
 */
export function formatCNPJ(cnpj: string): string {
  if (!cnpj) return '';
  
  const cleanCNPJ = removeNonNumeric(cnpj);
  
  if (cleanCNPJ.length !== 14) return cnpj;
  
  return cleanCNPJ.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
}

/**
 * Remove formatação de CPF ou CNPJ
 * @param value Valor com ou sem formatação
 * @returns Valor sem formatação
 */
export function unformatDocument(value: string): string {
  return removeNonNumeric(value);
}

/**
 * Detecta se o valor é CPF ou CNPJ baseado no tamanho
 * @param value Documento com ou sem formatação
 * @returns 'CPF' | 'CNPJ' | 'unknown'
 */
export function detectDocumentType(value: string): 'CPF' | 'CNPJ' | 'unknown' {
  if (!value) return 'unknown';
  
  const cleanValue = removeNonNumeric(value);
  
  if (cleanValue.length === 11) return 'CPF';
  if (cleanValue.length === 14) return 'CNPJ';
  
  return 'unknown';
}