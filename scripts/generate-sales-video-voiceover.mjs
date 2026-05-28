import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import {
  SALES_VIDEO_FPS,
  SALES_VIDEO_STORYBOARD,
  SALES_VIDEO_VOICEOVER,
} from '../src/lib/salesVideoStoryboard.js';

const outputAudio = resolve('public/audio/clearpath-sales-voiceover.mp3');
const intermediateAudio = resolve('public/audio/clearpath-sales-voiceover.aiff');
const outputCaptions = resolve('public/videos/clearpath-sales-video.vtt');
const outputTranscript = resolve('public/videos/clearpath-sales-video-transcript.txt');

function formatTimestamp(frame) {
  const totalMilliseconds = Math.round((frame / SALES_VIDEO_FPS) * 1000);
  const milliseconds = String(totalMilliseconds % 1000).padStart(3, '0');
  const totalSeconds = Math.floor(totalMilliseconds / 1000);
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = String(totalMinutes % 60).padStart(2, '0');
  const hours = String(Math.floor(totalMinutes / 60)).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}.${milliseconds}`;
}

function createCaptions() {
  let cursor = 0;
  const cues = SALES_VIDEO_STORYBOARD.map((scene, index) => {
    const start = formatTimestamp(cursor);
    cursor += scene.durationInFrames;
    const end = formatTimestamp(cursor);
    return `${index + 1}\n${start} --> ${end}\n${scene.caption}`;
  });

  return `WEBVTT\n\n${cues.join('\n\n')}\n`;
}

mkdirSync(dirname(outputAudio), { recursive: true });
mkdirSync(dirname(outputCaptions), { recursive: true });
writeFileSync(outputCaptions, createCaptions());
writeFileSync(outputTranscript, `${SALES_VIDEO_VOICEOVER}\n`);

if (!process.env.OPENAI_API_KEY) {
  execFileSync('say', [
    '-v',
    process.env.CLEARPATH_LOCAL_TTS_VOICE || 'Daniel',
    '-r',
    process.env.CLEARPATH_LOCAL_TTS_RATE || '152',
    '-f',
    outputTranscript,
    '-o',
    intermediateAudio,
  ]);
  execFileSync('ffmpeg', [
    '-y',
    '-i',
    intermediateAudio,
    '-filter:a',
    `atempo=${process.env.CLEARPATH_LOCAL_TTS_SPEED || '1.2'}`,
    '-codec:a',
    'libmp3lame',
    '-q:a',
    '3',
    outputAudio,
  ], { stdio: 'ignore' });
  if (existsSync(intermediateAudio)) unlinkSync(intermediateAudio);
  console.log(`Wrote local TTS voice-over ${outputAudio} at ${process.env.CLEARPATH_LOCAL_TTS_SPEED || '1.2'}x. Set OPENAI_API_KEY later for OpenAI TTS.`);
  process.exit(0);
}

const response = await fetch('https://api.openai.com/v1/audio/speech', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: process.env.CLEARPATH_TTS_MODEL || 'gpt-4o-mini-tts',
    voice: process.env.CLEARPATH_TTS_VOICE || 'alloy',
    input: SALES_VIDEO_VOICEOVER,
    instructions:
      'Warm, calm, confident sales narration for recovery residence operators. Professional and human, with measured pacing.',
  }),
});

if (!response.ok) {
  const body = await response.text();
  throw new Error(`OpenAI TTS request failed: ${response.status} ${body}`);
}

const audioBuffer = Buffer.from(await response.arrayBuffer());
writeFileSync(outputAudio, audioBuffer);
console.log(`Wrote ${outputAudio}`);
