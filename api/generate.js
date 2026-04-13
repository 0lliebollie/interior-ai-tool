export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { image, prompt } = req.body;
  if (!image || !prompt) {
    return res.status(400).json({ error: 'Missing image or prompt' });
  }

  try {
    // Stap 1: Zet base64 om naar een buffer en upload naar HF Space
    const imageBuffer = Buffer.from(image, 'base64');
    const blob = new Blob([imageBuffer], { type: 'image/jpeg' });

    const formData = new FormData();
    formData.append('files', blob, 'render.jpg');

    const uploadRes = await fetch('https://adin019-interior-ai-backend.hf.space/upload', {
      method: 'POST',
      body: formData,
    });

    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      throw new Error('Upload mislukt: ' + errText.substring(0, 200));
    }

    const uploadData = await uploadRes.json();
    const uploadedPath = uploadData?.[0];
    if (!uploadedPath) throw new Error('Geen pad terug van upload: ' + JSON.stringify(uploadData));

    // Stap 2: Roep de generate functie aan met het geüploade pad
    const predictRes = await fetch('https://adin019-interior-ai-backend.hf.space/run/predict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fn_index: 0,
        data: [
          { path: uploadedPath, type: 'filepath' },
          prompt
        ]
      })
    });

    if (!predictRes.ok) {
      const errText = await predictRes.text();
      throw new Error('Predict mislukt: ' + errText.substring(0, 200));
    }

    const predictData = await predictRes.json();
    const output = predictData?.data?.[0];

    if (!output) {
      throw new Error('Geen output: ' + JSON.stringify(predictData).substring(0, 300));
    }

    // Stap 3: Haal resultaat op en stuur als base64
    const outputUrl = output?.url || output?.path || output;
    const fullUrl = outputUrl.startsWith('http')
      ? outputUrl
      : `https://adin019-interior-ai-backend.hf.space/file=${outputUrl}`;

    const imgRes = await fetch(fullUrl);
    const buffer = await imgRes.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');

    return res.status(200).json({ result: base64 });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
