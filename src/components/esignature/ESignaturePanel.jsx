import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { FilePen, Clock, CheckCircle2, XCircle, Eye, ExternalLink, X, Pen, RotateCcw, Loader2, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';

const statusConfig = {
  pending: { label: 'Awaiting Signature', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  viewed: { label: 'Viewed', color: 'bg-blue-100 text-blue-700', icon: Eye },
  signed: { label: 'Signed', color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  declined: { label: 'Declined', color: 'bg-red-100 text-red-700', icon: XCircle },
};

function SignModal({ request, onClose, onComplete }) {
  const canvasRef = useRef(null);
  const [drawing, setDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [name, setName] = useState('');
  const [step, setStep] = useState('review'); // 'review' | 'sign'
  const [submitting, setSubmitting] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [declineReason, setDeclineReason] = useState('');

  useEffect(() => {
    if (request.status === 'pending') {
      base44.entities.SignatureRequest.update(request.id, { status: 'viewed', viewed_at: new Date().toISOString() });
    }
  }, []);

  const startDraw = (e) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const x = (e.touches?.[0]?.clientX ?? e.clientX) - rect.left;
    const y = (e.touches?.[0]?.clientY ?? e.clientY) - rect.top;
    ctx.beginPath();
    ctx.moveTo(x, y);
    setDrawing(true);
  };

  const draw = (e) => {
    if (!drawing) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const x = (e.touches?.[0]?.clientX ?? e.clientX) - rect.left;
    const y = (e.touches?.[0]?.clientY ?? e.clientY) - rect.top;
    ctx.lineTo(x, y);
    ctx.strokeStyle = '#1C1917';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.stroke();
    setHasSignature(true);
  };

  const endDraw = () => setDrawing(false);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  const handleSign = async () => {
    if (!hasSignature || !name.trim()) return;
    setSubmitting(true);
    const signatureData = canvasRef.current.toDataURL('image/png');
    await base44.entities.SignatureRequest.update(request.id, {
      status: 'signed',
      signed_at: new Date().toISOString(),
      signature_data: signatureData,
      signature_name: name.trim(),
    });
    setSubmitting(false);
    onComplete();
  };

  const handleDecline = async () => {
    if (!declineReason.trim()) return;
    setSubmitting(true);
    await base44.entities.SignatureRequest.update(request.id, {
      status: 'declined',
      decline_reason: declineReason,
    });
    setSubmitting(false);
    onComplete();
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="font-bold text-slate-900 flex items-center gap-2">
            <FilePen className="w-5 h-5 text-amber-600" />
            {request.title}
          </h2>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
        </div>

        {step === 'review' && (
          <div className="p-5 space-y-4">
            {request.description && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
                {request.description}
              </div>
            )}

            <div className="border rounded-xl overflow-hidden">
              <div className="bg-slate-50 px-4 py-2 border-b flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700">{request.file_name || 'Document'}</span>
                <a href={request.file_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-teal-600 hover:underline">
                  <ExternalLink className="w-3 h-3" /> Open
                </a>
              </div>
              {request.file_url?.match(/\.(png|jpg|jpeg)$/i) ? (
                <img src={request.file_url} alt="Document" className="w-full" />
              ) : (
                <iframe src={request.file_url} title="Document" className="w-full h-80" />
              )}
            </div>

            {request.due_date && (
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <AlertCircle className="w-4 h-4 text-yellow-500" />
                Signature required by <strong>{request.due_date}</strong>
              </div>
            )}

            <div className="flex gap-3">
              <Button className="flex-1 bg-amber-600 hover:bg-amber-700 text-white gap-2" onClick={() => setStep('sign')}>
                <Pen className="w-4 h-4" /> Proceed to Sign
              </Button>
              <Button variant="outline" className="flex-1 text-red-600 border-red-200 hover:bg-red-50" onClick={() => setStep('decline')}>
                Decline
              </Button>
            </div>
          </div>
        )}

        {step === 'sign' && (
          <div className="p-5 space-y-4">
            <p className="text-sm text-slate-600">Draw your signature below and type your full name to confirm.</p>

            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-slate-500">DRAW SIGNATURE</span>
                <button onClick={clearCanvas} className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600">
                  <RotateCcw className="w-3 h-3" /> Clear
                </button>
              </div>
              <canvas
                ref={canvasRef}
                width={440}
                height={140}
                className="w-full border-2 border-slate-200 rounded-xl bg-slate-50 touch-none cursor-crosshair"
                style={{ borderStyle: hasSignature ? 'solid' : 'dashed' }}
                onMouseDown={startDraw}
                onMouseMove={draw}
                onMouseUp={endDraw}
                onMouseLeave={endDraw}
                onTouchStart={startDraw}
                onTouchMove={draw}
                onTouchEnd={endDraw}
              />
              {!hasSignature && (
                <p className="text-xs text-center text-slate-400 mt-1">Sign here with your mouse or finger</p>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-500">TYPE YOUR FULL LEGAL NAME</label>
              <Input
                placeholder="Full name"
                value={name}
                onChange={e => setName(e.target.value)}
                className="text-sm"
              />
            </div>

            <div className="bg-slate-50 rounded-xl p-3 text-xs text-slate-500 border">
              By signing, I confirm I have read and agree to the terms of <strong>{request.title}</strong>.
              This constitutes a legally binding electronic signature.
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep('review')} className="flex-1">← Back</Button>
              <Button
                className="flex-1 bg-green-600 hover:bg-green-700 text-white gap-2"
                disabled={!hasSignature || !name.trim() || submitting}
                onClick={handleSign}
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                {submitting ? 'Submitting...' : 'Sign Document'}
              </Button>
            </div>
          </div>
        )}

        {step === 'decline' && (
          <div className="p-5 space-y-4">
            <p className="text-sm text-slate-600">Please provide a reason for declining this document.</p>
            <textarea
              className="w-full border border-slate-200 rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-400"
              rows={4}
              placeholder="Reason for declining..."
              value={declineReason}
              onChange={e => setDeclineReason(e.target.value)}
            />
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep('review')} className="flex-1">← Back</Button>
              <Button
                className="flex-1 bg-red-600 hover:bg-red-700 text-white gap-2"
                disabled={!declineReason.trim() || submitting}
                onClick={handleDecline}
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                Submit Decline
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ESignaturePanel({ resident }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  const load = async () => {
    setLoading(true);
    const data = await base44.entities.SignatureRequest.filter({ resident_id: resident.id });
    setRequests(data.sort((a, b) => new Date(b.created_date) - new Date(a.created_date)));
    setLoading(false);
  };

  useEffect(() => { load(); }, [resident?.id]);

  const pending = requests.filter(r => r.status === 'pending' || r.status === 'viewed');

  if (loading) return <div className="py-6 text-center text-slate-400 text-sm">Loading...</div>;

  if (requests.length === 0) return null;

  return (
    <div className="space-y-3">
      {pending.length > 0 && (
        <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="w-4 h-4 text-amber-600" />
            <span className="text-sm font-semibold text-amber-800">
              {pending.length} document{pending.length > 1 ? 's' : ''} awaiting your signature
            </span>
          </div>
          <div className="space-y-2">
            {pending.map(req => (
              <div key={req.id} className="bg-white rounded-lg p-3 border border-amber-200 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-800">{req.title}</p>
                  <p className="text-xs text-slate-500">From: {req.sent_by_name} · {format(new Date(req.created_date), 'MMM d')}</p>
                  {req.due_date && <p className="text-xs text-red-500">Due: {req.due_date}</p>}
                </div>
                <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white gap-1 flex-shrink-0"
                  onClick={() => setSelected(req)}>
                  <Pen className="w-3.5 h-3.5" /> Review & Sign
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {requests.some(r => r.status === 'signed' || r.status === 'declined') && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Completed</p>
          {requests.filter(r => r.status === 'signed' || r.status === 'declined').map(req => {
            const cfg = statusConfig[req.status];
            const StatusIcon = cfg.icon;
            return (
              <div key={req.id} className="border rounded-xl p-3 bg-white flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-700">{req.title}</p>
                  <Badge className={`${cfg.color} border-0 text-xs mt-1 flex items-center gap-1 w-fit`}>
                    <StatusIcon className="w-3 h-3" /> {cfg.label}
                    {req.signed_at && ` · ${format(new Date(req.signed_at), 'MMM d, yyyy')}`}
                  </Badge>
                </div>
                <a href={req.file_url} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-teal-600 hover:underline flex items-center gap-1">
                  <ExternalLink className="w-3 h-3" /> View
                </a>
              </div>
            );
          })}
        </div>
      )}

      {selected && (
        <SignModal
          request={selected}
          onClose={() => setSelected(null)}
          onComplete={() => { setSelected(null); load(); }}
        />
      )}
    </div>
  );
}