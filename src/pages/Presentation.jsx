import { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Play, Pause, X, ExternalLink, Shield, Users, BarChart3, MessageSquare, Package, DollarSign, Award, BookOpen, Activity, ClipboardCheck, AlertTriangle, Lock, Building2, Zap, CheckCircle2, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const SLIDES = [
  {
    id: 'intro',
    title: 'ClearPath',
    subtitle: 'The All-in-One Recovery Housing Management Platform',
    commentary: 'Welcome to ClearPath — a purpose-built platform designed for recovery housing operators who want to run safer, more compliant, and more impactful programs. Everything your team needs, from resident intake to grant reporting, lives in one secure system.',
    icon: Shield,
    color: '#B45309',
    bg: 'from-stone-950 to-stone-900',
    bullets: [
      'Built for NARR-certified sober living operators',
      'Replaces spreadsheets, paper files, and disconnected tools',
      'HIPAA-aware design with role-based access control',
      'Trusted by operators serving 50–500+ residents',
    ],
    link: null,
    accent: '#F59E0B',
    stat: { value: '23+', label: 'Integrated Modules' },
  },
  {
    id: 'dashboard',
    title: 'Operational Dashboard',
    subtitle: 'Everything at a glance — in real time',
    commentary: 'The ClearPath Dashboard gives house managers and directors an instant pulse on their operation. See occupancy, flagged wellness check-ins, open incidents, and upcoming tasks without digging through files or asking staff for updates.',
    icon: BarChart3,
    color: '#0369A1',
    bg: 'from-sky-950 to-slate-900',
    bullets: [
      'Live occupancy and resident counts per location',
      'Flagged morning check-in alerts with one-click review',
      'Open incident summary and trending safety data',
      'Quick-action buttons for intake, incident reporting, and chores',
    ],
    link: '/',
    accent: '#38BDF8',
    stat: { value: '< 30s', label: 'Morning Briefing Time' },
  },
  {
    id: 'intake',
    title: 'Digital Intake Wizard',
    subtitle: 'Streamlined, trauma-informed applicant onboarding',
    commentary: 'Replace paper applications with ClearPath\'s 8-step digital intake wizard. Collect demographics, recovery history, emergency contacts, document uploads, background check consent, and a legally binding e-signature — all in one guided flow that notifies staff automatically.',
    icon: ClipboardCheck,
    color: '#065F46',
    bg: 'from-emerald-950 to-stone-900',
    bullets: [
      '8-step guided wizard: personal info → demographics → recovery → housing → documents → background → e-sign',
      'Trauma-informed gender identity, pronoun, and orientation fields',
      'Automatic staff email notification on submission',
      'Documents stored securely with access-level controls',
    ],
    link: '/intake',
    accent: '#34D399',
    stat: { value: '8', label: 'Intake Steps' },
  },
  {
    id: 'residents',
    title: 'Resident Management',
    subtitle: 'Full-lifecycle resident tracking from applicant to alumni',
    commentary: 'Every resident\'s journey is documented end-to-end. Staff can view wellness trends, care plan goals, sobriety milestones, medication logs, incident history, and timeline events from a single profile — eliminating the need for separate systems.',
    icon: Users,
    color: '#7C3AED',
    bg: 'from-violet-950 to-slate-900',
    bullets: [
      'Searchable resident directory with status, phase, and location filters',
      'Individual profiles with care plans, milestones, and wellness trends',
      'Document alerts for expiring IDs and insurance cards',
      'Full audit trail and timeline for every resident record',
    ],
    link: '/residents',
    accent: '#A78BFA',
    stat: { value: '360°', label: 'Resident View' },
  },
  {
    id: 'wellness',
    title: 'Daily Wellness Check-Ins',
    subtitle: 'Proactive recovery support — every morning',
    commentary: 'Residents complete a brief morning check-in covering mood, sleep, physical wellbeing, and gratitude. ClearPath auto-flags low scores for staff review, and optionally administers validated BARC-10 and Quality of Life assessments. This early warning system helps prevent relapse before it happens.',
    icon: Activity,
    color: '#BE185D',
    bg: 'from-pink-950 to-slate-900',
    bullets: [
      'Daily mood, sleep, and wellbeing ratings (1–5 scale)',
      'Auto-flagging of concerning check-ins with reason notes',
      'Optional BARC-10 recovery capital and QoL assessments',
      'Staff review workflow with annotation and sign-off',
    ],
    link: '/my-profile',
    accent: '#F472B6',
    stat: { value: 'BARC-10', label: 'Validated Assessment' },
  },
  {
    id: 'compliance',
    title: 'NARR Compliance Tracking',
    subtitle: 'Stay audit-ready at every NARR level',
    commentary: 'ClearPath maps your policies and practices directly to NARR Standards Level I–IV. The Compliance Readiness Score gives operators a live percentage view of their audit readiness, with domain-by-domain breakdowns and documentation links — so you\'re never caught off guard during an inspection.',
    icon: Shield,
    color: '#B45309',
    bg: 'from-amber-950 to-stone-900',
    bullets: [
      'Full NARR Standards matrix with pass/fail/partial status',
      'Live Compliance Readiness Score with domain breakdown',
      'Evidence documentation attachment per standard',
      'Tracks all four NARR levels of support',
    ],
    link: '/compliance',
    accent: '#F59E0B',
    stat: { value: 'NARR I–IV', label: 'All Levels Covered' },
  },
  {
    id: 'incidents',
    title: 'Incident & Safety Management',
    subtitle: 'Document, track, and learn from every safety event',
    commentary: 'When an incident occurs, ClearPath makes documentation fast and thorough — capturing who, what, when, where, and follow-up actions. The Safety Trends dashboard then turns incident data into actionable patterns, helping leadership identify high-risk periods, locations, or individuals.',
    icon: AlertTriangle,
    color: '#DC2626',
    bg: 'from-red-950 to-slate-900',
    bullets: [
      'Structured incident forms with severity, type, and follow-up fields',
      'Automated notification workflows for critical incidents',
      'Safety Trends dashboard with time-series and category analysis',
      'Incident history per resident for care planning integration',
    ],
    link: '/incident-safety',
    accent: '#F87171',
    stat: { value: 'Real-Time', label: 'Safety Alerts' },
  },
  {
    id: 'analytics',
    title: 'Analytics & Reporting',
    subtitle: 'Grant-ready data at your fingertips',
    commentary: 'ClearPath\'s Analytics module gives operators the data they need for grant reporting, board presentations, and quality improvement. Track occupancy trends, average length of stay, wellness outcomes, incident rates, and demographic breakdowns — filterable by location or program-wide.',
    icon: BarChart3,
    color: '#0F766E',
    bg: 'from-teal-950 to-slate-900',
    bullets: [
      'Occupancy, LOS, and turnover rate charts',
      'Wellness trend analysis with mood and sleep averages',
      'Incident trend reporting by category and severity',
      'Demographic breakdown for equitable service reporting',
    ],
    link: '/analytics',
    accent: '#2DD4BF',
    stat: { value: 'Grant-Ready', label: 'Built-In Reports' },
  },
  {
    id: 'grants',
    title: 'Grant Management',
    subtitle: 'Track every dollar and every outcome',
    commentary: 'Managing multiple grants is one of the biggest administrative burdens for recovery housing operators. ClearPath centralizes grant tracking — award amounts, bed slots funded, enrolled residents, required metrics, and reporting schedules — all in one place.',
    icon: Award,
    color: '#6D28D9',
    bg: 'from-purple-950 to-slate-900',
    bullets: [
      'Grant database with funder, award, dates, and status',
      'Resident enrollment tracking per grant',
      'Required metrics dashboard for each funder',
      'Quarterly and annual reporting support',
    ],
    link: '/grants',
    accent: '#C084FC',
    stat: { value: 'Multi-Grant', label: 'Tracking Built-In' },
  },
  {
    id: 'finance',
    title: 'Finance & Expense Tracking',
    subtitle: 'Keep every location financially accountable',
    commentary: 'Track recurring and one-time expenses per property — rent, utilities, insurance, staffing, and supplies. The Finance module gives directors a clear view of operating costs across all locations, supporting budget management and grant expense documentation.',
    icon: DollarSign,
    color: '#15803D',
    bg: 'from-green-950 to-slate-900',
    bullets: [
      'Expense tracking by category, location, and frequency',
      'Vendor, account number, and auto-pay tracking',
      'Monthly vs. annual cost summaries',
      'Procurement request and approval workflows',
    ],
    link: '/finance',
    accent: '#4ADE80',
    stat: { value: 'Per-Location', label: 'P&L Visibility' },
  },
  {
    id: 'chat',
    title: 'Community Chat',
    subtitle: 'Secure, organized communication for your whole community',
    commentary: 'ClearPath replaces group texts and personal messaging apps with a structured, role-aware community chat. Channels are organized by house, topic, and access level — so management conversations stay private, while community channels keep residents connected.',
    icon: MessageSquare,
    color: '#1D4ED8',
    bg: 'from-blue-950 to-slate-900',
    bullets: [
      'House-specific, organization-wide, and direct message channels',
      'Role-based access: management-only, staff, or all-residents',
      'Announcement channels for policy and schedule updates',
      'Archived channel history for accountability',
    ],
    link: '/chat',
    accent: '#60A5FA',
    stat: { value: 'Role-Gated', label: 'Secure Channels' },
  },
  {
    id: 'training',
    title: 'Staff Training Center',
    subtitle: 'Onboard and upskill your team — inside the platform',
    commentary: 'ClearPath\'s built-in Training Center lets operators create and publish training modules for staff — covering HIPAA compliance, peer support, crisis intervention, medication management, and custom topics. Track completion rates per staff member with built-in quiz scoring.',
    icon: BookOpen,
    color: '#92400E',
    bg: 'from-amber-950 to-stone-900',
    bullets: [
      'Create slide decks, document uploads, video links, or quizzes',
      'Assign required modules by staff role',
      'Track completion dates and scores per staff member',
      'Built-in categories: HIPAA, peer support, safety, onboarding',
    ],
    link: '/training',
    accent: '#FCD34D',
    stat: { value: 'LMS Built-In', label: 'No Extra Tools' },
  },
  {
    id: 'hipaa',
    title: 'HIPAA Compliance & Audit Logs',
    subtitle: 'Every sensitive action, tracked and documented',
    commentary: 'ClearPath\'s HIPAA module maintains a complete audit trail of who accessed, edited, exported, or shared resident information — and why. This protects your organization during audits and demonstrates your commitment to resident privacy.',
    icon: Lock,
    color: '#1E3A5F',
    bg: 'from-slate-950 to-slate-900',
    bullets: [
      'Full audit log: view, edit, export, share, delete, print',
      'Staff name, timestamp, access reason, and IP address recorded',
      'Filter by staff member, resident, or action type',
      'Exportable for compliance reviews',
    ],
    link: '/hipaa',
    accent: '#94A3B8',
    stat: { value: '42 CFR', label: 'Part 2 Aware' },
  },
  {
    id: 'cta',
    title: 'Ready to Transform Your Program?',
    subtitle: 'ClearPath — Built for operators who believe recovery is worth doing right.',
    commentary: 'ClearPath is more than software — it\'s the operational infrastructure that lets your team focus on people, not paperwork. Whether you operate one house or twenty, ClearPath scales with your mission and delivers the data your funders and regulators require.',
    icon: Zap,
    color: '#B45309',
    bg: 'from-stone-950 via-amber-950 to-stone-900',
    bullets: [
      '✅ Reduce administrative burden by 60%+',
      '✅ Stay inspection-ready with live NARR compliance scoring',
      '✅ Demonstrate outcomes to funders with built-in reporting',
      '✅ Protect residents and your organization with HIPAA audit trails',
    ],
    link: null,
    accent: '#F59E0B',
    stat: { value: '30-Day', label: 'Free Trial Available' },
  },
];

export default function Presentation() {
  const [current, setCurrent] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [videoOpen, setVideoOpen] = useState(false);
  const [showCommentary, setShowCommentary] = useState(true);
  const intervalRef = useRef(null);
  const timerRef = useRef(null);
  const [progress, setProgress] = useState(0);

  const SLIDE_DURATION = 12000;

  useEffect(() => {
    if (playing) {
      setProgress(0);
      const start = Date.now();
      timerRef.current = setInterval(() => {
        const elapsed = Date.now() - start;
        setProgress(Math.min((elapsed / SLIDE_DURATION) * 100, 100));
      }, 50);
      intervalRef.current = setTimeout(() => {
        setCurrent(prev => (prev + 1) % SLIDES.length);
        setProgress(0);
      }, SLIDE_DURATION);
    } else {
      clearTimeout(intervalRef.current);
      clearInterval(timerRef.current);
    }
    return () => { clearTimeout(intervalRef.current); clearInterval(timerRef.current); };
  }, [playing, current]);

  const go = (dir) => {
    setPlaying(false);
    setProgress(0);
    setCurrent(prev => (prev + dir + SLIDES.length) % SLIDES.length);
  };

  const goTo = (idx) => {
    setPlaying(false);
    setProgress(0);
    setCurrent(idx);
  };

  const slide = SLIDES[current];
  const Icon = slide.icon;

  return (
    <div className={`min-h-screen bg-gradient-to-br ${slide.bg} transition-all duration-700 flex flex-col`}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#B45309' }}>
            <Shield className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-white text-sm">ClearPath</span>
          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#B45309', color: '#FEF3C7' }}>Platform Demo</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowCommentary(v => !v)}
            className="text-xs px-3 py-1.5 rounded-full border border-white/20 text-white/60 hover:text-white hover:border-white/40 transition-colors"
          >
            {showCommentary ? 'Hide Commentary' : 'Show Commentary'}
          </button>
          <button
            onClick={() => setVideoOpen(true)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full transition-colors"
            style={{ background: '#B45309', color: 'white' }}
          >
            <Play className="w-3 h-3" /> Watch Demo Video
          </button>
          <Link to="/">
            <button className="text-xs px-3 py-1.5 rounded-full border border-white/20 text-white/60 hover:text-white transition-colors">
              ← Back to App
            </button>
          </Link>
        </div>
      </div>

      {/* Progress bar */}
      {playing && (
        <div className="h-0.5 bg-white/10">
          <div
            className="h-full transition-none"
            style={{ width: `${progress}%`, background: slide.accent }}
          />
        </div>
      )}

      {/* Slide dots */}
      <div className="flex items-center justify-center gap-1.5 pt-4 px-6">
        {SLIDES.map((s, i) => (
          <button
            key={s.id}
            onClick={() => goTo(i)}
            className="transition-all duration-300 rounded-full"
            style={{
              width: i === current ? 24 : 8,
              height: 8,
              background: i === current ? slide.accent : 'rgba(255,255,255,0.2)',
            }}
          />
        ))}
      </div>

      {/* Main slide */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-8 max-w-6xl mx-auto w-full">
        {/* Slide counter */}
        <div className="text-xs mb-6 font-mono" style={{ color: 'rgba(255,255,255,0.4)' }}>
          {current + 1} / {SLIDES.length}
        </div>

        <div className="w-full grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
          {/* Left: content */}
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border mb-6"
              style={{ borderColor: `${slide.accent}40`, background: `${slide.accent}15` }}>
              <Icon className="w-4 h-4" style={{ color: slide.accent }} />
              <span className="text-xs font-medium" style={{ color: slide.accent }}>
                {slide.id === 'intro' ? 'Platform Overview' : slide.id === 'cta' ? 'Get Started' : 'Module Spotlight'}
              </span>
            </div>

            <h1 className="text-4xl lg:text-5xl font-bold text-white mb-3 leading-tight">
              {slide.title}
            </h1>
            <p className="text-lg mb-8" style={{ color: 'rgba(255,255,255,0.6)' }}>
              {slide.subtitle}
            </p>

            {/* Bullets */}
            <ul className="space-y-3 mb-8">
              {slide.bullets.map((b, i) => (
                <li key={i} className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ background: `${slide.accent}25` }}>
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: slide.accent }} />
                  </div>
                  <span className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.8)' }}>{b}</span>
                </li>
              ))}
            </ul>

            {/* CTA */}
            <div className="flex items-center gap-3 flex-wrap">
              {slide.link && (
                <Link to={slide.link}>
                  <button
                    className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-opacity hover:opacity-90"
                    style={{ background: slide.accent, color: '#1C1917' }}
                  >
                    Explore Module <ArrowRight className="w-4 h-4" />
                  </button>
                </Link>
              )}
              {slide.id === 'cta' && (
                <button
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-opacity hover:opacity-90"
                  style={{ background: slide.accent, color: '#1C1917' }}
                  onClick={() => setVideoOpen(true)}
                >
                  <Play className="w-4 h-4" /> Watch Full Demo
                </button>
              )}
            </div>
          </div>

          {/* Right: stat card + commentary */}
          <div className="flex flex-col gap-5">
            {/* Big stat */}
            <div className="rounded-2xl border p-8 text-center"
              style={{ borderColor: `${slide.accent}30`, background: `${slide.accent}10` }}>
              <div className="text-6xl font-black mb-2" style={{ color: slide.accent }}>
                {slide.stat.value}
              </div>
              <div className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.6)' }}>
                {slide.stat.label}
              </div>

              {/* Module icons */}
              {slide.id === 'intro' && (
                <div className="flex flex-wrap justify-center gap-2 mt-6">
                  {[Shield, Users, BarChart3, MessageSquare, ClipboardCheck, AlertTriangle, Package, DollarSign, Award, BookOpen, Activity, Lock].map((ModIcon, i) => {
                    const MI = ModIcon;
                    return (
                      <div key={i} className="w-8 h-8 rounded-lg flex items-center justify-center"
                        style={{ background: 'rgba(255,255,255,0.1)' }}>
                        <MI className="w-4 h-4 text-white/60" />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Commentary box */}
            {showCommentary && (
              <div className="rounded-xl border p-5"
                style={{ borderColor: 'rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)' }}>
                <div className="text-xs font-semibold mb-2 uppercase tracking-wider"
                  style={{ color: 'rgba(255,255,255,0.35)' }}>
                  Presenter Commentary
                </div>
                <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.75)' }}>
                  {slide.commentary}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Nav controls */}
      <div className="flex items-center justify-center gap-6 pb-8">
        <button
          onClick={() => go(-1)}
          className="w-10 h-10 rounded-full border border-white/20 flex items-center justify-center text-white/60 hover:text-white hover:border-white/40 transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <button
          onClick={() => setPlaying(v => !v)}
          className="flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-medium transition-all"
          style={{ background: playing ? 'rgba(255,255,255,0.15)' : slide.accent, color: playing ? 'white' : '#1C1917' }}
        >
          {playing ? <><Pause className="w-4 h-4" /> Pause</> : <><Play className="w-4 h-4" /> Auto-Play</>}
        </button>

        <button
          onClick={() => go(1)}
          className="w-10 h-10 rounded-full border border-white/20 flex items-center justify-center text-white/60 hover:text-white hover:border-white/40 transition-colors"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Video modal */}
      {videoOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="relative w-full max-w-4xl rounded-2xl overflow-hidden shadow-2xl" style={{ background: '#1C1917' }}>
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5" style={{ color: '#F59E0B' }} />
                <span className="font-bold text-white">ClearPath Platform Demo</span>
              </div>
              <button onClick={() => setVideoOpen(false)} className="text-white/60 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <video
              src="https://media.base44.com/videos/public/6a05d91e99a1b047a36b9ede/c95bef807_generated_video.mp4"
              controls
              autoPlay
              className="w-full"
              style={{ maxHeight: '70vh' }}
            >
              Your browser does not support the video tag.
            </video>
            <div className="p-5">
              <p className="text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>
                ClearPath is the all-in-one recovery housing management platform — built for NARR-certified operators who want to run safer, more compliant, and more impactful programs. From digital intake to grant reporting, everything lives in one secure, intuitive system.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}