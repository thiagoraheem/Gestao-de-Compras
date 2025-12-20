import express from "express";
// @ts-ignore
import request from "supertest";
import { registerRoutes } from "../routes";
// @ts-ignore
import { describe, it, expect, beforeAll, jest } from '@jest/globals';
import { companyService } from "../integracao_locador/services/company-service";

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

     jest.spyOn(companyService, 'list').mockResolvedValue(mockCompanies);

     const response = await request(app).get("/api/integracao-locador/empresas");
     
     expect(response.status).toBe(200);
     expect(response.body).toHaveLength(1);
     expect(response.body[0].companyName).toBe("Empresa Teste");
  });
});
