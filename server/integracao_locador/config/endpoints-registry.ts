import fs from 'fs';
import path from 'path';

type EndpointMap = {
  costCenter: string;
  chartOfAccounts: string;
  suppliers: string;
  products: string;
  paymentMethods: string;
  purchaseReceive: string;
  version: string;
};

let endpoints: EndpointMap = {
  costCenter: '/CostCenter',
  chartOfAccounts: '/ChartOfAccounts',
  suppliers: '/Fornecedor',
  products: '/Produtos',
  paymentMethods: '/FormaPagamento',
  purchaseReceive: '/Purchase/PurchaseReceive',
  version: 'v1',
};

function normalizePath(p: string): string {
  if (!p) return '';
  let path = p.startsWith('/') ? p : `/${p}`;
  path = path.replace(/^\/api\//i, '/');
  return path;
}

export function getEndpoints(): EndpointMap {
  return {
    costCenter: normalizePath(endpoints.costCenter),
    chartOfAccounts: normalizePath(endpoints.chartOfAccounts),
    suppliers: normalizePath(endpoints.suppliers),
    products: normalizePath(endpoints.products),
    paymentMethods: normalizePath(endpoints.paymentMethods),
    purchaseReceive: normalizePath(endpoints.purchaseReceive),
    version: endpoints.version,
  };
}

export function refreshEndpointsFromSwagger(swaggerPath: string) {
  try {
    const text = fs.readFileSync(swaggerPath, 'utf-8');
    const doc = JSON.parse(text);
    const paths = doc.paths ?? {};

    const findPath = (needle: string) => {
      const key = Object.keys(paths).find((p) => p.toLowerCase().includes(needle.toLowerCase()));
      return key ?? endpoints[needle as keyof EndpointMap] ?? '';
    };

    endpoints = {
      costCenter: normalizePath(findPath('costcenter') || endpoints.costCenter),
      chartOfAccounts: normalizePath(findPath('chartofaccounts') || endpoints.chartOfAccounts),
      suppliers: normalizePath(findPath('fornecedor') || endpoints.suppliers),
      products: normalizePath(findPath('produtos') || endpoints.products),
      paymentMethods: normalizePath(findPath('formapagamento') || endpoints.paymentMethods),
      purchaseReceive: normalizePath(findPath('purchasereceive') || endpoints.purchaseReceive),
      version: (doc.info?.version as string) || endpoints.version,
    };
  } catch (error) {
    // keep previous endpoints on failure
  }
}

export function getSwaggerPath(): string {
  return path.resolve(process.cwd(), 'attached_assets', 'swagger.json');
}
