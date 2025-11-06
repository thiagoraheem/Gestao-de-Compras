# Guia de Uso - Integração de Fornecedores com ERP

## Visão Geral

O sistema de integração de fornecedores permite sincronizar os dados de fornecedores entre o sistema local e o ERP externo, garantindo que ambos estejam sempre atualizados.

## Acesso à Integração

1. Acesse o menu **Fornecedores**
2. Clique no botão **"Integrar com ERP"** (localizado no canto superior direito)
3. Você será redirecionado para a tela de integração

## Funcionalidades

### 1. Carregar Fornecedores do ERP

- Clique em **"Carregar Fornecedores do ERP"** para buscar todos os fornecedores do sistema ERP
- O sistema exibirá uma barra de progresso durante o carregamento
- Após o carregamento, os fornecedores serão comparados automaticamente

### 2. Tipos de Integração

#### Integração Completa
- Busca e compara TODOS os fornecedores do ERP
- Útil para sincronização inicial ou completa

#### Integração Incremental
- Busca apenas fornecedores novos ou modificados desde a última integração
- Mais rápida e eficiente para atualizações diárias

### 3. Lógica de Comparação

O sistema compara fornecedores na seguinte ordem de prioridade:

1. **ID do Fornecedor ERP** (`idsuppliererp`)
   - Se encontrado → Ignora na integração (já sincronizado)
2. **CNPJ/CPF**
   - Se encontrado → Atualiza o `idsuppliererp` com o ID do ERP
3. **Novo Fornecedor**
   - Se não encontrado → Marca para cadastro

### 4. Ações Disponíveis

#### Visualizar Comparação
- Veja lado a lado os dados do sistema local vs ERP
- Identifique diferenças e conflitos
- Filtre por tipo de ação (criar, atualizar, ignorar)

#### Processar Integração
- Selecione os fornecedores desejados (use o checkbox)
- Clique em **"Processar Selecionados"**
- Confirme a ação no diálogo de confirmação
- Acompanhe o progresso em tempo real

#### Cancelar Processo
- Clique em **"Cancelar Processo"** para interromper a integração
- O histórico será mantido para referência

### 5. Histórico de Integrações

- Acesse o histórico clicando na aba **"Histórico de Integrações"**
- Visualize todas as integrações realizadas
- Veja detalhes como:
  - Data e hora da integração
  - Total de fornecedores processados
  - Novos fornecedores cadastrados
  - Fornecedores atualizados
  - Status da integração

### 6. Filtros e Busca

#### Filtros Disponíveis
- **Tipo de Ação**: Criar, Atualizar, Ignorar
- **Status**: Processado, Pendente, Erro
- **Tipo de Fornecedor**: Pessoa Jurídica, Pessoa Física, Online

#### Busca Rápida
- Use a barra de busca para encontrar fornecedores específicos
- Busca por: nome, CNPJ, CPF, email, telefone

## Indicadores Visuais

### Cores dos Status
- 🟢 **Verde**: Fornecedor sincronizado com ERP
- 🔵 **Azul**: Novo fornecedor para cadastrar
- 🟡 **Amarelo**: Fornecedor será atualizado
- ⚪ **Cinza**: Fornecedor será ignorado (já sincronizado)
- 🔴 **Vermelho**: Erro durante o processamento

### Badges e Etiquetas
- **"Novo"**: Fornecedor não existe no sistema local
- **"Atualizar"**: Fornecedor existe mas precisa de atualização
- **"Sincronizado"**: Fornecedor já está atualizado
- **"Erro"**: Problema durante o processamento

## Boas Práticas

### Antes de Integrar
1. **Backup**: Faça backup dos dados antes de grandes integrações
2. **Horário**: Execute integrações completas em horários de baixo uso
3. **Validação**: Verifique os dados do ERP antes da integração

### Durante a Integração
1. **Acompanhamento**: Monitore o progresso e erros
2. **Cancelamento**: Cancelar se necessário (o processo é reversível)
3. **Performance**: Evite executar outras operações pesadas simultaneamente

### Após a Integração
1. **Verificação**: Confira os resultados no histórico
2. **Validação**: Verifique se os fornecedores foram criados/atualizados corretamente
3. **Manutenção**: Execute integrações incrementais regularmente

## Tratamento de Erros

### Erros Comuns
- **Timeout**: Conexão lenta com o ERP - tente novamente
- **Dados inválidos**: Verifique os dados no ERP
- **Conflito de CNPJ/CPF**: Fornecedor duplicado no sistema local

### Soluções
- **Reprocessar**: Tente processar novamente os itens com erro
- **Verificar logs**: Consulte o histórico para detalhes do erro
- **Suporte**: Contate o suporte técnico se o erro persistir

## Segurança

- Todos os dados são transmitidos de forma segura
- As credenciais do ERP são armazenadas de forma criptografada
- O histórico de integrações mantém registro de todas as operações
- Acesso restrito apenas a usuários autorizados

## Performance

- Integrações incrementais são mais rápidas que completas
- Use filtros para reduzir o volume de dados processados
- O sistema é otimizado para grandes volumes de dados
- Processamento em lotes para melhor performance

## Suporte

Em caso de dúvidas ou problemas:
1. Consulte o histórico de integrações
2. Verifique os logs de erro
3. Contate o suporte técnico
4. Forneça o ID da integração para agilizar o suporte