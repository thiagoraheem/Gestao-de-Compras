import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function checkDates() {
  const result = await db.execute(sql`
    SELECT 
      current_phase, 
      COUNT(*) as total,
      MIN(updated_at) as min_date, 
      MAX(updated_at) as max_date 
    FROM purchase_requests 
    WHERE current_phase = 'pedido_concluido'
    GROUP BY current_phase;
  `);
  console.log(result.rows);
  process.exit(0);
}

checkDates().catch(err => {
  console.error(err);
  process.exit(1);
});
