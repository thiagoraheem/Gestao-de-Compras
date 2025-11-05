/**
 * Valida CPF brasileiro
 * @param cpf - CPF a ser validado (com ou sem formatação)
 * @returns boolean - true se válido, false se inválido
 */
export function validateCPF(cpf: string): boolean {
  // Remove caracteres especiais
  const cleanCpf = cpf.replace(/[^\d]+/g, '');

  // Verifica se tem 11 dígitos
  if (cleanCpf.length !== 11) return false;

  // Verifica se todos os dígitos são iguais
  if (/^(\d)\1+$/.test(cleanCpf)) return false;

  // Cálculo do primeiro dígito verificador
  let sum = 0;
  const weights1 = [10, 9, 8, 7, 6, 5, 4, 3, 2];
  
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleanCpf.charAt(i)) * weights1[i];
  }
  
  let remainder = sum % 11;
  let firstDigit = remainder < 2 ? 0 : 11 - remainder;
  
  // Verifica o primeiro dígito
  if (parseInt(cleanCpf.charAt(9)) !== firstDigit) return false;

  // Cálculo do segundo dígito verificador
  sum = 0;
  const weights2 = [11, 10, 9, 8, 7, 6, 5, 4, 3, 2];
  
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleanCpf.charAt(i)) * weights2[i];
  }
  
  remainder = sum % 11;
  let secondDigit = remainder < 2 ? 0 : 11 - remainder;
  
  // Verifica o segundo dígito
  return parseInt(cleanCpf.charAt(10)) === secondDigit;
}

/**
 * Aplica máscara de CPF
 * @param cpf - CPF a ser formatado
 * @returns string - CPF formatado (XXX.XXX.XXX-XX)
 */
export function applyCPFMask(cpf: string): string {
  const cleanCpf = cpf.replace(/[^\d]+/g, '');
  
  if (cleanCpf.length <= 3) return cleanCpf;
  if (cleanCpf.length <= 6) return cleanCpf.replace(/(\d{3})(\d+)/, '$1.$2');
  if (cleanCpf.length <= 9) return cleanCpf.replace(/(\d{3})(\d{3})(\d+)/, '$1.$2.$3');
  
  return cleanCpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}