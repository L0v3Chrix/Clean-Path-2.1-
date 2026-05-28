import { describe, expect, it } from 'vitest';
import {
  SALES_VIDEO_ASSETS,
  SALES_VIDEO_STORYBOARD,
  SALES_VIDEO_TOTAL_FRAMES,
  SALES_VIDEO_VOICEOVER,
  getSalesVideoSceneById,
} from './salesVideoStoryboard';

describe('sales video storyboard', () => {
  it('defines a complete narrated operator sales movie', () => {
    expect(SALES_VIDEO_STORYBOARD.length).toBeGreaterThanOrEqual(10);
    expect(SALES_VIDEO_STORYBOARD.length).toBeLessThanOrEqual(12);

    SALES_VIDEO_STORYBOARD.forEach((scene) => {
      expect(scene).toMatchObject({
        id: expect.any(String),
        title: expect.any(String),
        painPoint: expect.stringMatching(/\S/),
        solution: expect.stringMatching(/\S/),
        asset: expect.stringMatching(/^\/images\/clearpath\/.+\.(png|jpg|jpeg)$/),
        narration: expect.stringMatching(/\S/),
        durationInFrames: expect.any(Number),
      });
      expect(scene.durationInFrames).toBeGreaterThanOrEqual(90);
    });
  });

  it('keeps unsupported operational claims out of the narration', () => {
    expect(SALES_VIDEO_VOICEOVER).not.toMatch(/\d+%|free trial|NARR-certified|42 CFR|grant-ready|ROI|guarantee/i);
  });

  it('derives total duration and scene lookup from the storyboard', () => {
    const expectedFrames = SALES_VIDEO_STORYBOARD.reduce(
      (total, scene) => total + scene.durationInFrames,
      0
    );

    expect(SALES_VIDEO_TOTAL_FRAMES).toBe(expectedFrames);
    expect(getSalesVideoSceneById('film-dashboard').title).toBe('Today’s operating picture');
  });

  it('exposes poster, video, captions, and audio output paths for the modal', () => {
    expect(SALES_VIDEO_ASSETS.poster).toBe('/images/clearpath/video/opening-threshold.png');
    expect(SALES_VIDEO_ASSETS.renderedVideo).toBe('/videos/clearpath-sales-video.mp4');
    expect(SALES_VIDEO_ASSETS.captions).toBe('/videos/clearpath-sales-video.vtt');
    expect(SALES_VIDEO_ASSETS.voiceover).toBe('/audio/clearpath-sales-voiceover.mp3');
  });
});
