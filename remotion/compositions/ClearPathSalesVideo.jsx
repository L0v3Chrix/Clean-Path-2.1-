import { Audio } from '@remotion/media';
import {
  AbsoluteFill,
  Img,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {
  SALES_VIDEO_ASSETS,
  SALES_VIDEO_STORYBOARD,
} from '../../src/lib/salesVideoStoryboard';

function publicAsset(path) {
  return staticFile(path.replace(/^\//, ''));
}

function Scene({ scene, index }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 28, stiffness: 70 } });
  const imageScale = interpolate(frame, [0, scene.durationInFrames], [1.02, 1.08]);
  const imageOpacity = interpolate(frame, [0, 20, scene.durationInFrames - 24, scene.durationInFrames], [0, 1, 1, 0]);
  const contentY = interpolate(enter, [0, 1], [56, 0]);

  return (
    <AbsoluteFill
      style={{
        background: 'linear-gradient(135deg, #1b1712 0%, #34281e 45%, #14221d 100%)',
        color: '#fff8ea',
        fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
        overflow: 'hidden',
      }}
    >
      <Img
        src={publicAsset(scene.asset)}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          opacity: imageOpacity * 0.72,
          transform: `scale(${imageScale})`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(circle at 78% 16%, rgba(213,138,56,0.26), transparent 24%), linear-gradient(90deg, rgba(19,18,14,0.92) 0%, rgba(19,18,14,0.7) 36%, rgba(19,18,14,0.24) 100%)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 96,
          top: 88,
          width: 1040,
          opacity: imageOpacity,
          transform: `translateY(${contentY}px)`,
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 18,
            marginBottom: 34,
            color: '#f6ddad',
            fontSize: 28,
            letterSpacing: 0,
          }}
        >
          <span
            style={{
              width: 18,
              height: 18,
              borderRadius: 999,
              background: scene.accent,
              boxShadow: `0 0 42px ${scene.accent}`,
            }}
          />
          Scene {String(index + 1).padStart(2, '0')}
        </div>
        <h1
          style={{
            margin: 0,
            maxWidth: 920,
            color: '#fff8ea',
            fontFamily: 'Crimson Pro, Georgia, serif',
            fontSize: 112,
            lineHeight: 0.92,
            fontWeight: 700,
            letterSpacing: 0,
          }}
        >
          {scene.title}
        </h1>
        <p
          style={{
            marginTop: 34,
            maxWidth: 880,
            color: '#f4e4c3',
            fontSize: 40,
            lineHeight: 1.18,
            fontWeight: 500,
          }}
        >
          {scene.caption}
        </p>
      </div>
      <div
        style={{
          position: 'absolute',
          right: 92,
          bottom: 86,
          width: 510,
          padding: 34,
          border: '1px solid rgba(255,248,234,0.24)',
          borderRadius: 28,
          background: 'rgba(28,25,19,0.58)',
          backdropFilter: 'blur(18px)',
          opacity: imageOpacity,
        }}
      >
        <div style={{ color: scene.accent, fontSize: 23, fontWeight: 800, marginBottom: 14 }}>
          Pain to solution
        </div>
        <p style={{ margin: '0 0 18px', color: '#fff8ea', fontSize: 25, lineHeight: 1.22 }}>
          {scene.painPoint}
        </p>
        <p style={{ margin: 0, color: '#d9e9d0', fontSize: 25, lineHeight: 1.22 }}>
          {scene.solution}
        </p>
      </div>
    </AbsoluteFill>
  );
}

export function ClearPathSalesVideo({ includeVoiceover = false }) {
  let cursor = 0;

  return (
    <AbsoluteFill>
      {SALES_VIDEO_STORYBOARD.map((scene, index) => {
        const from = cursor;
        cursor += scene.durationInFrames;
        return (
          <Sequence key={scene.id} from={from} durationInFrames={scene.durationInFrames}>
            <Scene scene={scene} index={index} />
          </Sequence>
        );
      })}
      {includeVoiceover && <Audio src={publicAsset(SALES_VIDEO_ASSETS.voiceover)} />}
    </AbsoluteFill>
  );
}
