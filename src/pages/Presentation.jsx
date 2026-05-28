import { useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Layers3,
  Pause,
  Play,
  Route,
  Shield,
  Sparkles,
  X,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  DIAGNOSTIC_OPTIONS,
  SALES_PRESENTATION_SLIDES,
} from '@/lib/salesPresentationContent';
import {
  SALES_VIDEO_ASSETS,
  SALES_VIDEO_STORYBOARD,
} from '@/lib/salesVideoStoryboard';

const CHAPTERS = [
  { label: 'Open', slideId: 'opening-path' },
  { label: 'Map', slideId: 'platform-map' },
  { label: 'Residents', slideId: 'resident-profiles' },
  { label: 'Operations', slideId: 'bed-capacity' },
  { label: 'Safety', slideId: 'incident-reporting' },
  { label: 'Proof', slideId: 'analytics-outcomes' },
  { label: 'Close', slideId: 'close-validation' },
];

function VideoModal({ onClose }) {
  return (
    <div className="fixed inset-y-0 left-0 right-0 z-[1000] flex items-center justify-center bg-[#120f0b]/90 p-4 backdrop-blur-xl lg:left-64">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-[28px] border border-[#f8dfb3]/20 bg-[#1d1812] shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-[#f8dfb3]/15 px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#d58a38]">Narrated sales movie</p>
            <h2 className="font-serif text-2xl font-semibold text-[#fff8ea]">ClearPath operator sales story</h2>
          </div>
          <button
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-[#f8dfb3]/20 text-[#fff8ea] transition hover:bg-[#fff8ea]/10 focus:outline-none focus:ring-2 focus:ring-[#d58a38]"
            aria-label="Close video modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid min-h-0 flex-1 gap-0 lg:grid-cols-[1.32fr_0.9fr]">
          <div className="bg-black p-3">
            <video
              className="aspect-video h-full max-h-[66vh] w-full rounded-2xl object-contain"
              controls
              poster={SALES_VIDEO_ASSETS.poster}
              preload="metadata"
            >
              <source src={SALES_VIDEO_ASSETS.renderedVideo} type="video/mp4" />
              <track src={SALES_VIDEO_ASSETS.captions} kind="captions" srcLang="en" label="English captions" default />
            </video>
          </div>

          <div className="min-h-0 overflow-y-auto p-5">
            <div className="mb-5 rounded-2xl border border-[#d58a38]/30 bg-[#d58a38]/10 p-4">
              <p className="text-sm font-semibold text-[#fff8ea]">Movie spine</p>
              <p className="mt-2 text-sm leading-6 text-[#f4e4c3]">
                This narrated movie condenses the 24-slide operator deck into a platform sales story with captions and voice audio.
              </p>
            </div>

            <div className="space-y-3">
              {SALES_VIDEO_STORYBOARD.map((scene, index) => (
                <div key={scene.id} className="grid grid-cols-[84px_1fr] gap-3 rounded-2xl border border-[#f8dfb3]/12 bg-[#fff8ea]/5 p-3">
                  <img src={scene.asset} alt="" className="h-16 w-full rounded-xl object-cover" />
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#d58a38]">Scene {index + 1}</p>
                    <h3 className="text-sm font-semibold text-[#fff8ea]">{scene.title}</h3>
                    <p className="mt-1 text-xs leading-5 text-[#f4e4c3]/75">{scene.caption}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default function Presentation() {
  const [current, setCurrent] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [videoOpen, setVideoOpen] = useState(false);
  const slide = SALES_PRESENTATION_SLIDES[current];
  const progress = useMemo(() => ((current + 1) / SALES_PRESENTATION_SLIDES.length) * 100, [current]);

  useEffect(() => {
    if (!playing) return undefined;
    const timer = window.setTimeout(() => {
      setCurrent((prev) => (prev + 1) % SALES_PRESENTATION_SLIDES.length);
    }, 11000);
    return () => window.clearTimeout(timer);
  }, [current, playing]);

  const goToId = (id) => {
    const index = SALES_PRESENTATION_SLIDES.findIndex((item) => item.id === id);
    if (index >= 0) {
      setPlaying(false);
      setCurrent(index);
    }
  };

  const go = (dir) => {
    setPlaying(false);
    setCurrent((prev) => (prev + dir + SALES_PRESENTATION_SLIDES.length) % SALES_PRESENTATION_SLIDES.length);
  };

  return (
    <div className="min-h-[calc(100vh-56px)] bg-[#17130e] text-[#fff8ea]">
      <div className="fixed inset-0 pointer-events-none opacity-40">
        <img src="/images/clearpath/warm-paper-path-texture.png" alt="" className="h-full w-full object-cover" />
      </div>

      <div className="relative mx-auto flex min-h-[calc(100vh-56px)] w-full max-w-7xl flex-col px-5 py-3 lg:px-8">
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#f8dfb3]/15 bg-[#211a13]/85 px-4 py-2.5 shadow-[0_20px_60px_rgba(0,0,0,0.22)] backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#d58a38] text-[#1b130c]">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-[#d58a38]">ClearPath sales presentation</p>
              <p className="font-serif text-xl font-semibold">Operator platform story</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => go(-1)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#f8dfb3]/20 text-[#f4e4c3] transition hover:bg-[#fff8ea]/10 focus:outline-none focus:ring-2 focus:ring-[#d58a38]"
              aria-label="Previous slide"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="rounded-full border border-[#f8dfb3]/15 px-3 py-2 text-xs font-semibold text-[#f4e4c3]/80">
              {current + 1} / {SALES_PRESENTATION_SLIDES.length}
            </span>
            <button
              onClick={() => go(1)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#f8dfb3]/20 text-[#f4e4c3] transition hover:bg-[#fff8ea]/10 focus:outline-none focus:ring-2 focus:ring-[#d58a38]"
              aria-label="Next slide"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              onClick={() => setVideoOpen(true)}
              className="inline-flex items-center gap-2 rounded-full bg-[#d58a38] px-4 py-2 text-sm font-semibold text-[#1b130c] transition hover:bg-[#efb261] focus:outline-none focus:ring-2 focus:ring-[#fff8ea]"
            >
              <Play className="h-4 w-4" />
              Play movie
            </button>
            <Link
              to={slide.route || '/'}
              className="inline-flex items-center gap-2 rounded-full border border-[#f8dfb3]/20 px-4 py-2 text-sm text-[#f4e4c3] transition hover:bg-[#fff8ea]/10 focus:outline-none focus:ring-2 focus:ring-[#d58a38]"
            >
              <ExternalLink className="h-4 w-4" />
              Open module
            </Link>
          </div>
        </header>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {CHAPTERS.map((chapter) => (
            <button
              key={chapter.slideId}
              onClick={() => goToId(chapter.slideId)}
              className="rounded-full border border-[#f8dfb3]/15 bg-[#fff8ea]/5 px-3 py-1.5 text-xs font-semibold text-[#f4e4c3]/75 transition hover:bg-[#fff8ea]/10 focus:outline-none focus:ring-2 focus:ring-[#d58a38]"
            >
              {chapter.label}
            </button>
          ))}
        </div>

        <div className="mt-3 h-1 rounded-full bg-[#fff8ea]/10">
          <div className="h-full rounded-full bg-[#d58a38] transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>

        <main className="grid flex-1 gap-4 py-3 lg:grid-cols-[0.58fr_1fr] lg:items-center">
          <motion.section
            key={slide.id}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="order-2 lg:order-1"
          >
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#d58a38]/30 bg-[#d58a38]/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-[#d58a38]">
              <Sparkles className="h-4 w-4" />
              {slide.eyebrow}
            </div>

            <h1 className="max-w-2xl font-serif text-4xl font-semibold leading-[0.98] tracking-normal text-[#fff8ea] md:text-[46px] xl:text-[54px]">
              {slide.headline}
            </h1>
            <p className="mt-3 max-w-xl text-base leading-7 text-[#f4e4c3]/82">{slide.salesCopy}</p>

            {slide.diagnostic ? (
              <div className="mt-5 space-y-4">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {DIAGNOSTIC_OPTIONS.map((option) => (
                    <button
                      key={option.slideId}
                      onClick={() => goToId(option.slideId)}
                      className="rounded-2xl border border-[#f8dfb3]/15 bg-[#fff8ea]/5 px-3 py-3 text-left text-sm text-[#f4e4c3]/78 transition hover:border-[#d58a38]/60 hover:bg-[#d58a38]/14 focus:outline-none focus:ring-2 focus:ring-[#d58a38]"
                    >
                      <span className="block font-semibold text-[#fff8ea]">{option.label}</span>
                      <span className="mt-1 block text-xs leading-5">{option.pain}</span>
                    </button>
                  ))}
                </div>
                <div className="rounded-2xl border border-[#8daa75]/25 bg-[#8daa75]/10 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#a9c99b]">Presenter move</p>
                  <p className="mt-2 text-sm leading-6 text-[#d9e9d0]">{slide.interactionCue}</p>
                </div>
              </div>
            ) : (
              <div className="mt-4 grid gap-3 xl:grid-cols-2">
                <div className="rounded-2xl border border-[#f8dfb3]/15 bg-[#fff8ea]/5 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#d58a38]">Operator pain</p>
                  <p className="mt-2 text-sm leading-6 text-[#f4e4c3]">{slide.painPoint}</p>
                </div>
                <div className="rounded-2xl border border-[#8daa75]/25 bg-[#8daa75]/10 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#a9c99b]">ClearPath answer</p>
                  <p className="mt-2 text-sm leading-6 text-[#d9e9d0]">{slide.clearPathAnswer}</p>
                </div>
              </div>
            )}
          </motion.section>

          <section className="order-1 lg:order-2">
            <motion.div
              key={slide.visual}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.45 }}
              className="relative overflow-hidden rounded-[32px] border border-[#f8dfb3]/16 bg-[#211a13] p-3 shadow-[0_40px_90px_rgba(0,0,0,0.35)]"
            >
              <img src={slide.visual} alt="" className="aspect-video w-full rounded-[24px] object-cover" />
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 px-1">
                <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-[#f4e4c3]/65">
                  <Layers3 className="h-4 w-4" />
                  Slide {current + 1} of {SALES_PRESENTATION_SLIDES.length}
                </div>
                <div className="inline-flex max-w-md items-center gap-2 text-right text-xs leading-5 text-[#f4e4c3]/65">
                  <Route className="h-4 w-4 flex-none" />
                  {slide.interactionCue}
                </div>
              </div>
            </motion.div>
          </section>
        </main>

        <footer className="flex flex-wrap items-center justify-between gap-4 pb-1">
          <div className="flex max-w-full gap-1 overflow-x-auto pb-1">
            {SALES_PRESENTATION_SLIDES.map((item, index) => (
              <button
                key={item.id}
                onClick={() => {
                  setPlaying(false);
                  setCurrent(index);
                }}
                className={`h-2.5 flex-none rounded-full transition-all focus:outline-none focus:ring-2 focus:ring-[#d58a38] ${
                  index === current ? 'w-10 bg-[#d58a38]' : 'w-2.5 bg-[#fff8ea]/25 hover:bg-[#fff8ea]/45'
                }`}
                aria-label={`Go to slide ${index + 1}: ${item.headline}`}
              />
            ))}
          </div>

          <button
            onClick={() => setPlaying((value) => !value)}
            className="inline-flex items-center gap-2 rounded-full bg-[#fff8ea] px-5 py-2.5 text-sm font-semibold text-[#1b130c] transition hover:bg-white focus:outline-none focus:ring-2 focus:ring-[#d58a38]"
          >
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {playing ? 'Presenter pause' : 'Presenter mode'}
          </button>
        </footer>
      </div>

      {videoOpen && <VideoModal onClose={() => setVideoOpen(false)} />}
    </div>
  );
}
