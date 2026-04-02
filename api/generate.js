export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { image, prompt } = req.body;
  if (!image || !prompt) {
    return res.status(400).json({ error: 'Missing image or prompt' });
  }

  try {
    const createRes = await fetch('https://api.replicate.com/v1/models/adirik/interior-design/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.REPLICATE_API_TOKEN}`,
        'Content-Type': 'application/json',
        'Prefer': 'wait'
      },
      body: JSON.stringify({
        input: {
          image: `data:image/jpeg;base64,${image}`,
          prompt: prompt,
          negative_prompt: 'ugly, bad quality, blurry, distorted, unrealistic',
          guidance_scale: 15,
          prompt_strength: 0.8,
          num_inference_steps: 50
        }
      })
    });

    const prediction = await createRes.json();

    if (prediction.error) throw new Error(prediction.error);

    const outputUrl = prediction.output?.[0] || prediction.output;
    if (!outputUrl) throw new Error('No output from model');

    const imgRes = await fetch(outputUrl);
    const buffer = await imgRes.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');

    return res.status(200).json({ result: base64 });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
