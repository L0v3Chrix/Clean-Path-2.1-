import {
  SALES_PRESENTATION_TOTAL_VIDEO_FRAMES,
  SALES_PRESENTATION_VIDEO_SCENES,
  SALES_PRESENTATION_VOICEOVER,
  getSlideById,
} from './salesPresentationContent.js';

export const SALES_VIDEO_FPS = 30;

export const SALES_VIDEO_ASSETS = {
  poster: '/images/clearpath/video/opening-threshold.png',
  renderedVideo: '/videos/clearpath-sales-video.mp4',
  captions: '/videos/clearpath-sales-video.vtt',
  voiceover: '/audio/clearpath-sales-voiceover.mp3',
};

export const SALES_VIDEO_STORYBOARD = SALES_PRESENTATION_VIDEO_SCENES.map((scene) => ({
  ...scene,
  purpose: 'Move the operator-facing sales story forward with buyer-ready copy.',
  painPoint: getSlideById(scene.sourceSlideId)?.painPoint || 'Operator pain point is defined in the corresponding full sales slide.',
  solution: getSlideById(scene.sourceSlideId)?.clearPathAnswer || 'ClearPath response is defined in the corresponding full sales slide.',
}));

export const SALES_VIDEO_TOTAL_FRAMES = SALES_PRESENTATION_TOTAL_VIDEO_FRAMES;

export const SALES_VIDEO_VOICEOVER = SALES_PRESENTATION_VOICEOVER;

export function getSalesVideoSceneById(id) {
  return SALES_VIDEO_STORYBOARD.find((scene) => scene.id === id);
}
