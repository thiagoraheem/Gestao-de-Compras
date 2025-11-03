export const REALTIME_CHANNELS = {
  PURCHASE_REQUESTS: "purchase-requests",
} as const;

export const PURCHASE_REQUEST_EVENTS = {
  CREATED: "purchase-request:created",
  UPDATED: "purchase-request:updated",
  PHASE_CHANGED: "purchase-request:phase-changed",
} as const;

export type PurchaseRequestEvent =
  (typeof PURCHASE_REQUEST_EVENTS)[keyof typeof PURCHASE_REQUEST_EVENTS];
