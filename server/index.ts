import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { createCacheMiddleware } from "./cache";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Cache middleware for API routes
app.use('/api', createCacheMiddleware());

// Environment-based log configuration
const LOG_CONFIG = {
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'error' : 'info'),
  enableRequestLogs: process.env.ENABLE_REQUEST_LOGS !== 'false',
  verboseMode: process.env.LOG_VERBOSE === 'true'
};

// Log filtering configuration
const LOG_FILTERS = {
  // Skip logging for these paths when they return 304 (Not Modified)
  skipOn304: [
    '/api/auth/check',
    '/api/purchase-requests',
    '/api/quotations/purchase-request/',
    '/api/quotations/',
    '/api/purchase-requests/',
    '/api/supplier-quotations/'
  ],
  // Skip logging for frequent polling endpoints
  skipFrequentPolling: [
    '/api/auth/check'
  ],
  // Only log errors for these paths
  errorsOnly: [
    '/api/purchase-requests/attachments',
    '/api/quotations/supplier-quotations'
  ]
};

// Custom logging middleware
app.use((req, res, next) => {
  // Skip request logging if disabled
  if (!LOG_CONFIG.enableRequestLogs) {
    return next();
  }
  
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    
    if (path.startsWith("/api")) {
      // In production, only log errors unless verbose mode is enabled
      if (LOG_CONFIG.level === 'error' && res.statusCode < 400 && !LOG_CONFIG.verboseMode) {
        return;
      }
      
      // Skip logging based on filters
      const shouldSkip = (
        // Skip 304 responses for specified paths
        (res.statusCode === 304 && LOG_FILTERS.skipOn304.some(skipPath => path.includes(skipPath))) ||
        // Skip frequent polling endpoints with 200/304 responses
        (LOG_FILTERS.skipFrequentPolling.some(skipPath => path.includes(skipPath)) && [200, 304].includes(res.statusCode)) ||
        // Skip successful responses for errors-only paths
        (LOG_FILTERS.errorsOnly.some(errorPath => path.includes(errorPath)) && res.statusCode < 400)
      );

      if (shouldSkip) {
        return;
      }

      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      
      // Only include response body for errors or important operations (and if verbose mode is enabled)
      if (capturedJsonResponse && (res.statusCode >= 400 || duration > 1000) && LOG_CONFIG.verboseMode) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 120) {
        logLine = logLine.slice(0, 119) + "…";
      }

      // Use appropriate log level
      if (res.statusCode >= 500) {
        console.error(logLine);
      } else if (res.statusCode >= 400) {
        console.warn(logLine);
      } else {
        log(logLine);
      }
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Use PORT from environment variables, fallback to 5000 if not set
  // this serves both the API and the client.
  const port = process.env.PORT 
    ? parseInt(process.env.PORT, 10) 
    : 5000;
  server.listen({
    port,
    host: "0.0.0.0",
  }, () => {
    log(`serving on port ${port}`);
  });
})();
