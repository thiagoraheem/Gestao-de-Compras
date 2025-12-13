const express = require("express");
const request = require("supertest");
const { registerRoutes } = require("../routes");

describe("Receipts persistence and validation", () => {
  let app;
  beforeAll(async () => {
    app = express();
    app.use(express.json());
    await registerRoutes(app);
  });
  it("rejects servico without cost center and chart of accounts", async () => {
    const payload = {
      receiptType: "servico",
      status: "rascunho",
      receivedBy: null,
      receivedAt: null,
    };
    const resp = await request(app).post("/api/recebimentos").send(payload).expect(400);
    expect(resp.body.message).toMatch(/Centro de Custo/);
  });
  it("creates servico with cost center and chart of accounts", async () => {
    const payload = {
      receiptType: "servico",
      status: "rascunho",
      costCenterId: 1,
      chartOfAccountsId: 1,
      receivedBy: null,
      receivedAt: null,
    };
    const resp = await request(app).post("/api/recebimentos").send(payload).expect(201);
    expect(resp.body.id).toBeTruthy();
  });
});
