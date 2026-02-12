
import { configService } from "../server/services/configService";
import { db } from "../server/db";

async function diagnose() {
  try {
    console.log("Iniciando diagnóstico de configuração...");
    
    // 1. Verificar configuração resolvida
    const config = await configService.getLocadorConfig();
    console.log("Configuração Resolvida:");
    console.log(JSON.stringify(config, null, 2));
    
    // 2. Tentar conexão usando a URL resolvida
    const urlFormaPagamento = `${config.baseUrl}${config.endpoints.combo.formaPagamento}`;
    console.log(`\nTestando conexão com: ${urlFormaPagamento}`);
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(urlFormaPagamento, { signal: controller.signal });
      clearTimeout(timeoutId);
      
      console.log(`Status: ${response.status} ${response.statusText}`);
      if (response.ok) {
        const data = await response.json();
        console.log("Dados recebidos (primeiros 2 itens):", Array.isArray(data) ? data.slice(0, 2) : data);
      } else {
        console.error("Erro na resposta:", await response.text());
      }
    } catch (err: any) {
      console.error("Erro de conexão (fetch):", err.message);
      if (err.cause) console.error("Causa:", err.cause);
    }

  } catch (error) {
    console.error("Erro fatal no diagnóstico:", error);
  } finally {
    process.exit(0);
  }
}

diagnose();
