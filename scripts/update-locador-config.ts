
import { db } from "../server/db";
import { appSettings } from "../shared/schema";
import { eq } from "drizzle-orm";
import { configService } from "../server/services/configService";

async function updateConfig() {
  try {
    console.log("Buscando configuração atual...");
    const currentSettings = await db
      .select()
      .from(appSettings)
      .where(eq(appSettings.key, "locador.config"))
      .limit(1);

    if (currentSettings.length === 0) {
      console.log("Nenhuma configuração encontrada no banco. Criando nova...");
      // Se não existir, o configService usa defaults, mas vamos persistir o correto.
      const newConfig = {
        enabled: true,
        sendEnabled: true,
        baseUrl: "http://localhost:5225/api",
        endpoints: {
          combo: {
            fornecedor: "/Fornecedor",
            centroCusto: "/CostCenter",
            planoContas: "/ChartOfAccounts",
            empresa: "/Empresa",
            formaPagamento: "/FormaPagamento"
          },
          post: {
            enviarSolicitacao: "/Purchase/PurchaseRequest",
            recebimento: "/Purchase/PurchaseReceive"
          }
        }
      };
      
      await db.insert(appSettings).values({
        key: "locador.config",
        value: newConfig,
        isSecret: false,
        updatedAt: new Date()
      });
      console.log("Configuração criada com sucesso!");
    } else {
      const config = currentSettings[0].value as any;
      console.log("Configuração atual encontrada. Atualizando Base URL...");
      console.log(`URL Antiga: ${config.baseUrl}`);
      
      config.baseUrl = "http://localhost:5225/api";
      // Garantir sendEnabled = true para permitir testes
      config.sendEnabled = true; 
      
      await db
        .update(appSettings)
        .set({ 
          value: config,
          updatedAt: new Date()
        })
        .where(eq(appSettings.key, "locador.config"));
        
      console.log(`Nova URL: ${config.baseUrl}`);
      console.log("Configuração atualizada com sucesso!");
    }
    
    // Invalidar cache
    configService.invalidateLocadorCache();
    console.log("Cache invalidado.");

  } catch (error) {
    console.error("Erro ao atualizar configuração:", error);
  } finally {
    process.exit(0);
  }
}

updateConfig();
