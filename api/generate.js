export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { image, prompt } = req.body;
  if (!image || !prompt) {
    return res.status(400).json({ error: 'Missing image or prompt' });
  }

  try {
    // Stap 1: Start de prediction
    const createRes = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.REPLICATE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        version: "76604baddc85b1b4616e1c6475eca080da339c8875bd4996705440484a6eac38",
        input: {
          image: `data:image/jpeg;base64,${image}`,
          prompt: prompt,
          negative_prompt: 'ugly, bad quality, blurry, distorted',
          guidance_scale: 15,
          prompt_strength: 0.8,
          num_inference_steps: 30
        }
      })
    });

    const prediction = await createRes.json();

    // Stuur volledige response terug als er geen ID is — helpt debuggen
    if (!prediction.id) {
      return res.status(500).json({ 
        error: 'No prediction ID', 
        detail: JSON.stringify(prediction) 
      });
    }

    // Stap 2: Poll totdat het klaar is (max 60 seconden)
    let result = null;
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 2000));

      const pollRes = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
        headers: {
          'Authorization': `Bearer ${process.env.REPLICATE_API_TOKEN}`,
        }
      });

      const pollData = await pollRes.json();

      if (pollData.status === 'succeeded') {
        result = Array.isArray(pollData.output) ? pollData.output[0] : pollData.output;
        break;
      } else if (pollData.status === 'failed') {
        throw new Error('Model failed: ' + pollData.error);
      }
    }

    if (!result) throw new Error('Timeout — model duurde te lang');

    // Stap 3: Haal afbeelding op en stuur als base64
    const imgRes = await fetch(result);
    const buffer = await imgRes.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');

    return res.status(200).json({ result: base64 });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
