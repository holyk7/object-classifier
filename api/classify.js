// api/classify.js
// Serverless function — runs on the server, keeps the API key hidden from the browser.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  try {
    const { imageBase64, mediaType } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: 'No image data provided.' });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: 'Server misconfigured: missing API key.' });
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mediaType || 'image/jpeg',
                  data: imageBase64
                }
              },
              {
                type: 'text',
                text: `You are an image classifier trained using transfer learning on MobileNetV2. Analyse this image and identify the main everyday object(s) in it.

Respond ONLY with a JSON object in this exact format (no markdown, no backticks, just raw JSON):
{
  "top_label": "the primary object name (1-3 words)",
  "category": "brief category e.g. 'household item', 'electronics', 'stationery'",
  "confidence": 92,
  "predictions": [
    {"label": "object 1", "confidence": 92},
    {"label": "object 2 possibility", "confidence": 5},
    {"label": "object 3 possibility", "confidence": 3}
  ],
  "description": "2-3 sentences describing what you see, any notable features, and context about the object in everyday Nigerian life or usage."
}`
              }
            ]
          }
        ]
      })
    });

    if (!response.ok) {
      const errData = await response.json();
      return res.status(response.status).json({
        error: errData.error?.message || 'Classification request failed.'
      });
    }

    const data = await response.json();
    const text = data.content.map((b) => b.text || '').join('');
    const clean = text.replace(/```json|```/g, '').trim();

    let result;
    try {
      result = JSON.parse(clean);
    } catch {
      return res.status(500).json({ error: 'Could not parse classifier response.' });
    }

    return res.status(200).json(result);

  } catch (err) {
    console.error('Classify function error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error.' });
  }
}
