import { useState, useRef } from 'react';
import { X, Upload, CheckCircle, AlertCircle, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { appClient } from '@/services/appClient';

export default function DataImportModal({ entityName, onClose, onSuccess }) {
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState('idle'); // idle, uploading, success, error
  const [result, setResult] = useState(null);
  const fileRef = useRef();

  const handleFile = (e) => {
    const f = e.target.files[0];
    if (f) setFile(f);
  };

  const handleImport = async () => {
    if (!file) return;
    setStatus('uploading');
    try {
      const { file_url } = await appClient.integrations.Core.UploadFile({ file });
      // Use LLM to map columns then bulk create
      const schema = await appClient.entities[entityName].schema();
      const extracted = await appClient.integrations.Core.ExtractDataFromUploadedFile({
        file_url,
        json_schema: { type: 'object', properties: { records: { type: 'array', items: { type: 'object', properties: schema.properties } } } }
      });
      if (extracted.status === 'success' && extracted.output?.records?.length > 0) {
        await appClient.entities[entityName].bulkCreate(extracted.output.records);
        setResult({ success: extracted.output.records.length, failed: 0 });
        setStatus('success');
      } else {
        setResult({ success: 0, failed: 1, message: extracted.details || 'Could not parse file' });
        setStatus('error');
      }
    } catch (e) {
      setResult({ success: 0, failed: 1, message: e.message });
      setStatus('error');
    }
  };

  const csvTemplate = () => {
    const templates = {
      Resident: 'first_name,last_name,date_of_birth,phone,email,intake_date,status,room,recovery_pathway,referred_by',
      StaffMember: 'first_name,last_name,email,phone,role,title,hire_date',
      Location: 'name,address,city,state,zip,housing_type,narr_level,total_beds',
    };
    const content = templates[entityName] || 'name';
    const blob = new Blob([content], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${entityName.toLowerCase()}_template.csv`; a.click();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="font-bold text-slate-900">Import {entityName} Data</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="bg-blue-50 rounded-xl p-4 text-sm text-blue-800">
            <p className="font-semibold mb-1">Migrate from any existing software</p>
            <p className="text-xs">Upload a CSV, Excel, or JSON export from OneStep, OathTrack, Sobriety Hub, or any spreadsheet. We'll map the columns automatically.</p>
          </div>

          <div
            className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center cursor-pointer hover:border-teal-400 transition-colors"
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            {file ? (
              <div>
                <p className="text-sm font-medium text-teal-600">{file.name}</p>
                <p className="text-xs text-slate-500 mt-1">{(file.size / 1024).toFixed(0)} KB</p>
              </div>
            ) : (
              <div>
                <p className="text-sm font-medium text-slate-600">Drop your file here or click to browse</p>
                <p className="text-xs text-slate-400 mt-1">CSV, XLSX, or JSON supported</p>
              </div>
            )}
            <input ref={fileRef} type="file" accept=".csv,.xlsx,.json" className="hidden" onChange={handleFile} />
          </div>

          <button onClick={csvTemplate} className="flex items-center gap-2 text-xs text-teal-600 hover:underline">
            <Download className="w-3 h-3" /> Download CSV template
          </button>

          {status === 'success' && (
            <div className="flex items-center gap-2 text-green-700 bg-green-50 rounded-lg p-3">
              <CheckCircle className="w-4 h-4" />
              <span className="text-sm">Successfully imported {result.success} records!</span>
            </div>
          )}
          {status === 'error' && (
            <div className="flex items-center gap-2 text-red-700 bg-red-50 rounded-lg p-3">
              <AlertCircle className="w-4 h-4" />
              <span className="text-sm">{result?.message || 'Import failed. Check your file format.'}</span>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 p-5 border-t">
          {status === 'success' ? (
            <Button onClick={onSuccess} className="bg-teal-600 hover:bg-teal-700">Done</Button>
          ) : (
            <>
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button onClick={handleImport} disabled={!file || status === 'uploading'} className="bg-teal-600 hover:bg-teal-700">
                {status === 'uploading' ? 'Importing...' : 'Import'}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}