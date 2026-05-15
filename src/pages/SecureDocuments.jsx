import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Upload, Folder, File, Search, Trash2, Eye, Printer, Plus, X, ChevronRight, Lock, Download, Users, Building2, DollarSign, Shield, Scale, ClipboardList, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import UploadDocumentModal from '@/components/documents/UploadDocumentModal';
import DocumentViewer from '@/components/documents/DocumentViewer';

const FOLDERS = [
  { id: 'all', label: 'All Documents', icon: File, color: 'text-slate-500' },
  { id: 'resident_records', label: 'Resident Records', icon: Users, color: 'text-blue-500' },
  { id: 'intake', label: 'Intake Forms', icon: ClipboardList, color: 'text-teal-500' },
  { id: 'management', label: 'Management', icon: Building2, color: 'text-amber-500' },
  { id: 'hr', label: 'HR & Staff', icon: Users, color: 'text-purple-500' },
  { id: 'financial', label: 'Financial', icon: DollarSign, color: 'text-green-500' },
  { id: 'compliance', label: 'Compliance', icon: Shield, color: 'text-red-500' },
  { id: 'legal', label: 'Legal', icon: Scale, color: 'text-indigo-500' },
  { id: 'other', label: 'Other', icon: Folder, color: 'text-slate-400' },
];

const ACCESS_LABELS = {
  admin_only: { label: 'Admin Only', color: 'bg-red-100 text-red-700' },
  staff_and_admin: { label: 'Staff & Admin', color: 'bg-amber-100 text-amber-700' },
  all_staff: { label: 'All Staff', color: 'bg-green-100 text-green-700' },
};

