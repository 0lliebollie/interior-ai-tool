export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { image, prompt } = req.body;
  if (!image || !prompt) {
    return res.status(400).json({ error: 'Missing image or prompt' });
  }

  try {
    // Stap 1: Roep de Gradio Space aan
    const predictRes = await fetch('https://broyang-interior-ai-designer.hf.space/run/predict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: [
          { data: `data:image/jpeg;base64,${image}`, type: 'image' },
          prompt
        ]
      })
    });

    if (!predictRes.ok) {
      const errText = await predictRes.text();
      throw new Error('Space fout: ' + errText);
    }

    const predictData = await predictRes.json();

    // Debug: stuur volledige response terug als er geen output is
    const output = predictData?.data?.[0];
    if (!output) {
      throw new Error('Geen output. Response was: ' + JSON.stringify(predictData).substring(0, 300));
    }

    // Output kan een URL of base64 zijn
    let base64;
    if (typeof output === 'string' && output.startsWith('data:')) {
      base64 = output.split(',')[1];
    } else if (typeof output === 'string' && output.startsWith('http')) {
      const imgRes = await fetch(output);
      const buffer = await imgRes.arrayBuffer();
      base64 = Buffer.from(buffer).toString('base64');
    } else if (output?.url) {
      const imgRes = await fetch(output.url);
      const buffer = await imgRes.arrayBuffer();
      base64 = Buffer.from(buffer).toString('base64');
    } else {
      throw new Error('Onbekend output formaat: ' + JSON.stringify(output).substring(0, 200));
    }

    return res.status(200).json({ result: base64 });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
