import { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { X, Upload, File, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const FOLDERS = [
  { id: 'resident_records', label: 'Resident Records' },
  { id: 'intake', label: 'Intake Forms' },
  { id: 'management', label: 'Management' },
  { id: 'hr', label: 'HR & Staff' },
  { id: 'financial', label: 'Financial' },
  { id: 'compliance', label: 'Compliance' },
  { id: 'legal', label: 'Legal' },
  { id: 'other', label: 'Other' },
];

const ACCESS_OPTIONS = [
  { id: 'admin_only', label: 'Admin Only' },
  { id: 'staff_and_admin', label: 'Staff & Admin' },
  { id: 'all_staff', label: 'All Staff' },
];

export default function UploadDocumentModal({ residents, user, onClose, onUploaded }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [folder, setFolder] = useState('other');
  const [accessLevel, setAccessLevel] = useState('staff_and_admin');
  const [residentId, setResidentId] = useState('');
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef();

  const handleFileChange = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f);
    if (!title) setTitle(f.name.replace(/\.[^/.]+$/, ''));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file || !title || !folder) { setError('Title, folder, and file are required.'); return; }
    setUploading(true);
    setError('');
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const resident = residents.find(r => r.id === residentId);
      const doc = await base44.entities.SecureDocument.create({
        organization_id: user?.organization_id || 'default',
        title,
        description,
        folder,
        access_level: accessLevel,
        file_url,
        file_name: file.name,
        file_type: file.type,
        file_size_kb: Math.round(file.size / 1024),
        uploaded_by_name: user?.full_name || user?.email,
        uploaded_by_id: user?.id,
        resident_id: residentId || undefined,
        resident_name: resident ? `${resident.first_name} ${resident.last_name}` : undefined,
      });
      onUploaded(doc);
    } catch (err) {
      setError('Upload failed. Please try again.');
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="font-bold text-slate-900">Upload Secure Document</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* File picker */}
          <div
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center cursor-pointer hover:border-amber-400 hover:bg-amber-50 transition-colors"
          >
            {file ? (
              <div className="flex items-center justify-center gap-3 text-sm text-slate-700">
                <File className="w-6 h-6 text-amber-500" />
                <div className="text-left">
                  <p className="font-medium">{file.name}</p>
                  <p className="text-xs text-slate-400">{Math.round(file.size / 1024)} KB</p>
                </div>
              </div>
            ) : (
              <>
                <Upload className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-500">Click to choose a file</p>
                <p className="text-xs text-slate-400 mt-1">PDF, images, Word, Excel — max 50MB</p>
              </>
            )}
            <input ref={fileRef} type="file" className="hidden" onChange={handleFileChange} accept="*/*" />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Document Title *</label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. John Doe – Intake Agreement" required />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Description</label>
            <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional notes about this document" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Folder *</label>
              <Select value={folder} onValueChange={setFolder}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FOLDERS.map(f => <SelectItem key={f.id} value={f.id}>{f.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Access Level *</label>
              <Select value={accessLevel} onValueChange={setAccessLevel}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ACCESS_OPTIONS.map(a => <SelectItem key={a.id} value={a.id}>{a.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Link to Resident (optional)</label>
            <Select value={residentId} onValueChange={setResidentId}>
              <SelectTrigger><SelectValue placeholder="— None (general document) —" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={null}>— None —</SelectItem>
                {residents.filter(r => r.status === 'active' || r.status === 'applicant').map(r => (
                  <SelectItem key={r.id} value={r.id}>{r.first_name} {r.last_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose} disabled={uploading}>Cancel</Button>
            <Button type="submit" className="flex-1 bg-amber-600 hover:bg-amber-700 text-white gap-2" disabled={uploading || !file}>
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {uploading ? 'Uploading…' : 'Upload Document'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}