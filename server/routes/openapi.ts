import type { Express, Request, Response } from "express";

const openApiSpec = {
  openapi: "3.0.0",
  info: {
    title: "Locador API",
    version: "1.0.0",
    description: "API para integração de Recebimentos",
  },
  paths: {
    "/api/v1/centros-custo": {
      get: {
        summary: "Listar Centros de Custo",
        responses: {
          "200": {
            description: "Lista de Centros de Custo",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "string" },
                      codigo: { type: "string" },
                      nome: { type: "string" },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/v1/plano-contas": {
      get: {
        summary: "Listar Plano de Contas",
        responses: {
          "200": {
            description: "Lista de Plano de Contas",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "string" },
                      codigo: { type: "string" },
                      descricao: { type: "string" },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/v1/recebimentos": {
      post: {
        summary: "Enviar Recebimento",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  tipo_documento: { type: "string", enum: ["produto", "servico", "avulso"] },
                  identificacao: {
                    type: "object",
                    properties: {
                      id_recebimento_compras: { type: "string" },
                      numero_documento: { type: "string" },
                      serie_documento: { type: "string" },
                      chave_nfe: { type: "string" },
                      data_emissao: { type: "string", format: "date-time" },
                      data_entrada: { type: "string", format: "date-time" },
                    },
                  },
                  fornecedor: {
                    type: "object",
                    properties: {
                      cnpj: { type: "string" },
                      id_fornecedor_locador: { type: "string" },
                    },
                  },
                  total: {
                    type: "object",
                    properties: {
                      valor_total: { type: "number" },
                      valor_produtos: { type: "number" },
                      valor_descontos: { type: "number" },
                      valor_frete: { type: "number" },
                      valor_ipi: { type: "number" },
                    },
                  },
                  centro_custo: {
                    type: "object",
                    properties: {
                      codigo: { type: "string" },
                      id_locador: { type: "string" },
                    },
                  },
                  plano_contas: {
                    type: "object",
                    properties: {
                      codigo: { type: "string" },
                      id_locador: { type: "string" },
                    },
                  },
                  itens: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        numero_item: { type: "integer" },
                        descricao: { type: "string" },
                        quantidade: { type: "number" },
                        unidade: { type: "string" },
                        valor_unitario: { type: "number" },
                        valor_total: { type: "number" },
                        codigo_produto_locador: { type: "string" },
                        id_produto_locador: { type: "string" },
                        ncm: { type: "string" },
                        cfop: { type: "string" },
                      },
                    },
                  },
                  parcelas: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        numero: { type: "string" },
                        data_vencimento: { type: "string", format: "date" },
                        valor: { type: "number" },
                      },
                    },
                  },
                  xml_nfe: { type: "string" },
                },
                required: ["tipo_documento", "identificacao", "total"],
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Processado com sucesso",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status_integracao: { type: "string" },
                    id_recebimento_locador: { type: "string" },
                    mensagem: { type: "string" },
                  },
                },
              },
            },
          },
          "400": {
            description: "Erro de validação",
          },
        },
      },
    },
  },
};

export function registerOpenApiRoute(app: Express) {
  app.get("/api-docs/openapi.json", (_req: Request, res: Response) => {
    res.json(openApiSpec);
  });
}
