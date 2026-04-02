export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { image, prompt } = req.body;

  if (!image || !prompt) {
    return res.status(400).json({ error: 'Missing image or prompt' });
  }

  try {
    const response = await fetch(
      'https://router.huggingface.co/hf-inference/models/stabilityai/stable-diffusion-2-inpainting',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.HF_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: prompt,
          parameters: {
            image: image,
            num_inference_steps: 30,
            guidance_scale: 7.5,
            strength: 0.75,
          }
        })
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`HuggingFace error: ${errText}`);
    }

    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');

    return res.status(200).json({ result: base64 });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
