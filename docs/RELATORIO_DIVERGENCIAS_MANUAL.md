# Relatório de Divergências do Manual do Usuário

## Escopo
- Documento analisado: `docs/MANUAL_USUARIO.md`
- Base de comparação: implementação atual do sistema (frontend e backend)
- Objetivo: identificar divergências e alinhar o manual com o comportamento real do sistema

## Sumário de Divergências

- Aprovação por valor: fluxo real é Diretor + CEO acima do limite; manual indica CFO + CEO
- Limite de valor: configurável no sistema; manual descreve valor fixo em R$ 2.500,00
- Notificações A2: enviadas a aprovadores A2; manual cita especificamente CFO/CEO por nível
- Visualização pública: funcionalidade existente não documentada
- Relatórios: páginas dedicadas não documentadas no manual
- Terminologia de pagamento: sistema usa "Cartão de Crédito"; manual cita "Cartão corporativo"

## Detalhamento por item

1. Aprovação por valor (A2)
- Manual: Nível 1 até R$ 2.500 com aprovação do CFO; Nível 2 acima de R$ 2.500 com aprovação CFO + CEO
- Sistema: aprovação simples para valores ≤ limite por qualquer aprovador A2; para valores > limite, exige dupla aprovação: primeiro por Diretor, depois por CEO
- Evidências:
  - `server/routes/approval-rules.ts:176-205`
  - `shared/schema.ts:59-61` (campos `isCEO`, `isDirector`)
  - `server/storage.ts:2288-2295` (consulta de CEO e Diretores)
- Impacto: procedimentos e papéis descritos precisam ser alinhados para evitar confusão operacional
- Correção aplicada: manual atualizado para “Diretor + CEO” e descrição do fluxo de dupla aprovação

2. Limite de valor configurável
- Manual: valor fixo R$ 2.500,00
- Sistema: limite configurável via página “Configuração de Aprovação”; padrão inicial 2.500,00
- Evidências:
  - `shared/schema.ts:1038-1047` (tabela `approval_configurations`)
  - `server/storage.ts:2213-2245` (obtenção da configuração ativa)
  - `server/storage.ts:2444-2450` (valor padrão inicial 2500.00)
  - `client/src/pages/approval-config.tsx:126-224` (UI de configuração e regra)
- Impacto: manual deve instruir sobre configuração e destacar que o limite é dinâmico
- Correção aplicada: seção adicionada no manual explicando a configuração de aprovação por valor

3. Notificações A2
- Manual: CFO/CEO notificados conforme nível de valor
- Sistema: notifica todos os usuários com `isApproverA2` sem diferenciação por CFO
- Evidências:
  - `server/email-service.ts:329-336` (seleção de aprovadores A2)
- Impacto: expectativa de quem recebe notificações deve ser ajustada
- Correção aplicada: manual atualizado para “aprovadores A2” e regras específicas no fluxo de dupla aprovação

4. Restrição A1 por centro de custo
- Manual: Aprovadores A1 restritos aos seus centros de custo
- Sistema: validação presente no backend e nas transições de fase
- Evidências:
  - `server/routes.ts:3187-3195`
  - `server/email-service.ts:259-271` (filtragem por centro de custo ao notificar A1)
- Situação: manual já descreve corretamente; mantido

5. Visualização pública da solicitação
- Manual: não documenta
- Sistema: página pública para visualização por QR Code, itens e histórico
- Evidências:
  - `client/src/pages/public-request-view.tsx:65-87` (rota e carregamento)
  - `client/src/pages/public-request-view.tsx:139-186` (conteúdo exibido)
- Impacto: adicionar instruções de acesso e uso
- Correção aplicada: seção adicionada ao manual

6. Relatórios dedicados
- Manual: menciona dashboard; não detalha páginas de relatório
- Sistema: páginas “Relatório de Solicitações de Compra” e “Relatório de Fornecedores”
- Evidências:
  - `client/src/pages/purchase-requests-report.tsx:349-370` (header e ações)
  - `client/src/pages/purchase-requests-report.tsx:372-566` (filtros)
- Impacto: orientar usuários sobre filtros e exportação CSV
- Correção aplicada: seção adicionada ao manual com instruções

7. Terminologia de pagamento
- Manual: “Cartão corporativo”
- Sistema: “Cartão de Crédito” em métodos padrão
- Evidências:
  - `server/storage.ts:2376-2383` (métodos padrão, inclui “Cartão de Crédito”)
- Impacto: alinhar terminologia para evitar dúvidas
- Correção aplicada: manual padronizado para “Cartão de Crédito”

## Observações adicionais
- Tipos de arquivos e limite de upload: manual já está alinhado com o backend (10MB e formatos aceitos)
  - `server/routes/upload-config.ts:21-42`
- Dupla aprovação: final obrigatoriamente por CEO quando a primeira aprovação não for do CEO
  - `server/routes/approval-rules.ts:176-185`

## Conclusão
- As correções foram aplicadas no manual e novas seções foram incluídas para cobrir funcionalidades não documentadas. A terminologia foi padronizada conforme o sistema.
- Próximo passo: validação técnica e de usabilidade concluída; aguarda aprovação formal do responsável.