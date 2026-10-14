import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

/**
 * Resolve o diretório do arquivo em execução de forma robusta.
 *
 * Estratégias (em ordem):
 *  1. import.meta.url  -> ESM puro (tsx em dev / bundle esbuild em produção).
 *  2. globalThis.__dirname -> CommonJS.
 *  3. process.cwd() -> último fallback.
 *
 * Em desenvolvimento este arquivo está em server/services/, portanto sobe um
 * nível para chegar em server/templates.
 * Em produção o bundle (index.js) fica na raiz do projeto e os templates são
 * copiados para <raiz>/templates (ou dist/templates, conforme o build).
 */
function resolveCurrentDir(): string {
  // 1) ESM - import.meta.url funciona em tsx (dev) e no bundle esbuild (prod)
  try {
    const metaUrl = (import.meta as any)?.url as string | undefined;
    if (typeof metaUrl === "string" && metaUrl) {
      return path.dirname(fileURLToPath(metaUrl));
    }
  } catch {
    // ignora e tenta os próximos fallbacks
  }

  // 2) CommonJS
  const g = globalThis as any;
  if (typeof g.__dirname === "string") {
    return g.__dirname;
  }

  // 3) Fallback final
  return process.cwd();
}

const resolvedDirname = resolveCurrentDir();

class TemplateService {
  private templates: Map<string, string> = new Map();

  /**
   * Renders a template with the given data.
   * Supports:
   * - {{variable}} : Escaped value
   * - {{{variable}}} : Raw (unescaped) value
   * - {{#if variable}}...{{/if}} : Conditional block
   */
  async render(templatePath: string, data: Record<string, any>): Promise<string> {
    let template = this.templates.get(templatePath);

    if (!template) {
      // In development, this file is in server/services/template-service.ts
      // templates are in server/templates
      // In production, everything is bundled into dist/index.js
      // we will copy templates to dist/templates
      const isProduction = process.env.NODE_ENV === "production";
      const templatesDir = isProduction
        ? path.join(resolvedDirname, "templates")
        : path.join(resolvedDirname, "..", "templates");

      const fullPath = path.join(templatesDir, `${templatePath}.html`);
      try {
        template = await fs.readFile(fullPath, "utf-8");
        this.templates.set(templatePath, template);
      } catch (error) {
        console.error(`Error reading template from ${fullPath}:`, error);
        throw new Error(`Template ${templatePath} not found at ${fullPath}`);
      }
    }

    let rendered = template;

    // Handle {{#if variable}}...{{/if}}
    rendered = rendered.replace(/\{\{#if (\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (match, variable, content) => {
      return data[variable] ? content : "";
    });

    // Handle {{{variable}}} - Unescaped
    rendered = rendered.replace(/\{\{\{([\w.]+)\}\}\}/g, (match, key) => {
      return data[key] || "";
    });

    // Handle {{variable}} - Escaped
    rendered = rendered.replace(/\{\{([\w.]+)\}\}/g, (match, key) => {
      const value = data[key];
      if (value === undefined || value === null) return "";
      
      return this.escapeHtml(String(value));
    });

    return rendered;
  }

  private escapeHtml(text: string): string {
    const map: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  }
}

export const templateService = new TemplateService();
