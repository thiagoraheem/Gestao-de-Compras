import express from "express";
// @ts-ignore
import request from "supertest";
import { registerReceiptsRoutes } from "../routes/receipts";
import { db } from "../db";

// @ts-ignore
import { describe, it, expect, beforeAll } from '@jest/globals';

jest.mock("../db", () => ({
  db: {
    insert: jest.fn(),
    execute: jest.fn(),
  },
}));

jest.mock("drizzle-orm", () => ({
  ...jest.requireActual("drizzle-orm"),
  eq: jest.fn(),
  sql: (strings: any, ...values: any[]) => ({ strings, values }),
}));

describe("Receipts persistence and validation", () => {
  let app: express.Express;
  beforeAll(async () => {
    app = express();
    app.use(express.json());
    registerReceiptsRoutes(app as any);
  });
  it("rejects servico without cost center and chart of accounts", async () => {
    const payload = {
      receiptType: "servico",
      status: "rascunho",
    };
    const resp = await request(app).post("/api/recebimentos").send(payload).expect(400);
    expect(resp.body.message).toMatch(/Centro de Custo/);
  });
  it("creates servico with cost center and chart of accounts", async () => {
    const insertBuilder = {
      values: jest.fn().mockReturnThis(),
      returning: jest.fn().mockResolvedValueOnce([{ id: 1 }]),
    };
    (db.insert as any as jest.Mock).mockReturnValueOnce(insertBuilder);
    (db.execute as any as jest.Mock).mockResolvedValueOnce(true);

    const payload = {
      receiptType: "servico",
      status: "rascunho",
      costCenterId: 1,
      chartOfAccountsId: 1,
    };
    const resp = await request(app).post("/api/recebimentos").send(payload).expect(201);
    expect(resp.body.id).toBeTruthy();
  });
});
