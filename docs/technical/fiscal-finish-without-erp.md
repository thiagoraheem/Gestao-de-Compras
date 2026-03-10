# Finalização de Conferência Fiscal Sem Envio ao ERP

## Visão Geral
Esta funcionalidade permite que usuários com o perfil de **Comprador** finalizem a conferência fiscal de um recebimento sem a necessidade de enviar os dados para o sistema ERP (Locador). Isso é útil em casos excepcionais onde a integração não é necessária ou desejada, mas o processo precisa ser concluído no sistema de Compras.

## Fluxo de Execução

1.  **Acesso**: O usuário acessa a tela de Conferência Fiscal de um Pedido de Compra.
2.  **Visualização**: Se o usuário tiver o perfil `isBuyer` (Comprador) e o recebimento ainda não estiver conferido, um botão adicional "Finalizar Sem Envio ERP" será exibido.
3.  **Confirmação**: Ao clicar no botão, um diálogo de confirmação é exibido, alertando sobre as implicações da ação.
4.  **Processamento**:
    *   O frontend envia uma requisição `POST /api/receipts/:id/finish-without-erp`.
    *   O backend valida se o usuário logado possui a permissão `isBuyer`.
    *   O backend verifica se o recebimento existe e se ainda não foi finalizado.
    *   O status do recebimento é atualizado para `fiscal_conferida`.
    *   Uma mensagem de integração é gravada como: "Finalização manual sem ERP realizada pelo comprador (Processo Excepcional)".
    *   O sistema verifica se todos os recebimentos do Pedido de Compra foram concluídos. Se sim, a Solicitação de Compra avança para a fase `conclusao_compra`.
5.  **Auditoria**: Uma entrada é criada na tabela `audit_logs` registrando a ação, o usuário responsável e a justificativa automática.

## Implicações

*   **Dados Financeiros**: A finalização manual **não valida** os campos financeiros obrigatórios (parcelas, rateio, etc.) da mesma forma que a conferência padrão. Os dados permanecem como estavam no momento da ação.
*   **Integração**: Nenhuma informação é enviada para o ERP. O status de integração não será `integrado_locador`.
*   **Segurança**: Apenas usuários com a flag `isBuyer` podem executar esta ação.

## Detalhes Técnicos

### Backend
*   **Rota**: `POST /api/receipts/:id/finish-without-erp`
*   **Controle de Acesso**: Middleware de sessão + verificação manual de `user.isBuyer`.
*   **Log**: `action_type: 'conferencia_fiscal_sem_erp'`.

### Frontend
*   **Componente**: `FiscalConferencePhase` (`client/src/components/fiscal-conference-phase.tsx`).
*   **Permissão**: Renderização condicional baseada em `user.isBuyer`.

## Testes
Os testes unitários cobrem:
1.  Tentativa de acesso por usuário não autenticado (401).
2.  Tentativa de acesso por usuário sem perfil de Comprador (403).
3.  Execução bem-sucedida por Comprador.
4.  Validação de recebimento inexistente ou já finalizado.
