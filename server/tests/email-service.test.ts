import { decorateEmailHtmlWithEnvironmentBanner } from "../email-service";

const originalEnv = { ...process.env };

describe("decorateEmailHtmlWithEnvironmentBanner", () => {
  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("não deve adicionar alerta em produção", () => {
    process.env.NODE_ENV = "production";
    const html = "<html><body><div>Conteúdo</div></body></html>";
    const result = decorateEmailHtmlWithEnvironmentBanner(html, new Date("2024-01-01T12:00:00Z"));
    expect(result).toBe(html);
  });

  it("deve adicionar alerta e rodapé em ambiente de desenvolvimento", () => {
    process.env.NODE_ENV = "development";
    process.env.APP_ENV = "development";
    process.env.APP_VERSION = "2.3.4";

    const html = "<html><body><div>Conteúdo</div></body></html>";
    const fixedDate = new Date("2024-01-01T12:00:00Z");
    const result = decorateEmailHtmlWithEnvironmentBanner(html, fixedDate);

    expect(result).toContain("ENVIADO A PARTIR DO AMBIENTE DE TESTES");
    expect(result).toContain("development".toUpperCase());
    expect(result).toContain("Versão do sistema");
    expect(result).toContain("2.3.4");
  });

  it("deve adicionar alerta utilizando NODE_ENV quando APP_ENV não estiver definido", () => {
    process.env.NODE_ENV = "staging";
    delete process.env.APP_ENV;
    process.env.APP_VERSION = "3.0.0";

    const html = "<html><body><p>Teste</p></body></html>";
    const result = decorateEmailHtmlWithEnvironmentBanner(html, new Date("2024-01-01T12:00:00Z"));

    expect(result).toContain("ENVIADO A PARTIR DO AMBIENTE DE TESTES");
    expect(result).toContain("STAGING");
  });

  it("deve funcionar mesmo se o HTML não tiver tag body", () => {
    process.env.NODE_ENV = "test";
    const html = "<div>Sem body</div>";
    const result = decorateEmailHtmlWithEnvironmentBanner(html, new Date("2024-01-01T12:00:00Z"));

    expect(result).toContain("ENVIADO A PARTIR DO AMBIENTE DE TESTES");
    expect(result).toContain("Sem body");
  });
});

