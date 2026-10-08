import { useMemo } from 'react';
import { SupplierQuotationData } from './types';
import { normalizeCurrencyCode, convertToBRL, roundCurrency } from "@/lib/currency";

interface UseRecommendedSupplierProps {
  suppliersData: SupplierQuotationData[];
  weights: {
    price: number;
    delivery: number;
    discount: number;
    freight: number;
    payment: number;
  };
}

const resolveBRL = (sq: SupplierQuotationData): number => {
  if (!sq?.totalValue) return 0;
  const totalOriginal = Number(sq.totalValue || 0);
  if (isNaN(totalOriginal)) return 0;
  const code = normalizeCurrencyCode(sq.currencyCode);
  if (code === 'BRL') return totalOriginal;
  if (sq.totalValueBrl != null && String(sq.totalValueBrl).trim() !== "") {
    const n = Number(sq.totalValueBrl);
    if (!isNaN(n)) return n;
  }
  const rate = sq.exchangeRate != null && String(sq.exchangeRate).trim() !== ""
    ? Number(sq.exchangeRate) : 0;
  return roundCurrency(convertToBRL(totalOriginal, rate || 0));
};

const resolveDiscountBRLFrac = (sq: SupplierQuotationData): number => {
  if (!sq.discountType || !sq.discountValue) return 0;
  const val = Number(sq.discountValue);
  if (sq.discountType === 'percentage') return Math.min(Math.max(val / 100, 0), 1);
  const totalBrl = resolveBRL(sq) || 1;
  const discountBrl = (() => {
    if (normalizeCurrencyCode(sq.currencyCode) === 'BRL') return val;
    const code = normalizeCurrencyCode(sq.currencyCode);
    const rate = sq.exchangeRate != null && String(sq.exchangeRate).trim() !== ""
      ? Number(sq.exchangeRate) : 0;
    return roundCurrency(convertToBRL(val, rate || 0));
  })();
  return Math.min(Math.max(discountBrl / totalBrl, 0), 1);
};

export function useRecommendedSupplier({ suppliersData, weights }: UseRecommendedSupplierProps) {
  const receivedQuotations = useMemo(() => suppliersData.filter(sq => sq.status === 'received'), [suppliersData]);
  const noResponseQuotations = useMemo(() => suppliersData.filter(sq => sq.status === 'no_response'), [suppliersData]);

  const recommendedSupplier = useMemo(() => {
    if (receivedQuotations.length === 0) return null;
    const values = receivedQuotations.map(sq => resolveBRL(sq));
    const days = receivedQuotations.map(sq => Number(sq.deliveryDays || 0));
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const minDays = Math.min(...days);
    const maxDays = Math.max(...days);
    
    const effectiveDiscountFractions = receivedQuotations.map(sq => resolveDiscountBRLFrac(sq));
    
    const maxDiscountFrac = Math.max(...effectiveDiscountFractions, 0);
    const paymentDaysArray = receivedQuotations.map(sq => {
      const match = String(sq.paymentTerms || '').match(/\d+/);
      return match ? Number(match[0]) : 0;
    });
    
    const maxPaymentDays = Math.max(...paymentDaysArray, 0);
    
    const normalize = (val: number, min: number, max: number) => {
      if (!isFinite(val) || !isFinite(min) || !isFinite(max) || max === min) return 0.5;
      return (val - min) / (max - min);
    };
    
    const normalizedWeights = (() => {
      const sum = weights.price + weights.delivery + weights.discount + weights.freight + weights.payment;
      const safeSum = sum > 0 ? sum : 1;
      return {
        price: weights.price / safeSum,
        delivery: weights.delivery / safeSum,
        discount: weights.discount / safeSum,
        freight: weights.freight / safeSum,
        payment: weights.payment / safeSum,
      };
    })();
    
    const scoreFor = (sq: SupplierQuotationData) => {
      const priceNorm = normalize(resolveBRL(sq), minValue, maxValue);
      const deliveryNorm = normalize(Number(sq.deliveryDays || 0), minDays, maxDays);
      const discountFrac = (() => {
        const frac = resolveDiscountBRLFrac(sq);
        if (maxDiscountFrac <= 0) return 0.5;
        return frac / maxDiscountFrac;
      })();
      const freightNorm = sq.includesFreight ? 1 : 0;
      const paymentDays = (() => {
        const match = String(sq.paymentTerms || '').match(/\d+/);
        return match ? Number(match[0]) : 0;
      })();
      const paymentNorm = maxPaymentDays > 0 ? paymentDays / maxPaymentDays : 0.5;
      const total = (1 - priceNorm) * normalizedWeights.price
        + (1 - deliveryNorm) * normalizedWeights.delivery
        + discountFrac * normalizedWeights.discount
        + freightNorm * normalizedWeights.freight
        + paymentNorm * normalizedWeights.payment;
      return total;
    };
    
    const scored = receivedQuotations.map(sq => ({ sq, score: scoreFor(sq) }));
    scored.sort((a, b) => b.score - a.score);
    return scored[0].sq;
  }, [receivedQuotations, weights]);

  return {
    receivedQuotations,
    noResponseQuotations,
    recommendedSupplier
  };
}
