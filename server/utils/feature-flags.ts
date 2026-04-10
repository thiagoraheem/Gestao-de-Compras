export function isDecoupledReceiptsLifecycleEnabled(): boolean {
  return process.env.FEATURE_DECOUPLE_RECEIPTS_LIFECYCLE === "true";
}

