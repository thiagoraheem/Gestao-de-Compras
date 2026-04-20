import { useMemo } from 'react';
import { SupplierQuotationData } from './types';

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

export function useRecommendedSupplier({ suppliersData, weights }: UseRecommendedSupplierProps) {
  const receivedQuotations = useMemo(() => suppliersData.filter(sq => sq.status === 'received'), [suppliersData]);
  const noResponseQuotations = useMemo(() => suppliersData.filter(sq => sq.status === 'no_response'), [suppliersData]);

  const recommendedSupplier = useMemo(() => {
    if (receivedQuotations.length === 0) return null;
    const values = receivedQuotations.map(sq => Number(sq.totalValue || 0));
    const days = receivedQuotations.map(sq => Number(sq.deliveryDays || 0));
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const minDays = Math.min(...days);
    const maxDays = Math.max(...days);
    
    const effectiveDiscountFractions = receivedQuotations.map(sq => {
      if (!sq.discountType || !sq.discountValue) return 0;
      const val = Number(sq.discountValue);
      if (sq.discountType === 'percentage') return Math.min(Math.max(val / 100, 0), 1);
      const total = Number(sq.totalValue || 0) || 1;
      return Math.min(Math.max(val / total, 0), 1);
    });
    
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
      const priceNorm = normalize(Number(sq.totalValue || 0), minValue, maxValue);
      const deliveryNorm = normalize(Number(sq.deliveryDays || 0), minDays, maxDays);
      const discountFrac = (() => {
        if (!sq.discountType || !sq.discountValue) return 0;
        const val = Number(sq.discountValue);
        const frac = sq.discountType === 'percentage' 
          ? Math.min(Math.max(val / 100, 0), 1) 
          : Math.min(Math.max(val / (Number(sq.totalValue || 0) || 1), 0), 1);
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
