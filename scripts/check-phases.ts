import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function checkPhases() {
  const result = await db.execute(sql`SELECT current_phase, count(*) FROM purchase_requests GROUP BY current_phase;`);
  console.log(result.rows);
  process.exit(0);
}

checkPhases().catch(err => {
  console.error(err);
  process.exit(1);
});
