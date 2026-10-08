import fs from "fs/promises";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

const g = globalThis as any;
const globalsFilename: string | undefined =
  typeof g.__filename === "string" ? g.__filename : undefined;
const globalsDirname: string | undefined =
  typeof g.__dirname === "string" ? g.__dirname : undefined;

let resolvedFilename: string;
let resolvedDirname: string;

try {
  const metaUrl = g.import?.meta?.url
    ?? (globalsFilename ? pathToFileURL(globalsFilename).href : undefined);
  if (typeof metaUrl === "string" && metaUrl) {
    resolvedFilename = fileURLToPath(metaUrl);
  } else if (globalsFilename) {
    resolvedFilename = globalsFilename;
  } else {
    resolvedFilename = path.resolve(process.cwd(), "server", "services", "template-service.ts");
  }
  resolvedDirname = path.dirname(resolvedFilename);
} catch {
  resolvedFilename = globalsFilename ?? path.resolve(process.cwd(), "server", "services", "template-service.ts");
  resolvedDirname = globalsDirname ?? path.dirname(resolvedFilename);
}

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
