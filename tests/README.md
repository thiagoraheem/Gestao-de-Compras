# Testes do Sistema de Gestão de Compras

Esta pasta contém os testes automatizados do sistema.

## Arquivos Disponíveis

### `test-complete-flow.js`
Teste completo do fluxo de compras que executa:
1. Login no sistema
2. Criação de solicitação de compra
3. Adição de itens à solicitação
4. Envio para aprovação A1
5. Aprovação A1
6. Criação de RFQ (Request for Quotation)
7. Adição de itens à RFQ
8. Criação de cotações dos fornecedores
9. Seleção do fornecedor vencedor
10. Atualização da cotação para aprovação A2
11. Aprovação A2
12. Verificação da criação automática do pedido de compra

**Como executar:**
```bash
node tests/test-complete-flow.js
```

### `check-users.js`
Script para verificar os usuários cadastrados no sistema e seus IDs.

**Como executar:**
```bash
node tests/check-users.js
```

## Pré-requisitos

- Sistema deve estar rodando (frontend e backend)
- Banco de dados deve estar inicializado com dados padrão
- Usuário admin deve existir (username: admin, password: admin123)

## Observações

- Os testes utilizam dados fictícios para validar o fluxo completo
- Logs foram otimizados para mostrar apenas informações essenciais
- Em caso de erro, verifique se o sistema está rodando corretamente