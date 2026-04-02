export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { image, prompt } = req.body;
  if (!image || !prompt) {
    return res.status(400).json({ error: 'Missing image or prompt' });
  }

  try {
    const response = await fetch('https://adin019-interior-ai-backend.hf.space/run/predict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: [
          { path: `data:image/jpeg;base64,${image}`, type: 'image' },
          prompt
        ]
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error('Space fout: ' + errText.substring(0, 300));
    }

    const result = await response.json();

    const output = result?.data?.[0];
    if (!output) {
      throw new Error('Geen output. Volledige response: ' + JSON.stringify(result).substring(0, 300));
    }

    // Output kan base64 of een URL zijn
    let base64;
    if (typeof output === 'string' && output.startsWith('data:')) {
      base64 = output.split(',')[1];
    } else if (output?.url) {
      const imgRes = await fetch(output.url);
      const buffer = await imgRes.arrayBuffer();
      base64 = Buffer.from(buffer).toString('base64');
    } else if (typeof output === 'string' && output.startsWith('http')) {
      const imgRes = await fetch(output);
      const buffer = await imgRes.arrayBuffer();
      base64 = Buffer.from(buffer).toString('base64');
    } else {
      throw new Error('Onbekend output formaat: ' + JSON.stringify(output).substring(0, 200));
    }

    return res.status(200).json({ result: base
