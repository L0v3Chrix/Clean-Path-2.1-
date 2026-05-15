import { useState, useRef } from 'react';
import { X, Upload, FileText, AlertTriangle, CheckCircle2, ChevronRight, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { base44 } from '@/api/base44Client';

const SCHEMA_FIELDS = [
  { key: 'name',               label: 'Item Name',           required: true },
  { key: 'category',           label: 'Category',            required: false },
  { key: 'current_quantity',   label: 'Current Quantity',    required: false },
  { key: 'unit',               label: 'Unit',                required: false },
  { key: 'low_stock_threshold',label: 'Low Stock Threshold', required: false },
  { key: 'reorder_quantity',   label: 'Reorder Quantity',    required: false },
  { key: 'notes',              label: 'Notes',               required: false },
];

const VALID_CATEGORIES = ['toiletries', 'cleaning_supplies', 'pantry', 'paper_goods', 'laundry', 'first_aid', 'other'];

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return { headers: [], rows: [] };
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const rows = lines.slice(1).map(line => {
    // Handle quoted commas
    const cols = [];
    let cur = '', inQ = false;
    for (const ch of line) {
      if (ch === '"') { inQ = !inQ; continue; }
      if (ch === ',' && !inQ) { cols.push(cur.trim()); cur = ''; continue; }
      cur += ch;
    }
    cols.push(cur.trim());
    return Object.fromEntries(headers.map((h, i) => [h, cols[i] ?? '']));
  });
  return { headers, rows };
}

function autoMap(headers) {
  const mapping = {};
  const normalize = s => s.toLowerCase().replace(/[\s_-]/g, '');
  const aliases = {
    name:                ['name', 'itemname', 'item', 'productname', 'product', 'description'],
    category:            ['category', 'cat', 'type', 'itemtype'],
    current_quantity:    ['currentquantity', 'quantity', 'qty', 'stock', 'currentstock', 'amount'],
    unit:                ['unit', 'units', 'uom', 'measureunit'],
    low_stock_threshold: ['lowstockthreshold', 'lowstock', 'threshold', 'minstock', 'minimum'],
    reorder_quantity:    ['reorderquantity', 'reorder', 'reorderamt'],
    notes:               ['notes', 'note', 'comments', 'comment', 'remarks'],
  };
  headers.forEach(h => {
    const norm = normalize(h);
    for (const [field, aliasList] of Object.entries(aliases)) {
      if (aliasList.includes(norm) && !mapping[field]) {
        mapping[field] = h;
      }
    }
  });
  return mapping;
}

function normalizeCategory(val) {
  if (!val) return 'other';
  const v = val.toLowerCase().replace(/[\s-]/g, '_');
  return VALID_CATEGORIES.includes(v) ? v : 'other';
}

function buildRecord(row, mapping, organizationId, locationId) {
  const get = (field) => {
    const col = mapping[field];
    return col ? (row[col] ?? '') : '';
  };
  const qty = parseFloat(get('current_quantity'));
  const threshold = parseFloat(get('low_stock_threshold')) || 2;
  const currentQty = isNaN(qty) ? 0 : qty;
  const status = currentQty === 0 ? 'out_of_stock' : currentQty <= threshold ? 'low_stock' : 'in_stock';
  return {
    organization_id: organizationId,
    ...(locationId ? { location_id: locationId } : {}),
    name: get('name').trim(),
    category: normalizeCategory(get('category')),
    current_quantity: currentQty,
    unit: get('unit').trim() || 'units',
    low_stock_threshold: threshold,
    reorder_quantity: parseFloat(get('reorder_quantity')) || undefined,
    notes: get('notes').trim() || undefined,
    status,
  };
}

// ─── Steps ─────────────────────────────────────────────────────────────────
// 1: Upload  2: Map columns  3: Preview & import  4: Done

