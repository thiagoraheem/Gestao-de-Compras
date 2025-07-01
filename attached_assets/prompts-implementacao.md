# 📝 Prompts para Implementação - Sistema de Gestão de Compras

Este documento contém prompts estruturados para implementação das funcionalidades pendentes do sistema de Gestão de Compras. Cada seção pode ser usada independentemente para orientar o desenvolvimento de funcionalidades específicas.

---

## 🏗️ 1. Implementação das Fases do Kanban

### 1.1 Fase de Solicitação
```prompt
Crie um componente React para a fase de Solicitação que inclua:
- Formulário com campos obrigatórios: Centro de Custo, Categoria, Upload de Planilha, Urgência, Justificativa
- Validação de campos obrigatórios
- Upload de arquivos com preview
- Botão de submissão que cria um novo card no Kanban
- Integração com a API existente para salvar os dados
- Feedback visual durante o carregamento e após submissão

Use os componentes existentes da biblioteca de UI e mantenha o padrão visual do sistema.
```

### 1.2 Fase de Aprovação A1
```prompt
Desenvolva o componente de Aprovação A1 com:
- Exibição detalhada da solicitação
- Botões de Aprovar/Reprovar
- Campo de justificativa obrigatório para reprovação
- Validação de permissões (aprovadores A1)
- Atualização automática do status no Kanban
- Notificação por e-mail para o solicitante
- Histórico de aprovações

Integre com o sistema de autenticação existente para verificar permissões.
```

### 1.3 Fase de Cotação (RFQ)
```prompt
Implemente a funcionalidade de Cotação com:
- Interface para adicionar múltiplos fornecedores
- Upload de documentos de cotação
- Campos para preenchimento de valores e condições
- Comparação lado a lado de cotações
- Validação de campos obrigatórios
- Botão para envio para aprovação A2
- Histórico de alterações

Garanta que apenas usuários com perfil de comprador possam acessar esta fase.
```

---

## 🤖 2. Automações e Integrações

### 2.1 Webhooks para Eventos
```prompt
Crie um sistema de webhooks que dispare eventos para URLs configuráveis quando:
- Um card muda de fase
- Uma aprovação é necessária
- Um prazo está próximo de vencer
- Ocorre uma exceção ou erro

Implemente:
- Interface para gerenciar webhooks
- Sistema de retentativa para falhas
- Logs de eventos disparados
- Autenticação nas chamadas
- Documentação dos payloads
```

### 2.2 Integração com Agentes de IA
```prompt
Desenvolva endpoints para integração com agentes de IA:
- POST /api/ai/process-document: Para processar documentos de cotação
- POST /api/ai/suggest-suppliers: Para sugerir fornecedores com base no histórico
- POST /api/ai/validate-request: Para validar solicitações de compra
- GET /api/ai/analytics: Para obter insights sobre padrões de compra

Cada endpoint deve:
- Validar autenticação
- Processar dados de entrada
- Retornar respostas padronizadas
- Registrar métricas de uso
```

---

## 📊 3. Relatórios e Dashboards

### 3.1 Dashboard Principal
```prompt
Crie um dashboard administrativo com:
- Gráfico de solicitações por status
- Média de tempo por fase
- Gastos por departamento
- Fornecedores mais utilizados
- Alertas de itens atrasados
- Filtros por período e departamento
- Exportação para Excel/PDF

Use a biblioteca de gráficos já existente no projeto e mantenha o padrão visual.
```

### 3.2 Relatório de Desempenho
```prompt
Desenvolva um relatório de desempenho que mostre:
- Tempo médio de processamento por fase
- Taxa de aprovação/rejeição
- Economia gerada por comprador
- Comparativo entre fornecedores
- Análise de tendências
- Alertas de anomalias

Inclua filtros avançados e opções de exportação.
```

---

## 🛠️ 4. Melhorias Técnicas

### 4.1 Testes Automatizados
```prompt
Implemente testes automatizados para:
- Componentes React principais
- Lógica de negócios
- Endpoints da API
- Fluxos de usuário críticos

Use a stack de testes já configurada (Jest/Testing Library) e garanta cobertura mínima de 80%.
```

### 4.2 Documentação da API
```prompt
Gere documentação da API usando OpenAPI/Swagger que inclua:
- Todos os endpoints disponíveis
- Modelos de requisição/resposta
- Códigos de status HTTP
- Exemplos de uso
- Autenticação necessária
- Limites de taxa

Integre com o Swagger UI para visualização interativa.
```

### 4.3 Sistema de Logs
```prompt
Implemente um sistema de logs centralizado que:
- Registre todas as ações importantes
- Inclua contexto relevante (usuário, horário, IP)
- Permita busca e filtragem
- Retenha logs por 90 dias
- Alerte sobre erros críticos
- Gere relatórios de auditoria

Use o Winston ou outra biblioteca compatível com a stack atual.
```

---
## 📋 5. Checklist de Implantação

### 5.1 Pré-Implantação
```prompt
Antes de implantar as novas funcionalidades, verifique:
- [ ] Todos os testes estão passando
- [ ] Documentação atualizada
- [ ] Backup do banco de dados
- [ ] Plano de rollback definido
- [ ] Equipe treinada nas novas funcionalidades
- [ ] Horário de baixo impacto agendado
```

### 5.2 Pós-Implantação
```prompt
Após a implantação, realizar:
- [ ] Monitoramento ativo
- [ ] Validação das funcionalidades
- [ ] Verificação de desempenho
- [ ] Coleta de feedback dos usuários
- [ ] Ajustes necessários
- [ ] Atualização da documentação operacional
```

---
## 🔄 Processo de Desenvolvimento

### 6.1 Fluxo de Trabalho
```prompt
Siga este fluxo para implementar cada funcionalidade:
1. Criar branch a partir da main
2. Implementar testes unitários
3. Desenvolver a funcionalidade
4. Testar localmente
5. Abrir PR para revisão
6. Corrigir feedbacks
7. Aprovação de pelo menos um revisor
8. Merge na main
9. Implantação em ambiente de teste
10. Validação em homologação
11. Implantação em produção
```

### 6.2 Convenções de Código
```prompt
Ao implementar, seguir:
- Nomes descritivos em inglês
- Componentes funcionais com TypeScript
- Estilização com Tailwind CSS
- Padrão de commits convencionais
- Documentação JSDoc para funções complexas
- Separação clara de responsabilidades
- Reutilização de componentes existentes
```

---
## 📞 Suporte

### 7.1 Solução de Problemas
```prompt
Para resolver problemas comuns:
1. Verificar logs do servidor
2. Reproduzir o problema em ambiente local
3. Verificar permissões do usuário
4. Validar dados de entrada
5. Consultar documentação da API
6. Se necessário, abrir issue detalhada
```

### 7.2 Melhorias Futuras
```prompt
Roadmap sugerido:
- [ ] Integração com sistema contábil
- [ ] Assinatura digital de documentos
- [ ] Aplicativo móvel
- [ ] Chat em tempo real
- [ ] Análise preditiva de gastos
- [ ] Automação de processos com RPA
```

---
Este documento deve ser atualizado conforme novas necessidades forem identificadas durante o desenvolvimento.
