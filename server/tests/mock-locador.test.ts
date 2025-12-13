const express = require("express");
const request = require("supertest");
const { registerRoutes } = require("../routes");

describe("Mock Locador API", () => {
  let app;
  beforeAll(async () => {
    app = express();
    app.use(express.json());
    await registerRoutes(app);
  });
  it("config success mode and integrate receipt", async () => {
    await request(app).post("/mock/locador/config").send({ responseMode: "success" }).expect(200);
    const payload = {
      tipo_documento: "servico",
      identificacao: { id_recebimento_compras: "1", numero_documento: "123", serie_documento: "1" },
      total: { valor_total: 100 },
    };
    const resp = await request(app).post("/api/v1/recebimentos").send(payload).expect(200);
    expect(resp.body.status_integracao).toBe("integrada");
  });
  it("config error mode and get failure", async () => {
    await request(app).post("/mock/locador/config").send({ responseMode: "error", errorStatus: 422 }).expect(200);
    const payload = {
      tipo_documento: "servico",
      identificacao: { id_recebimento_compras: "1", numero_documento: "123", serie_documento: "1" },
      total: { valor_total: 100 },
    };
    const resp = await request(app).post("/api/v1/recebimentos").send(payload).expect(422);
    expect(resp.body.status_integracao).toBe("erro");
  });
});
