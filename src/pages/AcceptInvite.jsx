import { useEffect, useState } from 'react';
import { ArrowRight, Eye, EyeOff, KeyRound, ShieldCheck, UserCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/lib/AuthContext';
import {
  clearStoredAccountClaim,
  clearStoredInvitationActivation,
  getAccountCompletionMode,
  getEmailLinkSessionFromUrl,
  getRecoverableAccountClaim,
  getRecoverableInvitationActivation,
  getSanitizedInvitationPath,
  isPermanentAccountClaimError,
  validateInvitationPassword,
} from '@/lib/inviteAcceptance';
import { defaultRouteForRole } from '@/lib/routeAccess';
import { appClient } from '@/services/appClient';

export default function AcceptInvite() {
  const navigate = useNavigate();
  const { isLoadingAuth } = useAuth();
  const [completionMode] = useState(() => getAccountCompletionMode(window.location.href));
  const [claimToken] = useState(() => getRecoverableAccountClaim(window.location.href));
  const [activationToken] = useState(() => getRecoverableInvitationActivation(window.location.href));
  const [emailLinkSession] = useState(() => getEmailLinkSessionFromUrl(window.location.href));
  const [linkUser, setLinkUser] = useState(null);
  const [linkStatus, setLinkStatus] = useState('checking');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const isRecovery = completionMode === 'recovery';

  useEffect(() => {
    window.history.replaceState({}, document.title, getSanitizedInvitationPath(window.location.href));
    let active = true;
    const hasOneInvitationCredential = Boolean(claimToken) !== Boolean(activationToken);
    const hasExpectedLinkType = isRecovery
      ? emailLinkSession?.type === 'recovery'
      : emailLinkSession?.type === 'invite';
    const hasExpectedCredential = isRecovery
      ? !claimToken && !activationToken
      : hasOneInvitationCredential;
    if (!emailLinkSession || !hasExpectedLinkType || !hasExpectedCredential) {
      clearStoredAccountClaim();
      clearStoredInvitationActivation();
      setLinkStatus('invalid');
      return undefined;
    }

    appClient.auth.establishEmailLinkSession(emailLinkSession)
      .then((emailLinkUser) => {
        if (!active) return;
        setLinkUser(emailLinkUser);
        setLinkStatus('ready');
      })
      .catch(() => {
        if (!active) return;
        clearStoredAccountClaim();
        clearStoredInvitationActivation();
        setLinkStatus('invalid');
      });

    return () => { active = false; };
  }, [activationToken, claimToken, emailLinkSession, isRecovery]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    const validationError = validateInvitationPassword(password, confirmation);
    if (validationError) {
      setError(validationError);
      return;
    }
    if (linkStatus !== 'ready' || !linkUser) {
      setError('This invitation is invalid or has expired. Ask an administrator for a new invitation.');
      return;
    }
    if (claimToken && !displayName.trim()) {
      setError('Enter your name to finish setting up the account.');
      return;
    }

    setIsSubmitting(true);
    try {
      await appClient.auth.completeInvite(password);
      if (claimToken) {
        await appClient.accountClaims.claim({
          token: claimToken,
          displayName: displayName.trim(),
        });
        clearStoredAccountClaim();
      } else if (!isRecovery) {
        await appClient.auth.acceptInvitation(activationToken);
        clearStoredInvitationActivation();
      }
      const profile = await appClient.auth.me();
      navigate(defaultRouteForRole(profile.role), { replace: true });
    } catch (submitError) {
      if (claimToken && isPermanentAccountClaimError(submitError)) {
        clearStoredAccountClaim();
      }
      setError(submitError.message || 'Unable to accept this invitation.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#FAF6F3] px-5 py-10 text-[#2A1D15]">
      <section className="w-full max-w-md rounded-lg border border-[#E8D5C6] bg-[#FFF8EA] p-6 shadow-[0_24px_70px_rgba(42,29,21,0.16)] sm:p-8">
        <div className="mb-7 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-md bg-[#2A1D15] text-[#FFF8EA]">
            <UserCheck className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-lg font-semibold">
              {isRecovery ? 'Reset your ClearPath password' : 'Accept your ClearPath invitation'}
            </p>
            <p className="text-sm text-[#6F5746]">
              {isRecovery
                ? 'Choose a new password for your existing account.'
                : 'Create the password for your assigned account.'}
            </p>
          </div>
        </div>

        {isLoadingAuth || linkStatus === 'checking' ? (
          <div className="flex min-h-40 items-center justify-center" role="status">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#E8D5C6] border-t-[#F26D2B]" />
            <span className="sr-only">Checking invitation</span>
          </div>
        ) : linkStatus !== 'ready' || !linkUser ? (
          <div className="space-y-5">
            <p role="alert" className="rounded-md border border-[#F1B69D] bg-[#FFF1E7] px-3 py-3 text-sm font-medium text-[#8C2F0A]">
              {isRecovery
                ? 'This password reset link is invalid or has expired. Request a new recovery email.'
                : 'This invitation is invalid or has expired. Ask an administrator for a new invitation.'}
            </p>
            <Button className="h-11 w-full" onClick={() => navigate('/login', { replace: true })}>
              Go to sign in
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <form className="space-y-5" onSubmit={handleSubmit}>
            {claimToken && (
              <div className="space-y-2">
                <Label htmlFor="invite-name">Name</Label>
                <Input
                  id="invite-name"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  autoComplete="name"
                  required
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="invite-password">Password</Label>
              <div className="relative">
                <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9B7355]" />
                <Input
                  id="invite-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                  required
                  className="pl-10 pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  className="cp-focus-ring absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-[#6F5746] hover:bg-[#FAF6F3]"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="invite-confirmation">Confirm password</Label>
              <Input
                id="invite-confirmation"
                type={showPassword ? 'text' : 'password'}
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
              />
            </div>

            {error && (
              <p role="alert" className="rounded-md border border-[#F1B69D] bg-[#FFF1E7] px-3 py-2 text-sm font-medium text-[#8C2F0A]">
                {error}
              </p>
            )}

            <Button type="submit" className="h-11 w-full" disabled={isSubmitting}>
              {isSubmitting
                ? (isRecovery ? 'Saving password...' : 'Finishing setup...')
                : (isRecovery ? 'Save new password' : 'Finish account setup')}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </form>
        )}

        <div className="mt-6 flex gap-3 border-t border-[#E8D5C6] pt-5 text-sm text-[#5F4A3D]">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#3A5638]" aria-hidden="true" />
          <p>Your permissions are assigned by your organization and cannot be changed from this screen.</p>
        </div>
      </section>
    </main>
  );
}
