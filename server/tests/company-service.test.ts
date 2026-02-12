import express from "express";
// @ts-ignore
import request from "supertest";
import { registerRoutes } from "../routes";
// @ts-ignore
import { describe, it, expect, beforeAll, jest } from '@jest/globals';
import { configService } from "../services/configService";
import { locadorHttpClient } from "../services/locadorHttpClient";

describe("Company Service Integration", () => {
  let app: express.Express;

  beforeAll(async () => {
    app = express();
    app.use(express.json());
    await registerRoutes(app);
  });

  it("should fetch companies from ERP proxy", async () => {
     const mockCompanies = [
         {
             idCompany: 1,
             companyName: "Empresa Teste",
             companyTrading: "Teste",
             cnpj: "12345678901234",
             address: "Rua Teste",
             phone: "12345678",
             email: "teste@teste.com"
         }
     ];

     jest.spyOn(configService, "getLocadorConfig").mockResolvedValue({
       enabled: true,
       baseUrl: "http://localhost:5225/api",
       endpoints: {
         combo: {
           fornecedor: "/Fornecedor",
           centroCusto: "/CostCenter",
           planoContas: "/ChartOfAccounts",
           empresa: "/Empresa",
           formaPagamento: "/FormaPagamento",
         },
         post: {
           enviarSolicitacao: "/Purchase/PurchaseRequest",
           recebimento: "/Purchase/PurchaseReceive",
         },
       },
       credentials: { login: "x", senha: "y" },
     } as any);

     jest.spyOn(locadorHttpClient, "get").mockResolvedValue(mockCompanies as any);

     const response = await request(app).get("/api/integracao-locador/empresas");
     
     expect(response.status).toBe(200);
     expect(response.body).toHaveLength(1);
     expect(response.body[0].companyName).toBe("Empresa Teste");
  });
});
