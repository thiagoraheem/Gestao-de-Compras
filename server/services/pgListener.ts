import { Client } from 'pg';
import { EventEmitter } from 'events';

interface NotificationPayload {
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  id: number;
  current_phase?: string;
  old_phase?: string;
  request_number?: string;
  requester_id?: number;
  company_id?: number;
  urgency?: string;
  category?: string;
  total_value?: string;
  chosen_supplier_id?: number;
  quotation_number?: string;
  purchase_request_id?: number;
  status?: string;
  old_status?: string;
  quotation_deadline?: string;
  is_active?: boolean;
  supplier_id?: number;
  is_chosen?: boolean;
  order_number?: string;
  approved_by?: number;
  receipt_number?: string;
  purchase_order_id?: number;
  received_by?: number;
  quality_approved?: boolean;
  timestamp: number;
  updated_at?: string;
}

class PostgreSQLListener extends EventEmitter {
  private client: Client;
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 5000;
  private reconnectTimer?: NodeJS.Timeout;

  constructor() {
    super();
    this.client = new Client({
      connectionString: process.env.DATABASE_URL,
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000,
    });
  }

  async connect(): Promise<void> {
    try {
      await this.client.connect();
      this.isConnected = true;
      this.reconnectAttempts = 0;
      
      console.log('✅ PostgreSQL LISTEN/NOTIFY connected successfully');
      
      // Configure listeners for notifications
      this.client.on('notification', (msg) => {
        try {
          const payload: NotificationPayload = JSON.parse(msg.payload!);
          
          switch (msg.channel) {
            case 'purchase_request_changes':
              this.emit('purchase_request:change', payload);
              console.log(`📢 Purchase Request ${payload.operation}: ID ${payload.id}, Phase: ${payload.current_phase}`);
              break;
            case 'quotation_changes':
              this.emit('quotation:change', payload);
              console.log(`📢 Quotation ${payload.operation}: ID ${payload.id}, Status: ${payload.status}`);
              break;
            case 'supplier_quotation_changes':
              this.emit('supplier_quotation:change', payload);
              console.log(`📢 Supplier Quotation ${payload.operation}: ID ${payload.id}, Status: ${payload.status}`);
              break;
            case 'purchase_order_changes':
              this.emit('purchase_order:change', payload);
              console.log(`📢 Purchase Order ${payload.operation}: ID ${payload.id}, Status: ${payload.status}`);
              break;
            case 'receipt_changes':
              this.emit('receipt:change', payload);
              console.log(`📢 Receipt ${payload.operation}: ID ${payload.id}, Status: ${payload.status}`);
              break;
            default:
              console.log(`📢 Unknown channel: ${msg.channel}`);
          }
        } catch (error) {
          console.error('❌ Error processing notification:', error);
        }
      });

      // Configure listener for connection errors
      this.client.on('error', (error) => {
        console.error('❌ PostgreSQL connection error:', error);
        this.isConnected = false;
        this.handleReconnection();
      });

      this.client.on('end', () => {
        console.log('🔌 PostgreSQL connection ended');
        this.isConnected = false;
        this.handleReconnection();
      });

      // Subscribe to channels
      await this.client.query('LISTEN purchase_request_changes');
      await this.client.query('LISTEN quotation_changes');
      await this.client.query('LISTEN supplier_quotation_changes');
      await this.client.query('LISTEN purchase_order_changes');
      await this.client.query('LISTEN receipt_changes');
      
      console.log('🎧 Subscribed to all notification channels');
      
    } catch (error) {
      console.error('❌ Error connecting PostgreSQL listener:', error);
      this.isConnected = false;
      this.handleReconnection();
    }
  }

  private async handleReconnection(): Promise<void> {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error(`❌ Maximum reconnection attempts (${this.maxReconnectAttempts}) reached`);
      this.emit('max_reconnect_attempts_reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    console.log(`🔄 Reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);
    
    this.reconnectTimer = setTimeout(async () => {
      try {
        // Close existing connection if it exists
        if (this.client) {
          try {
            await this.client.end();
          } catch (error) {
            // Ignore errors when closing
          }
        }
        
        // Create new client
        this.client = new Client({
          connectionString: process.env.DATABASE_URL,
          keepAlive: true,
          keepAliveInitialDelayMillis: 10000,
        });
        
        await this.connect();
      } catch (error) {
        console.error(`❌ Reconnection attempt ${this.reconnectAttempts} failed:`, error);
        this.handleReconnection();
      }
    }, delay);
  }

  async disconnect(): Promise<void> {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    if (this.isConnected && this.client) {
      try {
        await this.client.query('UNLISTEN purchase_request_changes');
        await this.client.query('UNLISTEN quotation_changes');
        await this.client.query('UNLISTEN supplier_quotation_changes');
        await this.client.query('UNLISTEN purchase_order_changes');
        await this.client.query('UNLISTEN receipt_changes');
        await this.client.end();
        this.isConnected = false;
        console.log('🔌 PostgreSQL listener disconnected');
      } catch (error) {
        console.error('❌ Error disconnecting PostgreSQL listener:', error);
      }
    }
  }

  isListening(): boolean {
    return this.isConnected;
  }

  getConnectionStatus(): {
    connected: boolean;
    reconnectAttempts: number;
    maxReconnectAttempts: number;
  } {
    return {
      connected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
      maxReconnectAttempts: this.maxReconnectAttempts,
    };
  }

  // Test method to manually trigger a notification (for development/testing)
  async testNotification(channel: string, payload: any): Promise<void> {
    if (!this.isConnected) {
      throw new Error('PostgreSQL listener is not connected');
    }
    
    try {
      await this.client.query('SELECT pg_notify($1, $2)', [channel, JSON.stringify(payload)]);
      console.log(`🧪 Test notification sent to channel: ${channel}`);
    } catch (error) {
      console.error('❌ Error sending test notification:', error);
      throw error;
    }
  }
}

export { PostgreSQLListener };
export const pgListener = new PostgreSQLListener();

// Graceful shutdown handling
process.on('SIGINT', async () => {
  console.log('🛑 Received SIGINT, shutting down PostgreSQL listener...');
  await pgListener.disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('🛑 Received SIGTERM, shutting down PostgreSQL listener...');
  await pgListener.disconnect();
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', async (error) => {
  console.error('💥 Uncaught exception in PostgreSQL listener:', error);
  await pgListener.disconnect();
  process.exit(1);
});

process.on('unhandledRejection', async (reason, promise) => {
  console.error('💥 Unhandled rejection in PostgreSQL listener:', reason);
  await pgListener.disconnect();
  process.exit(1);
});