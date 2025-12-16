Visão Geral

- Fluxo guiado por abas com duas entradas possíveis: importar XML ou inclusão manual.
- Tipos de NF: produto , servico , avulso determinam campos e validações dinâmicas.
- Rascunhos e progresso salvos automaticamente em localStorage para retomada.
Abas e Navegação

- XML
  - Faz upload e importa .xml , pré-preenche emitente, destinatário, itens e impostos.
  - Compara CNPJ do XML com fornecedor do pedido e mostra aderência.
  - Avança quando:
    - produto/servico : há XML importado ou há quantidades recebidas informadas.
    - avulso : campos mínimos preenchidos (número, série, emissão, entrada, total).
  - Referências: client/src/components/receipt-phase.tsx:410–447 , checagem e next client/src/components/receipt-phase-logic.ts:1–50 .
- Inclusão Manual de NF
  - Etapa 1 (Cadastro Inicial): número, série, emissão, entrada, CNPJ emitente, valor total; validação por tipo. client/src/components/receipt-phase.tsx:1279–1301
  - Etapa 2 (Itens):
    - Produto: código, descrição, NCM, qtd, unidade, valor unitário; edição de impostos por item (ICMS vBC/%/valor, IPI vBC/%/valor, PIS/COFINS CST). client/src/components/receipt-phase.tsx:1348–1389
    - Serviço: descrição, código de serviço, valor líquido, ISS. client/src/components/receipt-phase.tsx:1326–1344
  - Etapa 3 (Conferência Final): valida cabeçalho, itens e consistência de total vs soma dos itens; permite confirmar NF. client/src/components/receipt-phase.tsx:1394–1415
  - Botão “Gerar XML”: monta XML oficial NF-e/NFS-e a partir dos campos e coloca em xmlRaw . client/src/components/receipt-phase.tsx:1883–1990
- Informações Básicas
  - Mostra “Fornecedor Selecionado” e “Itens da Compra” apenas aqui.
  - Preenche forma de pagamento, vencimento e rateio (centro de custo e plano de contas).
  - Referências: client/src/components/receipt-phase.tsx:1113 , cards condicionais client/src/components/receipt-phase.tsx:2347–2356, 2454–2461 .
- Itens (Recebimento)
  - Informa quantidades recebidas, impede exceder o máximo previsto.
  - Exige qualquer quantidade informada OU XML importado antes de avançar. client/src/components/receipt-phase.tsx:2077–2091
- Financeiro
  - Define forma de pagamento e vencimento, valida soma do rateio = total da NF.
  - Avança para confirmação quando válido. client/src/components/receipt-phase.tsx:1515–1559
Validações Chave

- Cabeçalho da NF Manual: número, série, emissão, total e CNPJ emitente; produto exige chave de acesso (44 dígitos). client/src/utils/manual-nf-validation.ts:19–41
- Itens:
  - Produto: descrição, quantidade > 0, valor unitário ≥ 0. client/src/utils/manual-nf-validation.ts:43–60
  - Serviço: descrição, valor líquido > 0, ISS ≥ 0. client/src/utils/manual-nf-validation.ts:60–70
- Impostos por item (Produto):
  - ICMS: calcula vICMS quando pICMS ou vBC muda. client/src/components/receipt-phase.tsx:1356–1371
  - IPI: calcula vIPI ao ajustar pIPI / vBC . client/src/components/receipt-phase.tsx:1372–1389
- Consistência de total: compara Valor Total do cabeçalho com soma dos itens (produto: qtd*unit, serviço: netValue). client/src/utils/manual-nf-validation.ts:52–76 e uso na confirmação client/src/components/receipt-phase.tsx:1402–1415
- Rateio e dados do Locador: valida centros de custo e planos de contas exclusivamente contra fontes do Locador e formata mensagens de erro detalhadas. client/src/utils/locador-validation.ts:43–60
Persistência de Rascunho

- Auto-carrega rascunho ao abrir (emissor, destinatário, transporte, serviços, impostos, itens, cabeçalho). client/src/components/receipt-phase.tsx:210–229
- Auto-salva ao editar qualquer campo relevante. client/src/components/receipt-phase.tsx:281–289
- Botão “Salvar Rascunho” salva manualmente o bloco da NF. client/src/components/receipt-phase.tsx:1862–1871
Geração de XML

- NF-e: constrói nfeProc/NFe/infNFe com emit , dest , det/imposto , ICMSTot , transp , pag , infAdic . client/src/utils/xml-generation.ts:45–212
- NFS-e: constrói CompNfse/Nfse/InfNfse com Servico/Valores , PrestadorServico , TomadorServico . client/src/utils/xml-generation.ts:247–348
Confirmação

- “Confirmar Recebimento” no fluxo geral:
  - Valida financeiro (forma de pagamento, vencimento) e rateio soma = total.
  - Valida quantidades recebidas vs previstas ou existência de XML.
  - Executa mutação de confirmação com mensagens de erro formatadas quando falha. client/src/components/receipt-phase.tsx:2323–2339
- “Confirmar NF Manual” no fluxo manual:
  - Valida cabeçalho, itens e consistência de total, então confirma. client/src/components/receipt-phase.tsx:1399–1415
Fluxo Resumido

- Seleciona tipo da NF → XML (upload) OU Inclusão Manual (3 etapas) → Informações Básicas (pagamento e rateio) → Itens (quantidades) → Financeiro (validações) → Conferência Final (manual) → Confirmar → XML opcional para conferência → Conclusão.