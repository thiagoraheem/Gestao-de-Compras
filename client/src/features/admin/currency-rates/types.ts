import type { CurrencyCode } from "../../../../../shared/utils/currency-utils";

export interface CurrencyRate {
  id: number;
  currencyCode: CurrencyCode;
  rateDate: string;
  rateValue: number;
  observations?: string | null;
  createdBy: number;
  createdAt: string;
  updatedAt: string;
  createdByUser?: {
    id: number;
    username: string;
    firstName?: string;
    lastName?: string;
  } | null;
}

export interface CurrencyRateFilters {
  currencyCode?: CurrencyCode;
  fromDate?: string;
  toDate?: string;
}

export interface CreateCurrencyRatePayload {
  currencyCode: CurrencyCode;
  rateDate: string;
  rateValue: number;
  observations?: string;
}

export type UpdateCurrencyRatePayload = Partial<CreateCurrencyRatePayload>;
