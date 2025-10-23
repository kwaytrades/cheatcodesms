import { renderMedia, selectComposition } from "@remotion/renderer";
import { bundle } from "@remotion/bundler";
import { Overlay } from "@/lib/video-editor/types";
import { prepareCompositionData } from "@/lib/video-editor/remotion-adapter";
import { COMP_NAME } from "@/lib/video-editor/constants";

export interface RenderProgress {
  progress: number;
  message: string;
}

export const useRemotionRender = () => {
  const renderVideo = async (
    overlays: Overlay[],
    durationInFrames: number,
    fps: number,
    dimensions: { width: number; height: number },
    onProgress: (progress: RenderProgress) => void
  ): Promise<Blob> => {
    console.log('[Remotion] Starting render with dimensions:', dimensions);
    
    // Step 1: Bundle the Remotion composition
    onProgress({ progress: 5, message: "Preparing composition..." });
    
    const bundleLocation = await bundle({
      entryPoint: "/src/remotion/Root.tsx",
      onProgress: (prog) => {
        const bundleProgress = 5 + (prog * 15);
        onProgress({ 
          progress: Math.round(bundleProgress), 
          message: "Bundling composition..." 
        });
      },
    });

    console.log('[Remotion] Bundle created at:', bundleLocation);

    // Step 2: Prepare composition data
    const compositionData = prepareCompositionData(
      overlays,
      durationInFrames,
      fps,
      dimensions.width,
      dimensions.height
    );

    onProgress({ progress: 20, message: "Starting render..." });

    // Step 3: Select the composition
    const composition = await selectComposition({
      serveUrl: bundleLocation,
      id: COMP_NAME,
      inputProps: {
        overlays: compositionData.overlays,
        durationInFrames,
        fps,
        width: dimensions.width,
        height: dimensions.height,
        setSelectedOverlayId: () => {},
        selectedOverlayId: null,
        changeOverlay: () => {},
      },
    });

    console.log('[Remotion] Composition selected:', composition.id);

    // Step 4: Render the video
    const outputLocation = await renderMedia({
      composition,
      serveUrl: bundleLocation,
      codec: "h264",
      outputLocation: `out/${Date.now()}.mp4`,
      inputProps: {
        overlays: compositionData.overlays,
        durationInFrames,
        fps,
        width: dimensions.width,
        height: dimensions.height,
        setSelectedOverlayId: () => {},
        selectedOverlayId: null,
        changeOverlay: () => {},
      },
      onProgress: ({ progress, renderedFrames }) => {
        const renderProgress = 20 + (progress * 70);
        console.log(`[Remotion] Rendering: ${Math.round(progress * 100)}% (${renderedFrames}/${durationInFrames} frames)`);
        onProgress({ 
          progress: Math.round(renderProgress), 
          message: `Rendering frame ${renderedFrames}/${durationInFrames}...` 
        });
      },
    });

    console.log('[Remotion] Video rendered at:', outputLocation);
    
    onProgress({ progress: 95, message: "Converting to blob..." });

    // Step 5: Read the file and convert to Blob
    const response = await fetch(`file://${outputLocation}`);
    const blob = await response.blob();
    
    console.log('[Remotion] Render complete, blob size:', blob.size, 'bytes');
    
    return blob;
  };

  return { renderVideo };
};
