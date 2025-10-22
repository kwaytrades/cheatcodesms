import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Building Remotion bundle...');

    // Create a minimal Remotion bundle as an HTML page
    // This serves as the serveUrl for Remotion Cloud
    const bundleHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Remotion Bundle</title>
</head>
<body>
  <div id="root"></div>
  <script type="module">
    // Import Remotion from CDN
    import { Composition } from 'https://esm.sh/remotion@4.0.364';
    import { AbsoluteFill, Sequence, Video, Audio, Img } from 'https://esm.sh/remotion@4.0.364';
    import React from 'https://esm.sh/react@18.3.1';
    import ReactDOM from 'https://esm.sh/react-dom@18.3.1/client';

    // Layer component - renders individual overlays
    const LayerContent = ({ overlay }) => {
      if (overlay.type === 'video') {
        return React.createElement(Video, {
          src: overlay.src,
          style: { width: '100%', height: '100%', objectFit: 'cover' }
        });
      }
      if (overlay.type === 'image') {
        return React.createElement(Img, {
          src: overlay.src,
          style: { width: '100%', height: '100%', objectFit: 'cover' }
        });
      }
      if (overlay.type === 'text') {
        return React.createElement('div', {
          style: {
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: overlay.fontSize || 48,
            fontWeight: overlay.fontWeight || 'bold',
            color: overlay.color || '#ffffff',
            textAlign: 'center',
            padding: '20px'
          }
        }, overlay.text);
      }
      if (overlay.type === 'sound') {
        return React.createElement(Audio, { src: overlay.src });
      }
      return null;
    };

    // Layer wrapper component
    const Layer = ({ overlay }) => {
      const style = {
        position: 'absolute',
        left: overlay.left,
        top: overlay.top,
        width: overlay.width,
        height: overlay.height,
        transform: \`rotate(\${overlay.rotation || 0}deg)\`,
        transformOrigin: 'center center',
        zIndex: (overlay.row || 0) * 10
      };

      if (overlay.type === 'sound') {
        return React.createElement(Sequence, {
          from: overlay.from,
          durationInFrames: overlay.durationInFrames
        }, React.createElement(LayerContent, { overlay }));
      }

      return React.createElement(Sequence, {
        from: overlay.from,
        durationInFrames: overlay.durationInFrames,
        layout: 'none'
      }, React.createElement('div', { style }, React.createElement(LayerContent, { overlay })));
    };

    // Main composition component
    const Main = ({ overlays }) => {
      return React.createElement(AbsoluteFill, {
        style: { backgroundColor: '#111827' }
      }, overlays.map((overlay) => 
        React.createElement(Layer, { key: overlay.id, overlay })
      ));
    };

    // Root component with composition registration
    const RemotionRoot = () => {
      return React.createElement(React.Fragment, null,
        React.createElement(Composition, {
          id: 'Main',
          component: Main,
          durationInFrames: 900,
          fps: 30,
          width: 1920,
          height: 1080,
          defaultProps: {
            overlays: []
          },
          calculateMetadata: async ({ props }) => ({
            durationInFrames: props.durationInFrames || 900,
            width: props.width || 1920,
            height: props.height || 1080
          })
        })
      );
    };

    // Mount the app
    const root = ReactDOM.createRoot(document.getElementById('root'));
    root.render(React.createElement(RemotionRoot));
  </script>
</body>
</html>`;

    // Upload bundle to Supabase Storage
    const fileName = 'remotion-bundle.html';
    const { data: uploadData, error: uploadError } = await supabaseClient
      .storage
      .from('remotion-bundles')
      .upload(fileName, bundleHtml, {
        contentType: 'text/html',
        upsert: true,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      throw new Error(`Failed to upload bundle: ${uploadError.message}`);
    }

    // Get public URL
    const { data: { publicUrl } } = supabaseClient
      .storage
      .from('remotion-bundles')
      .getPublicUrl(fileName);

    console.log('Bundle uploaded successfully:', publicUrl);

    return new Response(
      JSON.stringify({ success: true, bundleUrl: publicUrl }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error building bundle:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
