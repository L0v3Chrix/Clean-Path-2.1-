import { describe, expect, it } from 'vitest';
import {
  MAJOR_PLATFORM_MODULES,
  SALES_PRESENTATION_PLACEHOLDERS,
  SALES_PRESENTATION_SLIDES,
  SALES_PRESENTATION_TOTAL_VIDEO_FRAMES,
  SALES_PRESENTATION_VIDEO_SCENES,
  SALES_PRESENTATION_VOICEOVER,
  getSlideById,
} from './salesPresentationContent';

describe('sales presentation content', () => {
  it('defines the complete 24-slide operator sales deck', () => {
    expect(SALES_PRESENTATION_SLIDES).toHaveLength(24);

    SALES_PRESENTATION_SLIDES.forEach((slide) => {
      expect(slide).toMatchObject({
        id: expect.any(String),
        eyebrow: expect.any(String),
        headline: expect.stringMatching(/\S/),
        salesCopy: expect.stringMatching(/\S/),
        painPoint: expect.stringMatching(/\S/),
        clearPathAnswer: expect.stringMatching(/\S/),
        presenterNote: expect.stringMatching(/\S/),
        visual: expect.stringMatching(/^\/images\/clearpath\/.+\.(png|jpg|jpeg)$/),
      });
      expect(slide.headline).not.toMatch(/design|use original|show the moment|make the ownership/i);
      expect(slide.salesCopy).not.toMatch(/design this slide|visual system|internal/i);
    });
  });

  it('covers every major platform module in the sales story', () => {
    const coveredModules = new Set(SALES_PRESENTATION_SLIDES.flatMap((slide) => slide.modules || []));

    MAJOR_PLATFORM_MODULES.forEach((module) => {
      expect(coveredModules.has(module)).toBe(true);
    });
  });

  it('keeps unsupported quantitative claims as placeholders', () => {
    const allCopy = JSON.stringify(SALES_PRESENTATION_SLIDES);

    expect(allCopy).not.toMatch(/\d+%|ROI|guarantee|certified|customer[s]? saved/i);
    expect(SALES_PRESENTATION_PLACEHOLDERS).toEqual(
      expect.arrayContaining([
        '[FILL: approved differentiators]',
        '[FILL: customer proof]',
        '[FILL: pricing/timeline]',
        '[FILL: implementation model]',
      ])
    );
  });

  it('derives 10 to 12 narrated video scenes from the approved sales spine', () => {
    expect(SALES_PRESENTATION_VIDEO_SCENES.length).toBeGreaterThanOrEqual(10);
    expect(SALES_PRESENTATION_VIDEO_SCENES.length).toBeLessThanOrEqual(12);

    SALES_PRESENTATION_VIDEO_SCENES.forEach((scene) => {
      expect(getSlideById(scene.sourceSlideId)).toBeTruthy();
      expect(scene.narration).toMatch(/\S/);
      expect(scene.caption).toMatch(/\S/);
      expect(scene.durationInFrames).toBeGreaterThanOrEqual(150);
    });

    expect(SALES_PRESENTATION_TOTAL_VIDEO_FRAMES).toBeGreaterThanOrEqual(30 * 150);
    expect(SALES_PRESENTATION_TOTAL_VIDEO_FRAMES).toBeLessThanOrEqual(30 * 240);
    expect(SALES_PRESENTATION_VOICEOVER).toContain('ClearPath');
    expect(SALES_PRESENTATION_VOICEOVER).not.toMatch(/\d+%|ROI|guarantee/i);
  });
});
