import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Eye,
  EyeOff,
  KeyRound,
  LogIn,
  Mail,
  Moon,
  ShieldCheck,
  Sun,
  UserPlus,
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { appClient } from '@/services/appClient';
import { authBypassEnabled } from '@/lib/authBypass';
import { authSetupMessage, isMissingSupabaseSetupError } from '@/lib/authErrors';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  CLEARPATH_LOGIN_COPY,
  CLEARPATH_LOGIN_MODES,
  getLoginMode,
} from '@/lib/loginVisualSystem';

function getInitialThemePreference() {
  if (typeof window === 'undefined') return 'light';

  const storedPreference = window.localStorage.getItem('clearpath-login-theme');
  if (storedPreference === 'light' || storedPreference === 'dark') {
    return storedPreference;
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export default function Login() {
  const [mode, setMode] = useState('sign-in');
  const [themePreference, setThemePreference] = useState(getInitialThemePreference);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const isSignUp = mode === 'sign-up';
  const activeLoginMode = useMemo(() => getLoginMode(themePreference), [themePreference]);
  const isDarkLogin = activeLoginMode.id === 'dark';

  useEffect(() => {
    window.localStorage.setItem('clearpath-login-theme', themePreference);
  }, [themePreference]);

  const toggleThemePreference = () => {
    setThemePreference((currentPreference) => (currentPreference === 'dark' ? 'light' : 'dark'));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setStatus('');
    setIsSubmitting(true);

    if (authBypassEnabled) {
      window.location.assign('/');
      return;
    }

    try {
      const authResult = isSignUp
        ? await supabase.auth.signUp({
            email,
            password,
            options: {
              data: {
                full_name: fullName,
              },
            },
          })
        : await supabase.auth.signInWithPassword({ email, password });

      if (authResult.error) throw authResult.error;

      if (!authResult.data.session) {
        setStatus('Check your email to confirm the account, then sign in.');
        return;
      }

      try {
        await appClient.auth.bootstrapOrganizationOwner(fullName || email);
      } catch (setupError) {
        if (isMissingSupabaseSetupError(setupError)) {
          setStatus(authSetupMessage(setupError));
          window.setTimeout(() => window.location.assign('/'), 1500);
          return;
        }
        throw setupError;
      }

      window.location.assign('/');
    } catch (submitError) {
      if (isSignUp || !isMissingSupabaseSetupError(submitError)) {
        await supabase.auth.signOut();
      }
      setError(authSetupMessage(submitError));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePasswordReset = async () => {
    setError('');
    setStatus('');

    if (authBypassEnabled) {
      setStatus('Demo mode: any email and password will sign you in.');
      return;
    }

    if (!email) {
      setError('Enter your email address first, then request a password reset.');
      return;
    }

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login`,
    });

    if (resetError) {
      setError(authSetupMessage(resetError));
      return;
    }

    setStatus('Password reset instructions are on the way if this email has access.');
  };

  return (
    <div
      className={`min-h-screen overflow-hidden ${
        isDarkLogin ? 'bg-[#2A1D15] text-[#FFF8EA]' : 'bg-[#FAF6F3] text-[#2A1D15]'
      }`}
    >
      <div className="grid min-h-screen lg:grid-cols-[minmax(420px,34vw)_1fr]">
        <section
          className={`relative z-10 flex min-h-screen items-center px-5 py-8 sm:px-8 lg:px-10 ${
            isDarkLogin
              ? 'bg-[#2A1D15]'
              : 'bg-[linear-gradient(145deg,#FAF6F3_0%,#FFF8EA_54%,#F5EEE7_100%)]'
          }`}
          aria-label="ClearPath sign in"
        >
          <div className="pointer-events-none absolute inset-0 opacity-[0.18] [background-image:radial-gradient(#9B7355_0.8px,transparent_0.8px)] [background-size:18px_18px]" />
          <div
            className={`relative mx-auto w-full max-w-[430px] rounded-lg border p-6 shadow-[0_28px_80px_rgba(42,29,21,0.18)] sm:p-8 ${
              isDarkLogin
                ? 'border-[#E8D5C6]/70 bg-[#FFF8EA] text-[#2A1D15]'
                : 'border-[#E8D5C6] bg-[#FFF8EA]/88 text-[#2A1D15] backdrop-blur-xl'
            }`}
          >
            <div className="pointer-events-none absolute -right-12 top-14 h-28 w-28 rounded-full border border-[#E8D5C6]" />
            <div className="pointer-events-none absolute -right-8 top-20 h-16 w-16 rounded-full border border-[#5D8A5D]/35" />

            <div className="relative mb-9 flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="relative flex h-12 w-12 items-center justify-center rounded-lg bg-[#2A1D15] text-[#FFF8EA] shadow-[0_12px_24px_rgba(42,29,21,0.22)]">
                  <div className="absolute h-7 w-7 rounded-full border border-[#FFB388]/80" />
                  <div className="absolute h-4 w-4 rounded-full border border-[#5D8A5D]" />
                  <ArrowRight className="relative h-4 w-4 text-[#F26D2B]" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-xl font-semibold tracking-[0.01em] text-[#2A1D15]">ClearPath</p>
                  <p className="text-sm font-medium text-[#6F5746]">Recovery operations workspace</p>
                </div>
              </div>

              <button
                type="button"
                onClick={toggleThemePreference}
                className="cp-focus-ring inline-flex h-10 w-10 items-center justify-center rounded-md border border-[#E8D5C6] bg-[#FAF6F3] text-[#3A5638] shadow-sm transition hover:-translate-y-0.5 hover:border-[#F26D2B]/60 hover:bg-white"
                aria-label={`Switch to ${isDarkLogin ? CLEARPATH_LOGIN_MODES.light.label : CLEARPATH_LOGIN_MODES.dark.label}`}
              >
                {isDarkLogin ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
            </div>

            <div className="relative mb-7">
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-[#9B7355]">
                Secure operator access
              </p>
              <h1 className="font-serif text-[clamp(2.35rem,4vw,3.55rem)] font-semibold leading-[0.98] tracking-normal text-[#2A1D15]">
                {CLEARPATH_LOGIN_COPY.headline}
              </h1>
              <p className="mt-4 text-base font-medium leading-7 text-[#5F4A3D]">
                {CLEARPATH_LOGIN_COPY.supportingLine}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="relative space-y-5">
              <div className="grid grid-cols-2 gap-2 rounded-lg border border-[#E8D5C6] bg-[#FAF6F3] p-1">
                <Button
                  type="button"
                  variant="ghost"
                  className={`cp-focus-ring h-10 rounded-md text-sm ${
                    !isSignUp
                      ? 'bg-[#2A1D15] text-[#FFF8EA] shadow hover:bg-[#2A1D15] hover:text-[#FFF8EA]'
                      : 'text-[#5F4A3D] hover:bg-[#FFF8EA] hover:text-[#2A1D15]'
                  }`}
                  onClick={() => setMode('sign-in')}
                >
                  <LogIn className="h-4 w-4" />
                  Sign in
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className={`cp-focus-ring h-10 rounded-md text-sm ${
                    isSignUp
                      ? 'bg-[#2A1D15] text-[#FFF8EA] shadow hover:bg-[#2A1D15] hover:text-[#FFF8EA]'
                      : 'text-[#5F4A3D] hover:bg-[#FFF8EA] hover:text-[#2A1D15]'
                  }`}
                  onClick={() => setMode('sign-up')}
                >
                  <UserPlus className="h-4 w-4" />
                  Create user
                </Button>
              </div>

              {isSignUp && (
                <div className="space-y-2">
                  <Label htmlFor="fullName" className="text-[#2A1D15]">
                    Name
                  </Label>
                  <Input
                    id="fullName"
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    placeholder="Slade"
                    autoComplete="name"
                    className="h-12 border-[#DCC5B4] bg-white/82 text-[#2A1D15] placeholder:text-[#806B5D] focus-visible:ring-2 focus-visible:ring-[#F26D2B] focus-visible:ring-offset-2 focus-visible:ring-offset-[#FFF8EA]"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email" className="text-[#2A1D15]">
                  Email
                </Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9B7355]" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    required
                    autoFocus
                    className="h-12 border-[#DCC5B4] bg-white/88 pl-10 text-[#2A1D15] shadow-[0_8px_22px_rgba(242,109,43,0.06)] placeholder:text-[#806B5D] focus-visible:ring-2 focus-visible:ring-[#F26D2B] focus-visible:ring-offset-2 focus-visible:ring-offset-[#FFF8EA]"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="password" className="text-[#2A1D15]">
                    Password
                  </Label>
                  <button
                    type="button"
                    onClick={handlePasswordReset}
                    className="cp-focus-ring rounded-sm text-sm font-semibold text-[#3A5638] underline-offset-4 hover:text-[#F26D2B] hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9B7355]" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete={isSignUp ? 'new-password' : 'current-password'}
                    minLength={6}
                    required
                    className="h-12 border-[#DCC5B4] bg-white/88 pl-10 pr-11 text-[#2A1D15] placeholder:text-[#806B5D] focus-visible:ring-2 focus-visible:ring-[#F26D2B] focus-visible:ring-offset-2 focus-visible:ring-offset-[#FFF8EA]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((isVisible) => !isVisible)}
                    className="cp-focus-ring absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-[#6F5746] transition hover:bg-[#FAF6F3] hover:text-[#2A1D15]"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {status && (
                <p className="rounded-md border border-[#B7D2B7] bg-[#EEF7F0] px-3 py-2 text-sm font-medium text-[#284426]">
                  {status}
                </p>
              )}
              {error && (
                <p className="rounded-md border border-[#F1B69D] bg-[#FFF1E7] px-3 py-2 text-sm font-medium text-[#8C2F0A]">
                  {error}
                </p>
              )}

              <Button
                type="submit"
                className="cp-focus-ring cp-path-button h-12 w-full rounded-md text-base font-bold"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Working...' : isSignUp ? 'Create account' : 'Sign in'}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </form>

            <div className="relative mt-6 rounded-lg border border-[#E8D5C6] bg-[#FAF6F3]/82 p-4">
              <div className="flex gap-3">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#E8D5C6]/65 text-[#3A5638]">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-bold text-[#2A1D15]">{CLEARPATH_LOGIN_COPY.demoKicker}</p>
                  <p className="mt-1 text-sm leading-6 text-[#5F4A3D]">{CLEARPATH_LOGIN_COPY.demoNote}</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section
          className={`relative hidden overflow-hidden lg:block ${
            isDarkLogin ? 'bg-[#2A1D15]' : 'bg-[#FFF8EA]'
          }`}
          aria-label={activeLoginMode.label}
        >
          <img
            src={activeLoginMode.asset}
            alt=""
            className={`absolute inset-0 h-full w-full object-cover ${
              isDarkLogin ? 'opacity-50 mix-blend-screen' : 'opacity-82'
            }`}
          />
          <div
            className={`absolute inset-0 ${
              isDarkLogin
                ? 'bg-[radial-gradient(circle_at_62%_40%,rgba(255,179,136,0.24),transparent_20rem),linear-gradient(90deg,#2A1D15_0%,rgba(42,29,21,0.72)_18%,rgba(42,29,21,0.32)_52%,rgba(42,29,21,0.84)_100%)]'
                : 'bg-[linear-gradient(90deg,#FAF6F3_0%,rgba(250,246,243,0.62)_18%,rgba(255,248,234,0.04)_56%,rgba(42,29,21,0.18)_100%)]'
            }`}
          />

          <div className="absolute left-0 top-1/2 h-px w-56 -translate-y-1/2 bg-gradient-to-r from-[#F26D2B] via-[#E8D5C6] to-transparent" />
          <div className="absolute left-44 top-1/2 h-3 w-3 -translate-y-1/2 rounded-full border border-[#F26D2B] bg-[#FFF8EA] shadow-[0_0_24px_rgba(242,109,43,0.75)]" />

          <div className="absolute right-[8%] top-[10%] h-[34rem] w-[34rem] rounded-full border border-[#E8D5C6]/22" />
          <div className="absolute right-[19%] top-[26%] h-44 w-44 rounded-full border border-[#5D8A5D]/32" />
          <div className="absolute bottom-[17%] right-[14%] h-28 w-28 rounded-full border border-[#FFB388]/28" />

          <div
            className={`absolute bottom-10 right-10 max-w-sm rounded-lg border p-5 shadow-[0_22px_70px_rgba(0,0,0,0.22)] backdrop-blur-xl ${
              isDarkLogin
                ? 'border-[#E8D5C6]/18 bg-[#2A1D15]/72 text-[#FFF8EA]'
                : 'border-[#FFF8EA]/52 bg-[#FFF8EA]/70 text-[#2A1D15]'
            }`}
          >
            <p className={`text-xs font-bold uppercase tracking-[0.18em] ${isDarkLogin ? 'text-[#FFB388]' : 'text-[#8A5D3F]'}`}>
              {activeLoginMode.eyebrow}
            </p>
            <h2 className="mt-3 text-2xl font-semibold leading-tight tracking-normal">
              {activeLoginMode.title}
            </h2>
            <p className={`mt-3 text-sm leading-6 ${isDarkLogin ? 'text-[#E8D5C6]' : 'text-[#5F4A3D]'}`}>
              {activeLoginMode.description}
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
