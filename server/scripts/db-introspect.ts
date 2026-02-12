import 'dotenv/config';
import { Client } from "pg";
import fs from "fs";

function envUrl() {
  const dev = process.env.DATABASE_URL_DEV;
  const prod = process.env.DATABASE_URL;
  const url = process.env.NODE_ENV === "production" ? prod : dev;
  if (!url) throw new Error("DATABASE_URL_DEV/DATABASE_URL não configurado");
  return url;
}

async function run() {
  const client = new Client({ connectionString: envUrl(), ssl: false });
  await client.connect();

  const tables = await client.query(`
    SELECT c.relname AS table_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind IN ('r','p') AND n.nspname = 'public'
    ORDER BY c.relname;
  `);

  const lines: string[] = [];
  lines.push(`# Estrutura Atual do Banco (public)`);
  lines.push("");

  for (const row of tables.rows) {
    const table = row.table_name as string;
    lines.push(`## Tabela: ${table}`);

    const columns = await client.query(`
      SELECT column_name, data_type, udt_name, is_nullable,
             character_maximum_length, numeric_precision, numeric_scale,
             datetime_precision
      FROM information_schema.columns
      WHERE table_schema='public' AND table_name=$1
      ORDER BY ordinal_position;
    `, [table]);

    lines.push(`- Colunas:`);
    for (const col of columns.rows) {
      const type = col.data_type === 'USER-DEFINED' ? col.udt_name : col.data_type;
      const details: string[] = [];
      if (col.numeric_precision) details.push(`precision=${col.numeric_precision}`);
      if (col.numeric_scale) details.push(`scale=${col.numeric_scale}`);
      if (col.character_maximum_length) details.push(`maxlen=${col.character_maximum_length}`);
      lines.push(`  - ${col.column_name}: ${type} ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}${details.length ? ` (${details.join(', ')})` : ''}`);
    }

    const pk = await client.query(`
      SELECT kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
      WHERE tc.table_schema='public' AND tc.table_name=$1 AND tc.constraint_type='PRIMARY KEY'
      ORDER BY kcu.ordinal_position;
    `, [table]);
    if (pk.rows.length) lines.push(`- PK: ${pk.rows.map(r => r.column_name).join(', ')}`);

    const uniques = await client.query(`
      SELECT tc.constraint_name, string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) AS cols
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
      WHERE tc.table_schema='public' AND tc.table_name=$1 AND tc.constraint_type='UNIQUE'
      GROUP BY tc.constraint_name;
    `, [table]);
    for (const u of uniques.rows) lines.push(`- UNIQUE ${u.constraint_name}: ${u.cols}`);

    const fks = await client.query(`
      SELECT tc.constraint_name,
             kcu.column_name AS fk_column,
             ccu.table_name AS referenced_table,
             ccu.column_name AS referenced_column
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
      WHERE tc.table_schema='public' AND tc.table_name=$1 AND tc.constraint_type='FOREIGN KEY';
    `, [table]);
    for (const fk of fks.rows) lines.push(`- FK ${fk.constraint_name}: ${fk.fk_column} → ${fk.referenced_table}(${fk.referenced_column})`);

    const indexes = await client.query(`
      SELECT indexname, indexdef FROM pg_indexes WHERE schemaname='public' AND tablename=$1;
    `, [table]);
    for (const idx of indexes.rows) lines.push(`- IDX ${idx.indexname}: ${idx.indexdef}`);

    lines.push("");
  }

  const procs = await client.query(`
    SELECT p.proname, pg_get_functiondef(p.oid) as definition
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname='public' AND p.prokind IN ('p','f')
    ORDER BY p.proname;
  `);
  if (procs.rows.length) {
    lines.push(`## Procedimentos/Funções`);
    for (const pr of procs.rows) {
      lines.push(`- ${pr.proname}`);
    }
    lines.push("");
  }

  await client.end();
  fs.writeFileSync("docs/db-estrutura-atual.md", lines.join("\n"), "utf-8");
  console.log("Documento gerado em docs/db-estrutura-atual.md");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