export default function CSVImportModal({ organizationId, locationId, onClose, onImported }) {
  const fileRef = useRef(null);
  const [step, setStep] = useState(1);
  const [csvData, setCsvData] = useState(null);   // { headers, rows }
  const [fileName, setFileName] = useState('');
  const [mapping, setMapping] = useState({});      // { schemaField: csvHeader }
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);      // { imported, skipped, errors }

  // ── Step 1: parse file ──
  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const parsed = parseCSV(ev.target.result);
      setCsvData(parsed);
      setMapping(autoMap(parsed.headers));
      setStep(2);
    };
    reader.readAsText(file);
  };

  // ── Step 3: import ──
  const handleImport = async () => {
    setImporting(true);
    let imported = 0, skipped = 0;
    const errors = [];

    for (const row of csvData.rows) {
      const record = buildRecord(row, mapping, organizationId, locationId);
      if (!record.name) { skipped++; continue; }
      try {
        await base44.entities.HouseInventoryItem.create(record);
        imported++;
      } catch (err) {
        errors.push(`"${record.name}": ${err.message}`);
        skipped++;
      }
    }

    setResult({ imported, skipped, errors });
    setImporting(false);
    setStep(4);
    if (imported > 0) onImported();
  };

  const previewRows = csvData?.rows.slice(0, 5) ?? [];
  const totalRows = csvData?.rows.length ?? 0;
  const nameField = mapping['name'];
  const validCount = csvData?.rows.filter(r => nameField && r[nameField]?.trim()).length ?? 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center gap-3">
            {step > 1 && step < 4 && (
              <button onClick={() => setStep(s => s - 1)} className="p-1 rounded hover:bg-slate-100 text-slate-400">
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <FileText className="w-5 h-5 text-amber-600" />
            <div>
              <h2 className="text-base font-bold text-slate-800">Import Inventory from CSV</h2>
              <p className="text-xs text-slate-400">
                {step === 1 && 'Upload a CSV file to bulk-add inventory items'}
                {step === 2 && 'Map your CSV columns to inventory fields'}
                {step === 3 && 'Review before importing'}
                {step === 4 && 'Import complete'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step indicators */}
        <div className="flex items-center gap-1 px-6 pt-4 flex-shrink-0">
          {['Upload', 'Map Columns', 'Preview', 'Done'].map((label, i) => (
            <div key={i} className="flex items-center gap-1 flex-1">
              <div className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold flex-shrink-0 
                ${step > i + 1 ? 'bg-green-500 text-white' : step === i + 1 ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
                {step > i + 1 ? <CheckCircle2 className="w-3.5 h-3.5" /> : i + 1}
              </div>
              <span className={`text-xs hidden sm:block ${step === i + 1 ? 'text-amber-700 font-semibold' : 'text-slate-400'}`}>{label}</span>
              {i < 3 && <ChevronRight className="w-3 h-3 text-slate-200 flex-shrink-0" />}
            </div>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

          {/* ── Step 1: Upload ── */}
          {step === 1 && (
            <div className="space-y-4">
              <div
                onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed border-slate-200 rounded-xl p-10 text-center cursor-pointer hover:border-amber-400 hover:bg-amber-50 transition-colors"
              >
                <Upload className="w-10 h-10 text-amber-400 mx-auto mb-3" />
                <p className="text-sm font-semibold text-slate-700">Click to upload a CSV file</p>
                <p className="text-xs text-slate-400 mt-1">Must include at minimum an item name column</p>
              </div>
              <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFile} />

              <div className="bg-slate-50 rounded-xl p-4 space-y-1">
                <p className="text-xs font-semibold text-slate-600 mb-2">Expected CSV columns (any order, names flexible):</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  {SCHEMA_FIELDS.map(f => (
                    <div key={f.key} className="flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${f.required ? 'bg-amber-500' : 'bg-slate-300'}`} />
                      <span className="text-xs text-slate-600">{f.label}</span>
                      {f.required && <span className="text-xs text-amber-500">*</span>}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-slate-400 mt-2">* Required field. You'll map column names in the next step.</p>
              </div>
            </div>
          )}

          {/* ── Step 2: Map columns ── */}
          {step === 2 && csvData && (
            <div className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 flex items-center gap-2">
                <FileText className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <span className="text-xs text-amber-700 font-medium">{fileName}</span>
                <span className="text-xs text-amber-500 ml-auto">{totalRows} row{totalRows !== 1 ? 's' : ''} detected</span>
              </div>

              <div className="space-y-2">
                {SCHEMA_FIELDS.map(field => (
                  <div key={field.key} className="flex items-center gap-3 py-2 border-b border-slate-100 last:border-0">
                    <div className="w-44 flex-shrink-0">
                      <p className="text-xs font-semibold text-slate-700">{field.label}</p>
                      {field.required && <p className="text-xs text-amber-500">Required</p>}
                    </div>
                    <Select
                      value={mapping[field.key] || '__none__'}
                      onValueChange={val => setMapping(m => ({ ...m, [field.key]: val === '__none__' ? undefined : val }))}
                    >
                      <SelectTrigger className="h-8 text-xs flex-1">
                        <SelectValue placeholder="— skip —" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">— skip —</SelectItem>
                        {csvData.headers.map(h => (
                          <SelectItem key={h} value={h}>{h}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {mapping[field.key] && (
                      <span className="text-xs text-green-600 font-medium flex-shrink-0">✓ mapped</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Step 3: Preview ── */}
          {step === 3 && csvData && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-2.5">
                <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                <span className="text-xs text-green-700">
                  <strong>{validCount}</strong> of {totalRows} rows will be imported
                  {totalRows - validCount > 0 && ` · ${totalRows - validCount} will be skipped (no name)`}
                </span>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500">
                      {SCHEMA_FIELDS.filter(f => mapping[f.key]).map(f => (
                        <th key={f.key} className="text-left px-3 py-2 font-semibold whitespace-nowrap border-b border-slate-200">
                          {f.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row, i) => {
                      const record = buildRecord(row, mapping, organizationId, locationId);
                      return (
                        <tr key={i} className={`border-b border-slate-100 ${!record.name ? 'opacity-40 bg-red-50' : ''}`}>
                          {SCHEMA_FIELDS.filter(f => mapping[f.key]).map(f => (
                            <td key={f.key} className="px-3 py-2 text-slate-700">
                              {f.key === 'category'
                                ? normalizeCategory(row[mapping[f.key]])
                                : row[mapping[f.key]] || <span className="text-slate-300">—</span>}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {totalRows > 5 && (
                <p className="text-xs text-slate-400 text-center">Showing first 5 of {totalRows} rows</p>
              )}
            </div>
          )}

          {/* ── Step 4: Done ── */}
          {step === 4 && result && (
            <div className="space-y-4 text-center py-4">
              <CheckCircle2 className="w-14 h-14 text-green-500 mx-auto" />
              <div>
                <p className="text-lg font-bold text-slate-800">{result.imported} item{result.imported !== 1 ? 's' : ''} imported</p>
                {result.skipped > 0 && <p className="text-sm text-slate-400">{result.skipped} row{result.skipped !== 1 ? 's' : ''} skipped</p>}
              </div>
              {result.errors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-left space-y-1">
                  <p className="text-xs font-semibold text-red-700 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" /> Errors:
                  </p>
                  {result.errors.map((e, i) => <p key={i} className="text-xs text-red-600">{e}</p>)}
                </div>
              )}
              <Button onClick={onClose} className="bg-amber-500 hover:bg-amber-600 text-white px-8">
                Done
              </Button>
            </div>
          )}
        </div>

        {/* Footer */}
        {step < 4 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 flex-shrink-0">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            {step === 2 && (
              <Button
                disabled={!mapping['name']}
                onClick={() => setStep(3)}
                className="bg-amber-500 hover:bg-amber-600 text-white gap-1.5"
              >
                Preview <ChevronRight className="w-4 h-4" />
              </Button>
            )}
            {step === 3 && (
              <Button
                disabled={importing || validCount === 0}
                onClick={handleImport}
                className="bg-amber-500 hover:bg-amber-600 text-white gap-1.5"
              >
                {importing ? 'Importing…' : `Import ${validCount} Item${validCount !== 1 ? 's' : ''}`}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}