function formatSize(kb) {
  if (!kb) return '';
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

function formatDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function SecureDocuments() {
  const [user, setUser] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [residents, setResidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFolder, setActiveFolder] = useState('all');
  const [search, setSearch] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const [viewingDoc, setViewingDoc] = useState(null);

  const isAdmin = user?.role === 'admin' || user?.role === 'owner' || user?.role === 'platform_admin';
  const canUpload = isAdmin || ['director', 'house_manager', 'case_manager', 'staff'].includes(user?.role);

  useEffect(() => { init(); }, []);

  const init = async () => {
    try {
      const [u, docs, res] = await Promise.all([
        base44.auth.me(),
        base44.entities.SecureDocument.list('-created_date', 200),
        base44.entities.Resident.list('first_name', 200),
      ]);
      setUser(u);
      setDocuments(docs);
      setResidents(res);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleDelete = async (doc) => {
    if (!window.confirm(`Delete "${doc.title}"? This cannot be undone.`)) return;
    await base44.entities.SecureDocument.delete(doc.id);
    setDocuments(prev => prev.filter(d => d.id !== doc.id));
  };

  const handlePrint = (doc) => {
    const w = window.open(doc.file_url, '_blank');
    if (w) { w.focus(); setTimeout(() => w.print(), 800); }
  };

  const filtered = documents.filter(d => {
    const folderMatch = activeFolder === 'all' || d.folder === activeFolder;
    const searchMatch = !search || d.title?.toLowerCase().includes(search.toLowerCase()) ||
      d.resident_name?.toLowerCase().includes(search.toLowerCase()) ||
      d.description?.toLowerCase().includes(search.toLowerCase());
    return folderMatch && searchMatch;
  });

  // Count per folder
  const folderCounts = {};
  documents.forEach(d => { folderCounts[d.folder] = (folderCounts[d.folder] || 0) + 1; });

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="flex h-full" style={{ height: 'calc(100vh - 56px)' }}>
      {/* Sidebar */}
      <div className="w-56 flex-shrink-0 bg-white border-r flex flex-col">
        <div className="p-4 border-b">
          <div className="flex items-center gap-2 mb-1">
            <Lock className="w-4 h-4 text-amber-600" />
            <h2 className="font-bold text-sm text-slate-800">Secure Files</h2>
          </div>
          <p className="text-xs text-slate-500">HIPAA-compliant document storage</p>
        </div>

        <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {FOLDERS.map(folder => {
            const Icon = folder.icon;
            const count = folder.id === 'all' ? documents.length : (folderCounts[folder.id] || 0);
            return (
              <button
                key={folder.id}
                onClick={() => setActiveFolder(folder.id)}
                className={cn(
                  'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors text-left',
                  activeFolder === folder.id
                    ? 'bg-amber-50 text-amber-800 font-medium'
                    : 'text-slate-600 hover:bg-slate-50'
                )}
              >
                <Icon className={cn('w-4 h-4 flex-shrink-0', activeFolder === folder.id ? 'text-amber-600' : folder.color)} />
                <span className="flex-1 truncate">{folder.label}</span>
                {count > 0 && (
                  <span className={cn('text-xs font-medium rounded-full px-1.5',
                    activeFolder === folder.id ? 'bg-amber-200 text-amber-800' : 'bg-slate-100 text-slate-500'
                  )}>{count}</span>
                )}
              </button>
            );
          })}
        </nav>

        {canUpload && (
          <div className="p-3 border-t">
            <Button onClick={() => setShowUpload(true)} className="w-full bg-amber-600 hover:bg-amber-700 text-white text-xs gap-1.5">
              <Plus className="w-3.5 h-3.5" /> Upload Document
            </Button>
          </div>
        )}
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-50">
        {/* Header */}
        <div className="bg-white border-b px-6 py-4 flex items-center gap-3 flex-shrink-0">
          <div className="flex-1">
            <h1 className="font-bold text-slate-900">
              {FOLDERS.find(f => f.id === activeFolder)?.label || 'Documents'}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">{filtered.length} document{filtered.length !== 1 ? 's' : ''}</p>
          </div>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search documents…" className="pl-9 text-sm" />
          </div>
        </div>

        {/* Document grid */}
        <div className="flex-1 overflow-y-auto p-6">
          {filtered.length === 0 ? (
            <div className="text-center py-20 text-slate-400">
              <Folder className="w-12 h-12 mx-auto mb-3 text-slate-300" />
              <p className="font-medium">No documents found</p>
              {canUpload && <p className="text-sm mt-1">Upload a file to get started.</p>}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map(doc => {
                const access = ACCESS_LABELS[doc.access_level] || ACCESS_LABELS.staff_and_admin;
                const isImage = doc.file_type?.startsWith('image/');
                const isPDF = doc.file_type === 'application/pdf' || doc.file_name?.endsWith('.pdf');
                return (
                  <div key={doc.id} className="bg-white rounded-xl border shadow-sm hover:shadow-md transition-shadow p-4 flex flex-col gap-3">
                    {/* Top */}
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        'w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0',
                        isPDF ? 'bg-red-100' : isImage ? 'bg-blue-100' : 'bg-slate-100'
                      )}>
                        <File className={cn('w-5 h-5', isPDF ? 'text-red-500' : isImage ? 'text-blue-500' : 'text-slate-500')} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-slate-800 truncate">{doc.title}</p>
                        {doc.file_name && <p className="text-xs text-slate-400 truncate">{doc.file_name}</p>}
                      </div>
                    </div>

                    {/* Meta */}
                    <div className="space-y-1 text-xs text-slate-500">
                      {doc.resident_name && (
                        <div className="flex items-center gap-1.5">
                          <Users className="w-3 h-3" />
                          <span>{doc.resident_name}</span>
                        </div>
                      )}
                      {doc.description && <p className="text-slate-400 line-clamp-1">{doc.description}</p>}
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-slate-400">{formatDate(doc.created_date)} · {formatSize(doc.file_size_kb)}</span>
                        <Badge className={cn('border-0 text-xs', access.color)}>{access.label}</Badge>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-1 border-t">
                      <Button
                        variant="ghost" size="sm"
                        className="flex-1 text-xs gap-1.5 text-slate-600"
                        onClick={() => setViewingDoc(doc)}
                      >
                        <Eye className="w-3.5 h-3.5" /> View
                      </Button>
                      <Button
                        variant="ghost" size="sm"
                        className="flex-1 text-xs gap-1.5 text-slate-600"
                        onClick={() => handlePrint(doc)}
                      >
                        <Printer className="w-3.5 h-3.5" /> Print
                      </Button>
                      <a href={doc.file_url} target="_blank" rel="noreferrer" download>
                        <Button variant="ghost" size="sm" className="text-xs gap-1.5 text-slate-600">
                          <Download className="w-3.5 h-3.5" />
                        </Button>
                      </a>
                      {isAdmin && (
                        <Button
                          variant="ghost" size="sm"
                          className="text-xs text-red-400 hover:text-red-600 hover:bg-red-50"
                          onClick={() => handleDelete(doc)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Upload modal */}
      {showUpload && (
        <UploadDocumentModal
          residents={residents}
          user={user}
          onClose={() => setShowUpload(false)}
          onUploaded={(doc) => {
            setDocuments(prev => [doc, ...prev]);
            setShowUpload(false);
          }}
        />
      )}

      {/* Viewer */}
      {viewingDoc && (
        <DocumentViewer doc={viewingDoc} onClose={() => setViewingDoc(null)} onPrint={handlePrint} />
      )}
    </div>
  );
}