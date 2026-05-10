/**
 * Utilitários de formatação compartilhados para o servidor
 */

/**
 * Formata um valor numérico para moeda brasileira (BRL)
 */
export const formatCurrency = (value: number | string | null | undefined): string => {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (num === null || num === undefined || isNaN(num)) {
    return 'R$ 0,00';
  }
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(num);
};

/**
 * Formata uma data para o padrão brasileiro (DD/MM/AAAA)
 */
export const formatDate = (date: Date | string | null | undefined): string => {
  if (!date) return 'Não informado';
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return 'Não informado';
    return d.toLocaleDateString('pt-BR');
  } catch {
    return 'Não informado';
  }
};

/**
 * Formata uma data e hora para o padrão brasileiro (DD/MM/AAAA HH:mm)
 */
export const formatDateTime = (date: Date | string | null | undefined): string => {
  if (!date) return 'Não informado';
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return 'Não informado';
    return d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return 'Não informado';
  }
};

/**
 * Escapa strings para uso em CSV
 */
export const escapeCsv = (val: any): string => {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};
