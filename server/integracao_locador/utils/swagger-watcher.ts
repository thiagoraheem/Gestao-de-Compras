import fs from 'fs';
import { getSwaggerPath, refreshEndpointsFromSwagger } from '../config/endpoints-registry';
import { setApiConfig } from '../config/api-config';

let initialized = false;

export function initSwaggerWatcher() {
  if (initialized) return;
  initialized = true;

  const swaggerPath = getSwaggerPath();
  try {
    refreshEndpointsFromSwagger(swaggerPath);
  } catch {}

  try {
    fs.watch(swaggerPath, { persistent: false }, () => {
      try {
        refreshEndpointsFromSwagger(swaggerPath);
        setApiConfig({ version: undefined });
      } catch {}
    });
  } catch {}
}

