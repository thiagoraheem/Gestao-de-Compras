# Registro de Alterações do Manual do Usuário

## Versão: Atualização de alinhamento com sistema
- Data: 2025-11-18
- Responsável: Equipe de Gestão de Compras

## Alterações Realizadas

- Atualização da seção “Níveis de Aprovação por Valor” para fluxo configurável e dupla aprovação Diretor → CEO
- Ajuste da seção “Signatários Autorizados” para refletir papéis reais no sistema
- Inclusão das “Regras de dupla aprovação” na fase A2
- Padronização de terminologia de pagamento para “Cartão de Crédito”
- Inclusão da seção “Configuração de Aprovação por Valor” (página administrativa)
- Inclusão da seção “Visualização Pública da Solicitação” (QR Code/URL)
- Inclusão da seção “Relatórios” (Solicitações e Fornecedores)

## Justificativas

- O sistema implementa dupla aprovação baseada em valor com papéis de **Diretor** e **CEO**
- O limite de valor é **configurável** e não fixo; o manual deve instruir sobre essa gestão
- Novas funcionalidades (visualização pública e relatórios) precisam de orientação operacional
- Terminologia deve estar alinhada aos métodos disponíveis no sistema

## Evidências Técnicas

- Fluxo de dupla aprovação: `server/routes/approval-rules.ts:176-205`
- Configuração de limite: `shared/schema.ts:1038-1047`, `server/storage.ts:2213-2245`, `client/src/pages/approval-config.tsx:126-224`
- Notificações A2: `server/email-service.ts:329-336`
- Visualização pública: `client/src/pages/public-request-view.tsx:65-87`
- Relatório de solicitações: `client/src/pages/purchase-requests-report.tsx:349-370`

## Aprovação

- Revisão técnica: concluída
- Revisão de usabilidade: concluída
- Aprovação formal: pendente de validação do responsável pela política de compras