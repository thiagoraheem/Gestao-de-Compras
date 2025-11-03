# Controle Global de Envio de E-mails - ENABLE_EMAIL_SENDING

## Visão Geral

A variável de ambiente `ENABLE_EMAIL_SENDING` permite controlar globalmente o envio de e-mails em todo o sistema. Esta funcionalidade é especialmente útil para ambientes de desenvolvimento, testes ou situações onde o envio de e-mails precisa ser temporariamente desabilitado.

## Configuração

### Arquivo .env

Adicione a seguinte linha ao seu arquivo `.env`:

```env
# Controle global de envio de e-mails
# Valores aceitos: 'true' (habilita) ou qualquer outro valor (desabilita)
# Padrão: false (desabilitado)
ENABLE_EMAIL_SENDING=false
```

### Variáveis de Ambiente do Sistema

Alternativamente, você pode definir a variável diretamente no sistema operacional:

**Windows:**
```cmd
set ENABLE_EMAIL_SENDING=true
```

**Linux/macOS:**
```bash
export ENABLE_EMAIL_SENDING=true
```

## Comportamento

### Valores Aceitos

- **`true`** (case insensitive): Habilita o envio de e-mails
  - Aceita: `true`, `TRUE`, `True`, `tRuE`, etc.
- **Qualquer outro valor**: Desabilita o envio de e-mails
  - Exemplos: `false`, `0`, `no`, `disabled`, `""` (vazio), etc.

### Valor Padrão

Se a variável não estiver definida, o sistema assume `false` (desabilitado) por segurança.

## Funcionalidades Afetadas

Quando `ENABLE_EMAIL_SENDING=false`, as seguintes funcionalidades são desabilitadas:

### 1. Serviços de Notificação
- Notificações de novas solicitações de compra
- Notificações de aprovação A1 e A2
- Notificações de rejeição
- Notificações de mudanças de quantidade
- Notificações de atualizações de versão
- Notificações de mudanças de prazo
- Notificações críticas

### 2. Sistema de Recuperação de Senha
- Envio de e-mails com tokens de recuperação
- Retorna erro 503 (Serviço Indisponível) quando desabilitado

### 3. Comunicação com Fornecedores
- Envio de RFQs (Request for Quotation) para fornecedores
- Retorna erro quando tentativa de envio é feita

### 4. Testes de Configuração
- Função `testEmailConfiguration()` retorna `false` quando desabilitado

## Logs e Monitoramento

### Mensagens de Log

Quando o envio de e-mails está desabilitado, o sistema registra mensagens informativas:

```
📧 [EMAIL DISABLED] Envio de e-mail desabilitado globalmente pela variável ENABLE_EMAIL_SENDING
📧 [EMAIL DISABLED] Tentativa de envio de RFQ bloqueada - envio de e-mails desabilitado
📧 [EMAIL DISABLED] Tentativa de recuperação de senha para user@example.com foi bloqueada - envio de e-mails desabilitado
```

### Identificação Visual

Todas as mensagens de log relacionadas ao controle de e-mail são prefixadas com `📧 [EMAIL DISABLED]` para fácil identificação.

## Segurança

### Proteção de Dados

- Mesmo com o envio desabilitado, todas as outras funcionalidades continuam operando normalmente
- Dados de usuários e configurações são preservados
- Tokens de recuperação de senha ainda são gerados (mas não enviados)
- Logs não expõem informações sensíveis

### Prevenção de Vazamentos

- Em ambientes de desenvolvimento, previne envio acidental de e-mails para usuários reais
- Evita spam durante testes automatizados
- Protege contra configurações incorretas de SMTP

## Implementação Técnica

### Arquivos Modificados

1. **`server/config.ts`**
   - Carregamento da variável de ambiente
   - Função utilitária `isEmailEnabled()`

2. **`server/email-service.ts`**
   - Verificação em todas as funções de envio de e-mail
   - Tratamento de erros específicos

3. **`server/services/notification-service.ts`**
   - Verificação no serviço de notificações
   - Logs informativos

4. **`server/routes/auth.ts`**
   - Verificação na recuperação de senha
   - Retorno de erro 503 quando desabilitado

### Função Utilitária

```typescript
/**
 * Verifica se o envio de e-mails está habilitado globalmente
 * @returns {boolean} true se habilitado, false caso contrário
 */
export function isEmailEnabled(): boolean {
  if (!config.email.enabled) {
    console.log('📧 [EMAIL DISABLED] Envio de e-mail desabilitado globalmente pela variável ENABLE_EMAIL_SENDING');
    return false;
  }
  return true;
}
```

## Casos de Uso

### Desenvolvimento Local
```env
ENABLE_EMAIL_SENDING=false
```
Evita envio de e-mails durante desenvolvimento.

### Ambiente de Testes
```env
ENABLE_EMAIL_SENDING=false
```
Previne spam durante execução de testes automatizados.

### Ambiente de Produção
```env
ENABLE_EMAIL_SENDING=true
```
Habilita envio normal de e-mails.

### Manutenção Temporária
```env
ENABLE_EMAIL_SENDING=false
```
Desabilita temporariamente durante manutenção do servidor SMTP.

## Troubleshooting

### Problema: E-mails não estão sendo enviados

1. Verifique o valor da variável `ENABLE_EMAIL_SENDING`
2. Procure por mensagens `[EMAIL DISABLED]` nos logs
3. Confirme se a variável está definida corretamente no `.env`

### Problema: Erro 503 na recuperação de senha

- Indica que `ENABLE_EMAIL_SENDING=false`
- Habilite o envio de e-mails ou configure método alternativo de recuperação

### Problema: RFQs não são enviados

- Verifique logs para mensagens de bloqueio
- Confirme configuração da variável de ambiente

## Considerações Importantes

1. **Reinicialização**: Mudanças na variável requerem reinicialização do servidor
2. **Prioridade**: Variáveis do sistema operacional têm prioridade sobre o arquivo `.env`
3. **Case Sensitivity**: Apenas `true` (case insensitive) habilita o envio
4. **Logs**: Monitore os logs para identificar tentativas de envio bloqueadas
5. **Testes**: Sempre teste a configuração após mudanças

## Suporte

Para dúvidas ou problemas relacionados ao controle de envio de e-mails, consulte:

1. Os logs do sistema para mensagens `[EMAIL DISABLED]`
2. A configuração atual no arquivo `.env`
3. As variáveis de ambiente do sistema operacional
4. Esta documentação para referência completa