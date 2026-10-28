import { readFile, writeFile } from "node:fs/promises";
import { createLocalDatabase } from "./lib/local-database";

type Column = {
  table_name: string;
  column_name: string;
  udt_name: string;
  is_nullable: string;
  column_default: string | null;
  is_generated: string;
};
type Relation = {
  table_name: string;
  foreignKeyName: string;
  columns: string[];
  referencedRelation: string;
  referencedColumns: string[];
  isOneToOne: boolean;
};

function tsType(type: string): string {
  if (type.startsWith("_")) return `${tsType(type.slice(1))}[]`;
  if (["int2", "int4", "int8", "float4", "float8", "numeric"].includes(type)) return "number";
  if (type === "bool") return "boolean";
  if (["json", "jsonb"].includes(type)) return "Json";
  if (["uuid", "text", "varchar", "timestamptz", "timestamp", "date"].includes(type)) return "string";
  throw new Error(`Unmapped PostgreSQL type: ${type}`);
}

async function main() {
  const db = await createLocalDatabase({ seed: false });
  try {
    const { rows: columns } =
      await db.query<Column>(`select table_name, column_name, udt_name, is_nullable, column_default, is_generated
    from information_schema.columns where table_schema = 'public' order by table_name, ordinal_position`);
    const { rows: relations } = await db.query<Relation>(`select t.relname as table_name, c.conname as "foreignKeyName",
    array(select a.attname from unnest(c.conkey) with ordinality k(num, ord) join pg_attribute a on a.attrelid=c.conrelid and a.attnum=k.num order by k.ord) as columns,
    r.relname as "referencedRelation",
    array(select a.attname from unnest(c.confkey) with ordinality k(num, ord) join pg_attribute a on a.attrelid=c.confrelid and a.attnum=k.num order by k.ord) as "referencedColumns",
    exists(select 1 from pg_constraint u where u.conrelid=c.conrelid and u.contype in ('p','u') and u.conkey=c.conkey) as "isOneToOne"
    from pg_constraint c join pg_class t on t.oid=c.conrelid join pg_namespace n on n.oid=t.relnamespace
    join pg_class r on r.oid=c.confrelid join pg_namespace rn on rn.oid=r.relnamespace
    where c.contype='f' and n.nspname='public' and rn.nspname='public' order by t.relname,c.conname`);
    const { rows: functions } = await db.query<{
      name: string;
      arg_names: string[] | null;
      arg_types: string[];
      return_type: string;
    }>(`
    select p.proname as name, p.proargnames as arg_names,
      array(select t.typname from unnest(p.proargtypes) with ordinality a(id,ord) join pg_type t on t.oid=a.id order by a.ord) as arg_types,
      t.typname as return_type from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_type t on t.oid=p.prorettype
    where n.nspname='public' and not p.proretset and t.typname <> 'trigger' order by p.proname`);
    const tables = [...new Set(columns.map(c => c.table_name))];
    let output =
      "// Generated from migrations executed in local PostgreSQL (PGlite). Do not edit.\n// Regenerate: npm run db:types. Hosted Supabase schema is not inspected by this command.\n\n";
    output += "export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];\n\n";
    output += "export type Database = {\n  public: {\n    Tables: {\n";
    for (const table of tables) {
      const fields = columns.filter(c => c.table_name === table);
      output += `      ${table}: {\n`;
      for (const mode of ["Row", "Insert", "Update"]) {
        output += `        ${mode}: {\n`;
        for (const column of fields) {
          const generated = column.is_generated === "ALWAYS";
          const optional =
            mode === "Update" ||
            (mode === "Insert" && (generated || column.column_default !== null || column.is_nullable === "YES"));
          const type =
            generated && mode !== "Row"
              ? "never"
              : tsType(column.udt_name) + (column.is_nullable === "YES" ? " | null" : "");
          output += `          ${column.column_name}${optional ? "?" : ""}: ${type};\n`;
        }
        output += "        };\n";
      }
      const links = relations
        .filter(r => r.table_name === table)
        .map(r => ({
          foreignKeyName: r.foreignKeyName,
          columns: r.columns,
          referencedRelation: r.referencedRelation,
          referencedColumns: r.referencedColumns,
          isOneToOne: r.isOneToOne,
        }));
      output += `        Relationships: ${JSON.stringify(links, null, 2).split("\n").join("\n        ")};\n      };\n`;
    }
    output += "    };\n    Views: { [_ in never]: never };\n    Functions: {\n";
    for (const fn of functions) {
      const args = fn.arg_types.map((type, i) => `${fn.arg_names?.[i] ?? `arg${i}`}: ${tsType(type)}`).join("; ");
      // A function without arguments takes `never`, as in Supabase's own generator (an empty `{}` fails lint).
      output += `      ${fn.name}: { Args: ${args ? `{ ${args} }` : "never"}; Returns: ${tsType(fn.return_type)} };\n`;
    }
    output += "    };\n    Enums: { [_ in never]: never };\n    CompositeTypes: { [_ in never]: never };\n  };\n};\n\n";
    output +=
      'export type TableName = keyof Database["public"]["Tables"];\nexport type Tables<T extends TableName> = Database["public"]["Tables"][T]["Row"];\nexport type TablesInsert<T extends TableName> = Database["public"]["Tables"][T]["Insert"];\nexport type TablesUpdate<T extends TableName> = Database["public"]["Tables"][T]["Update"];\n';
    const path = "src/types/database.types.ts";
    if (process.argv.includes("--check")) {
      if ((await readFile(path, "utf8")) !== output) throw new Error("Database types are stale. Run npm run db:types.");
      console.log(`Database types match all ${tables.length} migrated tables.`);
    } else {
      await writeFile(path, output, "utf8");
      console.log(`Generated types for ${tables.length} tables from the migrated database catalog.`);
    }
  } finally {
    await db.close();
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
