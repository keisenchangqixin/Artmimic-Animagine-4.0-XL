import path from 'path';
import { defineConfig, loadEnv, Plugin } from 'vite';
import react from '@vitejs/plugin-react';

function apiDevServerPlugin(): Plugin {
  return {
    name: 'api-dev-server',
    configureServer(server) {
      server.middlewares.use('/api/generate-art', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: 'Method Not Allowed' }));
          return;
        }

        let bodyStr = '';
        req.on('data', chunk => { bodyStr += chunk; });
        req.on('end', async () => {
          try {
            const body = JSON.parse(bodyStr || '{}');
            const env = loadEnv(server.config.mode, process.cwd(), '');
            const apiKey = env.REPLICATE_API_KEY || process.env.REPLICATE_API_KEY;
            if (!apiKey) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'REPLICATE_API_KEY environment variable is not configured' }));
              return;
            }

            const {
              prompt,
              negative_prompt = 'lowres, bad anatomy, bad hands, text, error, missing finger, extra digits, fewer digits, cropped, worst quality, low quality, low score, bad score, average score, signature, watermark, username, blurry, nsfw, naked',
              width = 1024,
              height = 1024,
              steps = 28,
              cfg_scale = 5,
              seed = -1,
              prepend_preprompt = true
            } = body;

            const MODEL_VERSION = '057e2276ac5dcd8d1575dc37b131f903df9c10c41aed53d47cd7d4f068c19fa5';

            const startResponse = await fetch('https://api.replicate.com/v1/predictions', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                version: MODEL_VERSION,
                input: {
                  prompt,
                  negative_prompt,
                  width: Number(width),
                  height: Number(height),
                  steps: Number(steps),
                  cfg_scale: Number(cfg_scale),
                  seed: Number(seed),
                  prepend_preprompt: Boolean(prepend_preprompt)
                }
              })
            });

            if (!startResponse.ok) {
              const errText = await startResponse.text();
              res.statusCode = startResponse.status;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: `Replicate API error: ${errText}` }));
              return;
            }

            let prediction = await startResponse.json();
            let attempt = 0;

            while (prediction.status !== 'succeeded' && prediction.status !== 'failed' && attempt < 60) {
              await new Promise(r => setTimeout(r, 2000));
              attempt++;

              const checkResponse = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
                headers: { 'Authorization': `Bearer ${apiKey}` }
              });

              if (!checkResponse.ok) {
                throw new Error(`Failed status check: ${checkResponse.statusText}`);
              }
              prediction = await checkResponse.json();
            }

            if (prediction.status !== 'succeeded') {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: prediction.error || 'Generation failed' }));
              return;
            }

            const imageUrl = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
            const imgResponse = await fetch(imageUrl);
            const arrayBuffer = await imgResponse.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            const mimeType = imgResponse.headers.get('content-type') || 'image/png';
            const base64Data = `data:${mimeType};base64,${buffer.toString('base64')}`;

            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ image: base64Data, rawUrl: imageUrl }));
          } catch (err: any) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: err.message || 'Internal server error' }));
          }
        });
      });
    }
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [react(), apiDevServerPlugin()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.REPLICATE_API_KEY': JSON.stringify(env.REPLICATE_API_KEY)
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});
