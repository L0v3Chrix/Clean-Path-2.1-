import { Composition } from 'remotion';
import {
  SALES_VIDEO_FPS,
  SALES_VIDEO_TOTAL_FRAMES,
} from '../src/lib/salesVideoStoryboard';
import { ClearPathSalesVideo } from './compositions/ClearPathSalesVideo';

export function RemotionRoot() {
  return (
    <Composition
      id="ClearPathSalesVideo"
      component={ClearPathSalesVideo}
      durationInFrames={SALES_VIDEO_TOTAL_FRAMES}
      fps={SALES_VIDEO_FPS}
      width={1920}
      height={1080}
      defaultProps={{ includeVoiceover: false }}
    />
  );
}
