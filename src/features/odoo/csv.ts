// A small RFC 4180 reader for exported spreadsheets: quoted fields may hold commas, line breaks and doubled
// quotes; a byte-order mark and blank lines are ignored. `line` is where each record starts in the file, so
// reports match the row numbers a spreadsheet shows.
export type CsvRecord = { line: number; values: Record<string, string>; extra: number };
export type CsvTable = { headers: string[]; rows: CsvRecord[] };

export class CsvError extends Error {}

export function parseCsv(text: string): CsvTable {
  const source = text.replace(/^﻿/, "");
  const records: { line: number; fields: string[] }[] = [];
  let field = "",
    fields: string[] = [],
    quoted = false,
    line = 1,
    start = 1;
  const endRecord = () => {
    fields.push(field);
    records.push({ line: start, fields });
    fields = [];
    field = "";
  };
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    if (quoted) {
      if (c === '"' && source[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else {
        if (c === "\n") line++;
        field += c;
      }
    } else if (c === '"' && field === "") quoted = true;
    else if (c === ",") {
      fields.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && source[i + 1] === "\n") i++;
      endRecord();
      start = ++line;
    } else field += c;
  }
  if (quoted) throw new CsvError(`A quoted value starting on line ${start} is never closed.`);
  if (field || fields.length) endRecord();
  const [header, ...body] = records.filter(record => record.fields.some(value => value.trim()));
  const headers = (header?.fields ?? []).map(name => name.trim().toLowerCase());
  return {
    headers,
    rows: body.map(record => ({
      line: record.line,
      values: Object.fromEntries(headers.map((name, i) => [name, (record.fields[i] ?? "").trim()])),
      extra: Math.max(0, record.fields.length - headers.length),
    })),
  };
}
