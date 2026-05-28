import { useEffect, useState } from 'react';
import { X, Printer, Download, ExternalLink, File } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { appClient } from '@/services/appClient';

export default function DocumentViewer({ doc, onClose, onPrint }) {
  const [signedUrl, setSignedUrl] = useState('');
  const [urlError, setUrlError] = useState('');
  const isPDF = doc.file_type === 'application/pdf' || doc.file_name?.endsWith('.pdf');
  const isImage = doc.file_type?.startsWith('image/');

  useEffect(() => {
    let cancelled = false;

    async function loadSignedUrl() {
      try {
        setUrlError('');
        const url = await appClient.integrations.Core.CreateSignedUrl(doc, 600);
        if (!cancelled) setSignedUrl(url);
      } catch (error) {
        if (!cancelled) {
          setSignedUrl('');
          setUrlError(error.message || 'Unable to open this secure document.');
        }
      }
    }

    loadSignedUrl();
    return () => { cancelled = true; };
  }, [doc]);

  const openUrl = signedUrl || doc.file_url;

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex flex-col">
      {/* Toolbar */}
      <div className="bg-slate-900 text-white px-5 py-3 flex items-center gap-3 flex-shrink-0">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate">{doc.title}</p>
          {doc.file_name && <p className="text-xs text-slate-400">{doc.file_name}</p>}
        </div>
        <Button variant="ghost" size="sm" className="text-white hover:bg-slate-700 gap-1.5" onClick={() => onPrint(doc)} disabled={!openUrl}>
          <Printer className="w-4 h-4" /> Print
        </Button>
        <a href={openUrl || undefined} download target="_blank" rel="noreferrer">
          <Button variant="ghost" size="sm" className="text-white hover:bg-slate-700 gap-1.5">
            <Download className="w-4 h-4" /> Download
          </Button>
        </a>
        <a href={openUrl || undefined} target="_blank" rel="noreferrer">
          <Button variant="ghost" size="sm" className="text-white hover:bg-slate-700 gap-1.5">
            <ExternalLink className="w-4 h-4" /> Open
          </Button>
        </a>
        <button onClick={onClose} className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-white">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto bg-slate-800 flex items-center justify-center">
        {urlError ? (
          <div className="text-center text-white p-12">
            <File className="w-16 h-16 mx-auto mb-4 text-slate-400" />
            <p className="text-lg font-semibold mb-2">Document unavailable</p>
            <p className="text-slate-400 text-sm">{urlError}</p>
          </div>
        ) : !openUrl ? (
          <div className="text-center text-white p-12">
            <div className="w-8 h-8 border-4 border-slate-500 border-t-white rounded-full animate-spin mx-auto mb-4" />
            <p className="text-slate-300 text-sm">Preparing secure preview...</p>
          </div>
        ) : isPDF ? (
          <iframe
            src={openUrl}
            title={doc.title}
            className="w-full h-full"
            style={{ border: 'none' }}
          />
        ) : isImage ? (
          <img src={openUrl} alt={doc.title} className="max-w-full max-h-full object-contain p-4" />
        ) : (
          <div className="text-center text-white p-12">
            <File className="w-16 h-16 mx-auto mb-4 text-slate-400" />
            <p className="text-lg font-semibold mb-2">{doc.title}</p>
            <p className="text-slate-400 text-sm mb-6">This file type cannot be previewed in the browser.</p>
            <a href={openUrl} download target="_blank" rel="noreferrer">
              <Button className="bg-amber-600 hover:bg-amber-700 gap-2">
                <Download className="w-4 h-4" /> Download to View
              </Button>
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
