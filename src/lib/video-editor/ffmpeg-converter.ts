import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';

let ffmpegInstance: FFmpeg | null = null;
let isLoading = false;
let isLoaded = false;

export const getFFmpeg = async (
  onProgress?: (progress: number) => void
): Promise<FFmpeg> => {
  if (ffmpegInstance && isLoaded) {
    return ffmpegInstance;
  }

  if (isLoading) {
    // Wait for current loading to finish
    while (!isLoaded) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return ffmpegInstance!;
  }

  isLoading = true;
  ffmpegInstance = new FFmpeg();

  // Setup progress logging
  ffmpegInstance.on('log', ({ message }) => {
    console.log('FFmpeg:', message);
  });

  if (onProgress) {
    ffmpegInstance.on('progress', ({ progress }) => {
      onProgress(progress * 100);
    });
  }

  try {
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
    
    // Load FFmpeg core files
    await ffmpegInstance.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    });

    isLoaded = true;
    isLoading = false;
    return ffmpegInstance;
  } catch (error) {
    isLoading = false;
    isLoaded = false;
    ffmpegInstance = null;
    throw error;
  }
};

export const convertWebMToMP4 = async (
  webmBlob: Blob,
  onProgress?: (progress: number) => void
): Promise<Blob> => {
  const ffmpeg = await getFFmpeg(onProgress);

  // Write WebM to FFmpeg virtual filesystem
  const webmData = new Uint8Array(await webmBlob.arrayBuffer());
  await ffmpeg.writeFile('input.webm', webmData);

  // Convert to MP4 with H.264 codec
  await ffmpeg.exec([
    '-i', 'input.webm',
    '-c:v', 'libx264',
    '-preset', 'medium',
    '-crf', '23',
    '-c:a', 'aac',
    '-movflags', '+faststart',
    'output.mp4'
  ]);

  // Read MP4 from virtual filesystem
  const mp4Data = await ffmpeg.readFile('output.mp4');
  const mp4Blob = new Blob([new Uint8Array(mp4Data as Uint8Array)], { type: 'video/mp4' });

  // Cleanup
  await ffmpeg.deleteFile('input.webm');
  await ffmpeg.deleteFile('output.mp4');

  return mp4Blob;
};

export const cleanupFFmpeg = () => {
  if (ffmpegInstance) {
    ffmpegInstance.terminate();
    ffmpegInstance = null;
    isLoaded = false;
    isLoading = false;
  }
};
