import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool, PoolClient } from "pg";
import * as schema from "@shared/schema";

const isProduction = process.env.NODE_ENV === "production";

// Configuração do pool baseada no ambiente
const databaseUrl = isProduction ? process.env.DATABASE_URL : process.env.DATABASE_URL_DEV;

if (!databaseUrl) {
  const envVar = isProduction ? 'DATABASE_URL' : 'DATABASE_URL_DEV';
  throw new Error(`${envVar} not found. Please set the appropriate database URL in your environment variables.`);
}

// Configuração robusta do pool com timeouts e retry logic
const poolConfig = {
  connectionString: databaseUrl,
  // Pool settings
  max: 20, // máximo de conexões no pool
  min: 2, // mínimo de conexões mantidas
  idleTimeoutMillis: 30000, // 30 segundos para fechar conexões idle
  connectionTimeoutMillis: 10000, // 10 segundos timeout para nova conexão
  // Query timeout
  query_timeout: 30000, // 30 segundos timeout para queries
  // Keep alive settings
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
  // SSL para produção
  ...(isProduction && {
    ssl: {
      rejectUnauthorized: false,
    },
  }),
};

// Estado da conexão
let isConnected = false;
let reconnectAttempts = 0;
const maxReconnectAttempts = 5;
const baseReconnectDelay = 1000; // 1 segundo

export const pool = new Pool(poolConfig);

// Função para calcular delay com backoff exponencial
function getReconnectDelay(attempt: number): number {
  return Math.min(baseReconnectDelay * Math.pow(2, attempt), 30000); // máximo 30 segundos
}

// Função para tentar reconectar
async function attemptReconnection(): Promise<void> {
  if (reconnectAttempts >= maxReconnectAttempts) {
    console.error(`❌ Máximo de tentativas de reconexão atingido (${maxReconnectAttempts})`);
    return;
  }

  reconnectAttempts++;
  const delay = getReconnectDelay(reconnectAttempts - 1);
  
  console.log(`🔄 Tentativa de reconexão ${reconnectAttempts}/${maxReconnectAttempts} em ${delay}ms...`);
  
  setTimeout(async () => {
    try {
      const client = await pool.connect();
      await client.query('SELECT 1');
      client.release();
      
      console.log('✅ Reconexão com banco de dados bem-sucedida!');
      isConnected = true;
      reconnectAttempts = 0;
    } catch (error) {
      console.error(`❌ Falha na tentativa de reconexão ${reconnectAttempts}:`, error);
      if (reconnectAttempts < maxReconnectAttempts) {
        attemptReconnection();
      }
    }
  }, delay);
}

// Event handlers para o pool
pool.on('connect', (client: PoolClient) => {
  console.log('🔗 Nova conexão estabelecida com o banco de dados');
  isConnected = true;
  reconnectAttempts = 0;
});

pool.on('error', (err: Error) => {
  console.error('❌ Erro no pool de conexões PostgreSQL:', err);
  isConnected = false;
  
  // Verificar se é um erro de conexão que requer reconexão
  if (err.message.includes('Connection terminated') || 
      err.message.includes('ECONNRESET') ||
      err.message.includes('ENOTFOUND') ||
      err.message.includes('ECONNREFUSED')) {
    console.log('🔄 Iniciando processo de reconexão...');
    attemptReconnection();
  }
});

pool.on('remove', () => {
  console.log('🔌 Conexão removida do pool');
});

// Função para verificar saúde da conexão
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    isConnected = true;
    return true;
  } catch (error) {
    console.error('❌ Health check do banco falhou:', error);
    isConnected = false;
    return false;
  }
}

// Função wrapper para queries com retry automático
export async function executeQuery<T>(
  queryFn: () => Promise<T>,
  maxRetries: number = 3
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await queryFn();
    } catch (error) {
      lastError = error as Error;
      console.error(`❌ Erro na query (tentativa ${attempt}/${maxRetries}):`, error);
      
      // Se é erro de conexão e não é a última tentativa, aguarda e tenta novamente
      if (attempt < maxRetries && 
          (error as Error).message.includes('Connection terminated') ||
          (error as Error).message.includes('ECONNRESET')) {
        
        const delay = getReconnectDelay(attempt - 1);
        console.log(`⏳ Aguardando ${delay}ms antes da próxima tentativa...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      // Se não é erro de conexão ou é a última tentativa, propaga o erro
      throw error;
    }
  }
  
  throw lastError!;
}

// Getter para status da conexão
export function isDatabaseConnected(): boolean {
  return isConnected;
}

// Inicialização do pool com health check
(async () => {
  try {
    console.log('🚀 Inicializando conexão com banco de dados...');
    const healthy = await checkDatabaseHealth();
    if (healthy) {
      console.log('✅ Conexão com banco de dados estabelecida com sucesso!');
    } else {
      console.log('⚠️ Falha na conexão inicial, tentando reconectar...');
      attemptReconnection();
    }
  } catch (error) {
    console.error('❌ Erro na inicialização do banco:', error);
    attemptReconnection();
  }
})();

export const db = drizzle(pool, { schema });

// Função para validar sessão no banco de dados
export async function validateSession(sessionId: string): Promise<{ userId: number } | null> {
  try {
    console.log('🔍 validateSession: Input sessionId:', sessionId.substring(0, 20) + '...');
    
    // Não remover prefixo 's:' aqui, pois já foi processado no WebSocket
    // O sessionId que chega aqui já deve estar limpo
    const cleanSessionId = sessionId;
    
    console.log('🔍 validateSession: Searching for sessionId:', cleanSessionId.substring(0, 20) + '...');
    
    // Buscar sessão no banco
    const result = await pool.query(
      'SELECT sess FROM sessions WHERE sid = $1 AND expire > NOW()',
      [cleanSessionId]
    );
    
    console.log('🔍 validateSession: Query result rows:', result.rows.length);
    
    if (result.rows.length === 0) {
      console.log('❌ Sessão não encontrada ou expirada:', cleanSessionId.substring(0, 20) + '...');
      
      // Debug: Verificar se existem sessões similares
      const debugResult = await pool.query(
        'SELECT sid, expire FROM sessions WHERE sid LIKE $1 OR sid LIKE $2 ORDER BY expire DESC LIMIT 3',
        [`%${cleanSessionId.substring(0, 10)}%`, `s:${cleanSessionId}%`]
      );
      console.log('🔍 validateSession: Similar sessions found:', debugResult.rows.length);
      debugResult.rows.forEach((row, index) => {
        console.log(`   ${index + 1}. SID: ${row.sid.substring(0, 30)}... Expires: ${row.expire}`);
      });
      
      return null;
    }
    
    const sessionData = result.rows[0].sess;
    
    if (!sessionData || !sessionData.userId) {
      console.log('❌ Sessão sem userId:', cleanSessionId.substring(0, 20) + '...');
      return null;
    }
    
    console.log('✅ Sessão válida encontrada para userId:', sessionData.userId);
    return { userId: sessionData.userId };
    
  } catch (error) {
    console.error('❌ Erro ao validar sessão:', error);
    return null;
  }
}
