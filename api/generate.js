export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { image, prompt } = req.body;
  if (!image || !prompt) {
    return res.status(400).json({ error: 'Missing image or prompt' });
  }

  try {
    const fullPrompt = `interior design, ${prompt}, photorealistic, high quality, beautiful furniture, professional photography`;

    const response = await fetch('https://modelslab.com/api/v6/image_editing/img2img', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key: process.env.MODELSLAB_API_KEY,
        prompt: fullPrompt,
        negative_prompt: 'ugly, blurry, bad quality, distorted, different room layout, changed walls',
        init_image: `data:image/jpeg;base64,${image}`,
        strength: 0.5,
        guidance_scale: 7.5,
        samples: 1,
        steps: 20,
        seed: null,
        webhook: null,
        track_id: null
      })
    });

    const data = await response.json();

    if (data.status === 'error') {
      throw new Error('ModelsLab fout: ' + data.message);
    }

    // Als hij nog processing is, poll dan
    if (data.status === 'processing') {
      await new Promise(r => setTimeout(r, 10000));
      const pollRes = await fetch('https://modelslab.com/api/v6/image_editing/fetch/' + data.id, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: process.env.MODELSLAB_API_KEY })
      });
      const pollData = await pollRes.json();
      const imgUrl = pollData.output?.[0];
      if (!imgUrl) throw new Error('Geen output na polling');
      const imgRes = await fetch(imgUrl);
      const buffer = await imgRes.arrayBuffer();
      const base64 = Buffer.from(buffer).toString('base64');
      return res.status(200).json({ result: base64 });
    }

    const imgUrl = data.output?.[0];
    if (!imgUrl) throw new Error('Geen output: ' + JSON.stringify(data).substring(0, 200));

    const imgRes = await fetch(imgUrl);
    const buffer = await imgRes.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');

    return res.status(200).json({ result: base64 });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
