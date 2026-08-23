import type { IncomingMessage, ServerResponse } from 'http';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  const apiKey = process.env.REPLICATE_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'REPLICATE_API_KEY environment variable is not configured' });
    return;
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      body = JSON.parse(body);
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
    } = body || {};

    if (!prompt) {
      res.status(400).json({ error: 'Prompt is required' });
      return;
    }

    // Animagine XL 4.0 model version on Replicate (aisha-ai-official/animagine-xl-4.0)
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
      const errorText = await startResponse.text();
      res.status(startResponse.status).json({ error: `Replicate API error: ${errorText}` });
      return;
    }

    let prediction = await startResponse.json();

    // Poll until complete
    const maxAttempts = 60; // Up to 2 minutes
    let attempt = 0;

    while (prediction.status !== 'succeeded' && prediction.status !== 'failed' && attempt < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      attempt++;

      const checkResponse = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      });

      if (!checkResponse.ok) {
        throw new Error(`Failed to check prediction status: ${checkResponse.statusText}`);
      }

      prediction = await checkResponse.json();
    }

    if (prediction.status !== 'succeeded') {
      res.status(500).json({ error: prediction.error || 'Image generation failed on Replicate.' });
      return;
    }

    const imageUrl = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
    if (!imageUrl) {
      res.status(500).json({ error: 'No image URL returned from Replicate.' });
      return;
    }

    // Fetch image data and convert to base64
    const imgResponse = await fetch(imageUrl);
    if (!imgResponse.ok) {
      throw new Error(`Failed to fetch output image from ${imageUrl}`);
    }

    const arrayBuffer = await imgResponse.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const mimeType = imgResponse.headers.get('content-type') || 'image/png';
    const base64Data = `data:${mimeType};base64,${buffer.toString('base64')}`;

    res.status(200).json({ image: base64Data, rawUrl: imageUrl });
  } catch (error: any) {
    console.error('Error in /api/generate-art:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
