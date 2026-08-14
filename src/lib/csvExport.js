function safeCell(value) {
  if (value === null || value === undefined) return '';
  let text = Array.isArray(value) || typeof value === 'object' ? JSON.stringify(value) : String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function recordsToCsv(records, columns) {
  const lines = [columns.map(safeCell).join(',')];
  for (const record of records) lines.push(columns.map((column) => safeCell(record[column])).join(','));
  return `${lines.join('\r\n')}\r\n`;
}

export function downloadCsv(filename, records, columns) {
  const blob = new Blob([recordsToCsv(records, columns)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
