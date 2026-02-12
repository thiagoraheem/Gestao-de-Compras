import { costCenterService } from '../server/integracao_locador/services/cost-center-service';
import { chartOfAccountsService } from '../server/integracao_locador/services/chart-of-accounts-service';

async function run() {
  console.log('Test (TS): Serviços de integração Locador');
  try {
    const ccs = await costCenterService.list();
    console.log('Centros de Custo:', ccs.length);
  } catch (e: any) {
    console.log('Falha CC:', e?.message || String(e));
  }

  try {
    const contas = await chartOfAccountsService.list();
    console.log('Plano de Contas:', contas.length);
  } catch (e: any) {
    console.log('Falha Plano de Contas:', e?.message || String(e));
  }
}

run();

