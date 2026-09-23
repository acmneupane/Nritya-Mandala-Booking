// Minimal CSV building/downloading — no library needed for something this small.
// Escaping follows the standard CSV rule: wrap a field in quotes if it contains a
// comma, quote, or newline, and double up any quotes inside it.
function escapeCsvField(value) {
  const s = value == null ? "" : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// rows: array of objects. columns: [{ key, label }] — key looks up the value on
// each row (dot paths not supported, callers pre-shape rows flat), label is the
// header cell.
export function toCsv(rows, columns) {
  const header = columns.map((c) => escapeCsvField(c.label)).join(",");
  const lines = rows.map((row) => columns.map((c) => escapeCsvField(row[c.key])).join(","));
  return [header, ...lines].join("\n");
}

export function downloadCsv(filename, csvText) {
  // Leading BOM so Excel (which otherwise guesses the wrong encoding) renders
  // accented characters and the "$" sign correctly instead of as mojibake.
  const blob = new Blob(["﻿" + csvText], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
