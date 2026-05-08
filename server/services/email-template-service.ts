import fs from "fs/promises";
import path from "path";

class EmailTemplateService {
  private templates: Map<string, string> = new Map();

  /**
   * Renders a template with the given data.
   * Supports:
   * - {{variable}} : Escaped value
   * - {{{variable}}} : Raw (unescaped) value
   * - {{#if variable}}...{{/if}} : Conditional block
   */
  async render(templateName: string, data: Record<string, any>): Promise<string> {
    let template = this.templates.get(templateName);

    if (!template) {
      const templatePath = path.join(process.cwd(), "server", "templates", `${templateName}.html`);
      try {
        template = await fs.readFile(templatePath, "utf-8");
        this.templates.set(templateName, template);
      } catch (error) {
        console.error(`Error reading template ${templateName}:`, error);
        throw new Error(`Template ${templateName} not found`);
      }
    }

    let rendered = template;

    // Handle {{#if variable}}...{{/if}}
    // This simple version doesn't support nested if's but it's enough for our current templates
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

export const emailTemplateService = new EmailTemplateService();
