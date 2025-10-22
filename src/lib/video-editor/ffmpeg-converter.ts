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
  console.log('[FFmpeg] Starting conversion...');
  console.log('[FFmpeg] Input WebM size:', webmBlob.size, 'bytes');
  
  const ffmpeg = await getFFmpeg(onProgress);

  try {
    // Write WebM to FFmpeg virtual filesystem
    const webmData = new Uint8Array(await webmBlob.arrayBuffer());
    console.log('[FFmpeg] WebM data array size:', webmData.length);
    
    await ffmpeg.writeFile('input.webm', webmData);
    console.log('[FFmpeg] WebM file written to virtual filesystem');

    // Simplified conversion command - removed movflags, using faster preset
    console.log('[FFmpeg] Starting exec with simplified command...');
    await ffmpeg.exec([
      '-i', 'input.webm',
      '-c:v', 'libx264',
      '-preset', 'ultrafast',
      '-crf', '23',
      '-c:a', 'aac',
      '-b:a', '128k',
      'output.mp4'
    ]);
    console.log('[FFmpeg] Conversion completed');

    // Read MP4 from virtual filesystem
    const mp4Data = await ffmpeg.readFile('output.mp4');
    console.log('[FFmpeg] MP4 data read, size:', mp4Data.length);
    
    if (mp4Data.length === 0) {
      throw new Error('FFmpeg produced an empty MP4 file');
    }
    
    const mp4Blob = new Blob([new Uint8Array(mp4Data as Uint8Array)], { type: 'video/mp4' });
    console.log('[FFmpeg] MP4 blob created, size:', mp4Blob.size);

    // Cleanup
    await ffmpeg.deleteFile('input.webm');
    await ffmpeg.deleteFile('output.mp4');
    console.log('[FFmpeg] Cleanup completed');

    return mp4Blob;
  } catch (error) {
    console.error('[FFmpeg] Conversion error:', error);
    
    // Attempt cleanup on error
    try {
      await ffmpeg.deleteFile('input.webm');
      await ffmpeg.deleteFile('output.mp4');
    } catch (cleanupError) {
      console.error('[FFmpeg] Cleanup error:', cleanupError);
    }
    
    throw new Error(`FFmpeg conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

export const cleanupFFmpeg = () => {
  if (ffmpegInstance) {
    ffmpegInstance.terminate();
    ffmpegInstance = null;
    isLoaded = false;
    isLoading = false;
  }
};
