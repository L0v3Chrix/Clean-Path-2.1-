import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link2, Copy, Check, ExternalLink, Code, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function IntakeLinkGenerator() {
  const [org, setOrg] = useState(null);
  const [copied, setCopied] = useState('');

  useEffect(() => {
    base44.entities.Organization.list().then(orgs => {
      if (orgs[0]) setOrg(orgs[0]);
    }).catch(() => {});
  }, []);

  if (!org) return null;

  const baseUrl = window.location.origin;
  const appLink = `${baseUrl}/intake?org=${org.id}`;
  const embedSnippet = `<!-- ClearPath Application Form -->
<a href="${appLink}" target="_blank" 
   style="display:inline-block;background:#B45309;color:#fff;
          padding:12px 28px;border-radius:8px;font-weight:600;
          font-size:15px;text-decoration:none;">
  Apply for Housing →
</a>`;

  const copyTo = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(''), 2000);
  };

  const CopyBtn = ({ text, id, label }) => (
    <button
      onClick={() => copyTo(text, id)}
      className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors"
      style={copied === id
        ? { background: '#ECFDF5', borderColor: '#6EE7B7', color: '#065F46' }
        : { background: '#fff', borderColor: '#E0D5C5', color: '#78716C' }}
    >
      {copied === id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
      {copied === id ? 'Copied!' : label}
    </button>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-teal-100 flex items-center justify-center">
          <Link2 className="w-5 h-5 text-teal-700" />
        </div>
        <div>
          <h2 className="font-bold text-slate-900">Application Link for Your Website</h2>
          <p className="text-sm text-slate-500">Share or embed your unique intake form link anywhere.</p>
        </div>
      </div>

      {/* Direct Link */}
      <div className="rounded-xl border border-slate-200 p-4 space-y-3 bg-slate-50">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <Globe className="w-4 h-4 text-slate-500" />
          Direct Application Link
        </div>
        <p className="text-xs text-slate-500">
          Paste this link in your website, social media, email signatures, or anywhere residents might find it.
          It automatically identifies your organization.
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex-1 min-w-0 bg-white border border-slate-200 rounded-lg px-3 py-2 font-mono text-xs text-slate-700 truncate">
            {appLink}
          </div>
          <CopyBtn text={appLink} id="link" label="Copy Link" />
          <a href={appLink} target="_blank" rel="noopener noreferrer">
            <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8">
              <ExternalLink className="w-3.5 h-3.5" /> Preview
            </Button>
          </a>
        </div>
      </div>

      {/* Embed Button Snippet */}
      <div className="rounded-xl border border-slate-200 p-4 space-y-3 bg-slate-50">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <Code className="w-4 h-4 text-slate-500" />
          HTML Button Snippet
        </div>
        <p className="text-xs text-slate-500">
          Copy and paste this HTML into your website to add an "Apply for Housing" button that links directly to your intake form.
        </p>
        <pre className="bg-white border border-slate-200 rounded-lg p-3 text-xs text-slate-700 overflow-x-auto whitespace-pre-wrap leading-relaxed">
          {embedSnippet}
        </pre>
        <CopyBtn text={embedSnippet} id="embed" label="Copy HTML Snippet" />
      </div>

      {/* Instructions */}
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800 space-y-1.5">
        <p className="font-semibold">How to use this link:</p>
        <ul className="space-y-1 pl-1">
          <li>• Add it to your <strong>website's navigation</strong> or a "Get Help" page</li>
          <li>• Include it in <strong>email campaigns</strong> or outreach materials</li>
          <li>• Share it on <strong>Facebook, Instagram, or other social media</strong></li>
          <li>• Print it as a <strong>QR code</strong> and post it at your facility</li>
          <li>• Embed the HTML button directly in your website's homepage</li>
        </ul>
        <p className="mt-2 text-amber-700">All submissions are automatically routed to <strong>{org.name}</strong> and staff are notified immediately.</p>
      </div>
    </div>
  );
}