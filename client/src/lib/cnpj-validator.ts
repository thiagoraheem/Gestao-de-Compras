/**
 * Valida CNPJ brasileiro no frontend
 * @param cnpj - CNPJ a ser validado (com ou sem formatação)
 * @returns boolean - true se válido, false se inválido
 */
export function validateCNPJ(cnpj: string): boolean {
  // Remove caracteres especiais
  const cleanCnpj = cnpj.replace(/[^\d]+/g, '');

  // Verifica se tem 14 dígitos
  if (cleanCnpj.length !== 14) return false;

  // Verifica se todos os dígitos são iguais
  if (/^(\d)\1+$/.test(cleanCnpj)) return false;

  // Cálculo do primeiro dígito verificador
  let sum = 0;
  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  
  for (let i = 0; i < 12; i++) {
    sum += parseInt(cleanCnpj.charAt(i)) * weights1[i];
  }
  
  let remainder = sum % 11;
  let firstDigit = remainder < 2 ? 0 : 11 - remainder;
  
  // Verifica o primeiro dígito
  if (parseInt(cleanCnpj.charAt(12)) !== firstDigit) return false;

  // Cálculo do segundo dígito verificador
  sum = 0;
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  
  for (let i = 0; i < 13; i++) {
    sum += parseInt(cleanCnpj.charAt(i)) * weights2[i];
  }
  
  remainder = sum % 11;
  let secondDigit = remainder < 2 ? 0 : 11 - remainder;
  
  // Verifica o segundo dígito
  return parseInt(cleanCnpj.charAt(13)) === secondDigit;
}

/**
 * Formata CNPJ para exibição
 * @param cnpj - CNPJ a ser formatado
 * @returns string - CNPJ formatado (XX.XXX.XXX/XXXX-XX)
 */
export function formatCNPJ(cnpj: string): string {
  const cleanCnpj = cnpj.replace(/[^\d]+/g, '');
  
  if (cleanCnpj.length !== 14) return cnpj;
  
  return cleanCnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
}

/**
 * Remove formatação do CNPJ
 * @param cnpj - CNPJ formatado
 * @returns string - CNPJ apenas com números
 */
export function cleanCNPJ(cnpj: string): string {
  return cnpj.replace(/[^\d]+/g, '');
}

/**
 * Aplica máscara ao CNPJ conforme digitação
 * @param value - Valor atual do input
 * @returns string - Valor com máscara aplicada
 */
export function applyCNPJMask(value: string): string {
  // Remove tudo que não é dígito
  const cleanValue = value.replace(/[^\d]/g, '');
  
  // Aplica a máscara progressivamente
  if (cleanValue.length <= 2) return cleanValue;
  if (cleanValue.length <= 5) return cleanValue.replace(/(\d{2})(\d{0,3})/, '$1.$2');
  if (cleanValue.length <= 8) return cleanValue.replace(/(\d{2})(\d{3})(\d{0,3})/, '$1.$2.$3');
  if (cleanValue.length <= 12) return cleanValue.replace(/(\d{2})(\d{3})(\d{3})(\d{0,4})/, '$1.$2.$3/$4');
  return cleanValue.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{0,2})/, '$1.$2.$3/$4-$5');
}