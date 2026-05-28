import fs from 'node:fs';
import path from 'node:path';
import PptxGenJS from 'pptxgenjs';
import {
  DIAGNOSTIC_OPTIONS,
  SALES_PRESENTATION_PLACEHOLDERS,
  SALES_PRESENTATION_SLIDES,
} from '../src/lib/salesPresentationContent.js';

const OUT_DIR = path.resolve(process.cwd(), '../project-ops/presentations');
const OUT_FILE = path.join(OUT_DIR, 'clearpath-operator-sales-deck.pptx');

const COLORS = {
  ink: '2F261E',
  espresso: '17130F',
  cream: 'FFF7E7',
  linen: 'F3E6CF',
  sage: '7E966F',
  sageDark: '334E3F',
  sunset: 'D58A38',
  clay: 'B8704D',
  gold: 'D4AF37',
  muted: '756453',
};

const THEME = {
  headFontFace: 'Crimson Pro',
  bodyFontFace: 'Inter',
  lang: 'en-US',
};

const DIAGNOSTIC_ACCENTS = [COLORS.sunset, COLORS.sage, COLORS.clay, COLORS.gold, COLORS.sageDark, COLORS.sunset];

function assetPath(publicPath) {
  return path.resolve(process.cwd(), 'public', publicPath.replace(/^\//, ''));
}

function addText(slide, text, x, y, w, h, opts = {}) {
  slide.addText(text, {
    x,
    y,
    w,
    h,
    margin: 0,
    breakLine: false,
    fit: 'shrink',
    ...opts,
  });
}

function addModuleChip(slide, label, x, y, w, color = COLORS.sage) {
  slide.addShape('roundRect', {
    x,
    y,
    w,
    h: 0.28,
    rectRadius: 0.03,
    fill: { color: 'FFFFFF', transparency: 14 },
    line: { color, transparency: 20, width: 0.8 },
  });
  addText(slide, label.replaceAll('-', ' '), x + 0.11, y + 0.07, w - 0.22, 0.14, {
    fontFace: 'Inter',
    fontSize: 6.8,
    bold: true,
    color: COLORS.sageDark,
    valign: 'mid',
    breakLine: false,
  });
}

function addGeometry(slide, accent) {
  for (let i = 0; i < 4; i += 1) {
    slide.addShape('ellipse', {
      x: 8.05 - i * 0.36,
      y: 0.48 + i * 0.28,
      w: 3.8 + i * 0.38,
      h: 3.8 + i * 0.38,
      fill: { color: 'FFFFFF', transparency: 100 },
      line: { color: i % 2 ? COLORS.gold : accent, transparency: 42 + i * 10, width: 1.1 },
    });
  }
  slide.addShape('arc', {
    x: 8.35,
    y: 4.86,
    w: 2.8,
    h: 1.8,
    adjustPoint: 0.3,
    line: { color: accent, transparency: 30, width: 2 },
  });
}

function addSlideNumber(slide, index) {
  addText(slide, `${String(index + 1).padStart(2, '0')} / 24`, 11.35, 6.84, 0.88, 0.16, {
    fontFace: 'Inter',
    fontSize: 7.4,
    bold: true,
    color: COLORS.muted,
    align: 'right',
  });
}

function addVisualPanel(slide, slideData) {
  const visual = assetPath(slideData.visual);
  slide.addShape('roundRect', {
    x: 7.34,
    y: 0.72,
    w: 4.86,
    h: 4.88,
    rectRadius: 0.08,
    fill: { color: COLORS.espresso },
    line: { color: slideData.accent.replace('#', ''), transparency: 36, width: 1.2 },
    shadow: { type: 'outer', color: '000000', opacity: 0.18, blur: 2, angle: 45, distance: 1 },
  });
  if (fs.existsSync(visual)) {
    slide.addImage({ path: visual, x: 7.45, y: 0.84, w: 4.64, h: 4.64, transparency: 0 });
  }
  slide.addShape('roundRect', {
    x: 7.58,
    y: 5.05,
    w: 4.4,
    h: 0.88,
    rectRadius: 0.04,
    fill: { color: COLORS.espresso, transparency: 10 },
    line: { color: COLORS.cream, transparency: 78, width: 0.7 },
  });
  addText(slide, slideData.interactionCue, 7.84, 5.26, 3.86, 0.36, {
    fontFace: 'Inter',
    fontSize: 10.3,
    bold: true,
    color: COLORS.cream,
    valign: 'mid',
  });
}

function addDiagnosticSlide(slide, slideData, index) {
  slide.background = { color: COLORS.linen };
  addGeometry(slide, COLORS.sunset);
  addText(slide, 'ClearPath Operator Diagnostic', 0.72, 0.46, 3.4, 0.2, {
    fontFace: 'Inter',
    fontSize: 8.8,
    bold: true,
    color: COLORS.sunset,
    charSpace: 0.4,
  });
  addText(slide, slideData.headline, 0.72, 0.82, 6.8, 1.02, {
    fontFace: 'Crimson Pro',
    fontSize: 31,
    bold: true,
    color: COLORS.ink,
    breakLine: false,
  });
  addText(slide, slideData.salesCopy, 0.76, 1.95, 5.78, 0.62, {
    fontFace: 'Inter',
    fontSize: 12,
    color: COLORS.muted,
    breakLine: false,
    fit: 'shrink',
  });
  DIAGNOSTIC_OPTIONS.forEach((option, optionIndex) => {
    const optionAccent = DIAGNOSTIC_ACCENTS[optionIndex % DIAGNOSTIC_ACCENTS.length];
    const col = optionIndex % 2;
    const row = Math.floor(optionIndex / 2);
    const x = 0.76 + col * 3.4;
    const y = 2.98 + row * 1.1;
    slide.addShape('roundRect', {
      x,
      y,
      w: 3.08,
      h: 0.82,
      rectRadius: 0.04,
      fill: { color: 'FFFFFF', transparency: 2 },
      line: { color: optionAccent, transparency: 28, width: 1 },
    });
    addText(slide, option.label, x + 0.16, y + 0.14, 2.64, 0.18, {
      fontFace: 'Inter',
      fontSize: 8,
      bold: true,
      color: optionAccent,
    });
    addText(slide, option.answer, x + 0.16, y + 0.36, 2.66, 0.28, {
      fontFace: 'Inter',
      fontSize: 7.2,
      color: COLORS.muted,
      fit: 'shrink',
    });
  });
  addVisualPanel(slide, slideData);
  addSlideNumber(slide, index);
}

function addSalesSlide(slide, slideData, index) {
  const accent = slideData.accent.replace('#', '');
  slide.background = { color: index === 0 ? COLORS.espresso : COLORS.linen };
  addGeometry(slide, accent);

  if (index === 0) {
    slide.addShape('rect', {
      x: 0,
      y: 0,
      w: 13.333,
      h: 7.5,
      fill: { color: COLORS.espresso },
      line: { color: COLORS.espresso },
    });
    const visual = assetPath(slideData.visual);
    if (fs.existsSync(visual)) {
      slide.addImage({ path: visual, x: 6.6, y: 0, w: 6.75, h: 7.5, transparency: 6 });
    }
    slide.addShape('rect', {
      x: 0,
      y: 0,
      w: 13.333,
      h: 7.5,
      fill: { color: COLORS.espresso, transparency: 12 },
      line: { color: COLORS.espresso, transparency: 100 },
    });
  }

  const dark = index === 0;
  const primaryText = dark ? COLORS.cream : COLORS.ink;
  const secondaryText = dark ? 'EEDBB6' : COLORS.muted;

  addText(slide, slideData.eyebrow, 0.72, 0.54, 4.4, 0.18, {
    fontFace: 'Inter',
    fontSize: 8.5,
    bold: true,
    color: accent,
    charSpace: 0.5,
  });
  addText(slide, slideData.headline, 0.72, 0.9, 6.22, 1.38, {
    fontFace: 'Crimson Pro',
    fontSize: dark ? 37 : 30,
    bold: true,
    color: primaryText,
    breakLine: false,
    fit: 'shrink',
  });
  addText(slide, slideData.salesCopy, 0.76, 2.45, 5.78, 0.78, {
    fontFace: 'Inter',
    fontSize: 12.2,
    color: secondaryText,
    breakLine: false,
    fit: 'shrink',
  });

  slide.addShape('roundRect', {
    x: 0.74,
    y: 3.62,
    w: 2.76,
    h: 1.2,
    rectRadius: 0.04,
    fill: { color: dark ? '241C15' : 'FFFFFF', transparency: dark ? 18 : 2 },
    line: { color: accent, transparency: 42, width: 0.8 },
  });
  addText(slide, 'Operator pressure', 0.94, 3.82, 1.8, 0.14, {
    fontFace: 'Inter',
    fontSize: 7.4,
    bold: true,
    color: accent,
  });
  addText(slide, slideData.painPoint, 0.94, 4.08, 2.34, 0.42, {
    fontFace: 'Inter',
    fontSize: 8.4,
    color: primaryText,
    fit: 'shrink',
  });

  slide.addShape('roundRect', {
    x: 3.78,
    y: 3.62,
    w: 2.92,
    h: 1.2,
    rectRadius: 0.04,
    fill: { color: dark ? '203326' : 'FFFFFF', transparency: dark ? 18 : 2 },
    line: { color: COLORS.sage, transparency: 36, width: 0.8 },
  });
  addText(slide, 'ClearPath answer', 3.98, 3.82, 1.8, 0.14, {
    fontFace: 'Inter',
    fontSize: 7.4,
    bold: true,
    color: COLORS.sage,
  });
  addText(slide, slideData.clearPathAnswer, 3.98, 4.08, 2.42, 0.42, {
    fontFace: 'Inter',
    fontSize: 8.4,
    color: primaryText,
    fit: 'shrink',
  });

  const modules = (slideData.modules || []).slice(0, 5);
  modules.forEach((module, moduleIndex) => {
    addModuleChip(slide, module, 0.76 + moduleIndex * 1.18, 5.25, 1.06, accent);
  });

  if (index !== 0) {
    addVisualPanel(slide, slideData);
  }
  addSlideNumber(slide, index);
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';
  pptx.author = 'Recovery Centered Living';
  pptx.company = 'Recovery Centered Living';
  pptx.subject = 'ClearPath operator sales presentation';
  pptx.title = 'ClearPath Operator Sales Presentation';
  pptx.lang = 'en-US';
  pptx.theme = THEME;
  pptx.defineLayout({ name: 'LAYOUT_WIDE', width: 13.333, height: 7.5 });
  pptx.margin = 0;
  pptx.layout = 'LAYOUT_WIDE';

  SALES_PRESENTATION_SLIDES.forEach((slideData, index) => {
    const slide = pptx.addSlide();
    if (slideData.id === 'diagnostic') {
      addDiagnosticSlide(slide, slideData, index);
    } else {
      addSalesSlide(slide, slideData, index);
    }
    slide.addNotes(
      [
        slideData.presenterNote,
        '',
        `Pain point: ${slideData.painPoint}`,
        `ClearPath answer: ${slideData.clearPathAnswer}`,
        `Interaction cue: ${slideData.interactionCue}`,
      ].join('\n')
    );
  });

  const appendix = pptx.addSlide();
  appendix.background = { color: COLORS.cream };
  addText(appendix, 'Approval placeholders', 0.72, 0.72, 5.6, 0.38, {
    fontFace: 'Crimson Pro',
    fontSize: 26,
    bold: true,
    color: COLORS.ink,
  });
  addText(
    appendix,
    SALES_PRESENTATION_PLACEHOLDERS.map((placeholder) => `${placeholder}`).join('\n'),
    0.82,
    1.42,
    6.1,
    1.35,
    {
      fontFace: 'Inter',
      fontSize: 14,
      color: COLORS.muted,
      breakLine: true,
    }
  );
  addText(
    appendix,
    'Use this appendix as the approval checklist before replacing placeholders with proof, pricing, implementation details, or finalized differentiators.',
    0.82,
    3.2,
    6.2,
    0.76,
    {
      fontFace: 'Inter',
      fontSize: 12,
      color: COLORS.muted,
    }
  );
  addGeometry(appendix, COLORS.sunset);
  addSlideNumber(appendix, SALES_PRESENTATION_SLIDES.length);

  await pptx.writeFile({ fileName: OUT_FILE });
  console.log(`Wrote ${OUT_FILE}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
