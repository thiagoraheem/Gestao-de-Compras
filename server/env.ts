import dotenv from "dotenv";
import path from "path";

// Carrega variáveis baseado no NODE_ENV e APP_MODE
// Se production, carrega .env.production
// Se APP_MODE for 'development' (injetado via build:dev), carrega .env.development
// Caso contrário (dev local), carrega .env
const isProduction = process.env.NODE_ENV === 'production';
const appMode = process.env.APP_MODE;

let envFile = '.env';
if (isProduction) {
  envFile = '.env.production';
} else if (appMode === 'development') {
  envFile = '.env.development';
}

const envPath = path.resolve(process.cwd(), envFile);

// console.log(`[server] Carregando ambiente de: ${envFile}`);

dotenv.config({ path: envPath, override: true });
