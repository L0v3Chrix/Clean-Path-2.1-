import { useState } from 'react';
import { MailCheck, Send } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { appClient } from '@/services/appClient';

export default function ResidentInviteDialog({ resident, open, onOpenChange, onInvited }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const handleOpenChange = (nextOpen) => {
    if (isSubmitting) return;
    if (!nextOpen) {
      setError('');
      setSent(false);
    }
    onOpenChange(nextOpen);
  };

  const handleInvite = async () => {
    setError('');
    setIsSubmitting(true);
    try {
      const result = await appClient.residentAccess.invite({
        resident_id: resident.id,
      });
      setSent(true);
      await onInvited?.(result);
    } catch (inviteError) {
      setError(inviteError.message || 'Unable to invite resident.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md rounded-lg">
        <DialogHeader>
          <DialogTitle>{sent ? 'Invitation sent' : 'Invite resident account'}</DialogTitle>
          <DialogDescription>
            {sent
              ? `${resident.first_name} can use the secure invitation sent to ${resident.email}.`
              : `Send a single-user ClearPath invitation to ${resident.email}.`}
          </DialogDescription>
        </DialogHeader>

        {sent ? (
          <div className="flex items-start gap-3 rounded-md border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
            <MailCheck className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            <p className="text-sm">Access is restricted to this resident profile and becomes usable through the emailed invitation.</p>
          </div>
        ) : (
          <p className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
            Confirm that the email on the resident profile belongs to the intended account user before sending.
          </p>
        )}

        {error && (
          <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <DialogFooter>
          {sent ? (
            <Button onClick={() => handleOpenChange(false)}>Done</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button onClick={handleInvite} disabled={isSubmitting}>
                <Send className="h-4 w-4" />
                {isSubmitting ? 'Sending...' : 'Send invitation'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
