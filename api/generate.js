export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { image, prompt } = req.body;
  if (!image || !prompt) {
    return res.status(400).json({ error: 'Missing image or prompt' });
  }

  const SPACE_URL = 'https://adin019-interior-ai-backend.hf.space';

  try {
    // Stap 1: Upload afbeelding naar de Space
    const imageBuffer = Buffer.from(image, 'base64');
    const formData = new FormData();
    const blob = new Blob([imageBuffer], { type: 'image/jpeg' });
    formData.append('files', blob, 'render.jpg');

    const uploadRes = await fetch(`${SPACE_URL}/gradio_api/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      throw new Error('Upload mislukt: ' + errText.substring(0, 200));
    }

    const uploadData = await uploadRes.json();
    const uploadedPath = uploadData?.[0];
    if (!uploadedPath) throw new Error('Geen pad terug van upload');

    // Stap 2: Start de generate job
    const startRes = await fetch(`${SPACE_URL}/gradio_api/call/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: [
          { path: uploadedPath },
          prompt
        ]
      })
    });

    if (!startRes.ok) {
      const errText = await startRes.text();
      throw new Error('Start mislukt: ' + errText.substring(0, 200));
    }

    const startData = await startRes.json();
    const eventId = startData?.event_id;
    if (!eventId) throw new Error('Geen event_id: ' + JSON.stringify(startData));

    // Stap 3: Poll het resultaat op
    let resultUrl = null;
    for (let i = 0; i < 60; i++) {
      await new Promise(r => setTimeout(r, 3000));

      const pollRes = await fetch(`${SPACE_URL}/gradio_api/call/generate/${eventId}`);
      const text = await pollRes.text();

      // Gradio stuurt SSE events terug
      const lines = text.split('\n');
      for (const line of lines) {
        if (line.startsWith('data:')) {
          const data = JSON.parse(line.slice(5).trim());
          if (Array.isArray(data) && data[0]) {
            const output = data[0];
            resultUrl = output?.url || output?.path || (typeof output === 'string' ? output : null);
            if (resultUrl) break;
          }
        }
      }
      if (resultUrl) break;
    }

    if (!resultUrl) throw new Error('Timeout — geen resultaat ontvangen');

    // Stap 4: Haal afbeelding op en stuur als base64
    const fullUrl = resultUrl.startsWith('http')
      ? resultUrl
      : `${SPACE_URL}/gradio_api/file=${resultUrl}`;

    const imgRes = await fetch(fullUrl);
    const buffer = await imgRes.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');

    return res.status(200).json({ result: base64 });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
