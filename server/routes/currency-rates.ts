import type { Express, Request, Response } from "express";
import { currencyRateRepository } from "../repositories/currency-rate-repository";
import { insertCurrencyRateSchema } from "../../shared/schema";
import { z } from "zod";
import { isAuthenticated } from "./middleware";
import { auditService } from "../services/audit-service";
import { NotFoundError, ValidationError } from "../utils/errors";

const createCurrencyRateSchema = insertCurrencyRateSchema.refine(
  (data) => {
    const value = parseFloat(String(data.rateValue));
    return !isNaN(value) && value > 0;
  },
  {
    message: "rateValue deve ser maior que zero",
    path: ["rateValue"],
  }
);

const updateCurrencyRateSchema = insertCurrencyRateSchema
  .partial()
  .refine(
    (data) => {
      if (data.rateValue === undefined || data.rateValue === null) return true;
      const value = parseFloat(String(data.rateValue));
      return !isNaN(value) && value > 0;
    },
    {
      message: "rateValue deve ser maior que zero",
      path: ["rateValue"],
    }
  );

export function registerCurrencyRateRoutes(app: Express) {
  app.get(
    "/api/currency-rates",
    isAuthenticated,
    async (req: Request, res: Response) => {
      const filters = {
        currencyCode: req.query.currencyCode as string | undefined,
        fromDate: req.query.fromDate as string | undefined,
        toDate: req.query.toDate as string | undefined,
      };

      const rates = await currencyRateRepository.listRates(filters);
      res.json(rates);
    }
  );

  app.get(
    "/api/currency-rates/latest",
    isAuthenticated,
    async (req: Request, res: Response) => {
      const code = req.query.code as string | undefined;
      if (!code) {
        throw new ValidationError("Parâmetro 'code' é obrigatório");
      }

      const rate = await currencyRateRepository.getLatestRate(code);
      if (!rate) {
        throw new NotFoundError(
          `Nenhuma cotação encontrada para a moeda ${code}`
        );
      }

      res.json(rate);
    }
  );

  app.get(
    "/api/currency-rates/today",
    isAuthenticated,
    async (req: Request, res: Response) => {
      const code = req.query.code as string | undefined;
      if (!code) {
        throw new ValidationError("Parâmetro 'code' é obrigatório");
      }

      const rate = await currencyRateRepository.getTodayRate(code);
      if (!rate) {
        res.json(null);
        return;
      }

      res.json(rate);
    }
  );

  app.get(
    "/api/currency-rates/:id",
    isAuthenticated,
    async (req: Request, res: Response) => {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        throw new ValidationError("ID inválido");
      }

      const rate = await currencyRateRepository.getById(id);
      if (!rate) {
        throw new NotFoundError("Cotação de moeda não encontrada");
      }

      res.json(rate);
    }
  );

  app.post(
    "/api/currency-rates",
    isAuthenticated,
    async (req: Request, res: Response) => {
      const parsed = createCurrencyRateSchema.parse(req.body);

      const rate = await currencyRateRepository.createRate({
        ...parsed,
        createdBy: req.session.userId!,
      });

      await auditService.log({
        actionType: "CURRENCY_RATE_CREATE",
        actionDescription: `Cotação de moeda criada: ${rate.currencyCode} em ${rate.rateDate} = ${rate.rateValue}`,
        performedBy: req.session.userId,
        afterData: rate,
        affectedTables: ["currency_rates"],
        actionScope: "FLOW",
      } as any);

      res.status(201).json(rate);
    }
  );

  app.put(
    "/api/currency-rates/:id",
    isAuthenticated,
    async (req: Request, res: Response) => {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        throw new ValidationError("ID inválido");
      }

      const beforeData = await currencyRateRepository.getById(id);
      if (!beforeData) {
        throw new NotFoundError("Cotação de moeda não encontrada");
      }

      const parsed = updateCurrencyRateSchema.parse(req.body);

      const rate = await currencyRateRepository.updateRate(id, {
        ...parsed,
      });

      await auditService.log({
        actionType: "CURRENCY_RATE_UPDATE",
        actionDescription: `Cotação de moeda atualizada: ${rate.currencyCode} em ${rate.rateDate} = ${rate.rateValue}`,
        performedBy: req.session.userId,
        beforeData,
        afterData: rate,
        affectedTables: ["currency_rates"],
        actionScope: "FLOW",
      } as any);

      res.json(rate);
    }
  );

  app.delete(
    "/api/currency-rates/:id",
    isAuthenticated,
    async (req: Request, res: Response) => {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        throw new ValidationError("ID inválido");
      }

      const beforeData = await currencyRateRepository.getById(id);
      if (!beforeData) {
        throw new NotFoundError("Cotação de moeda não encontrada");
      }

      await currencyRateRepository.deleteRate(id);

      await auditService.log({
        actionType: "CURRENCY_RATE_DELETE",
        actionDescription: `Cotação de moeda excluída: ${beforeData.currencyCode} em ${beforeData.rateDate}`,
        performedBy: req.session.userId,
        beforeData,
        affectedTables: ["currency_rates"],
        actionScope: "FLOW",
      } as any);

      res.json({ message: "Cotação de moeda excluída com sucesso" });
    }
  );
}
