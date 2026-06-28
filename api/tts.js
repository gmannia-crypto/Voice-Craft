// /api/tts.js
// Server-side proxy for Fish Audio text-to-speech.
// The real API key lives ONLY in Vercel's Environment Variables (FISH_API_KEY) —
// never in this file, never in the repo, never sent to the browser.

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const FISH_API_KEY = process.env.FISH_API_KEY;
  if (!FISH_API_KEY) {
    return res.status(500).json({
      error: "Server misconfigured: FISH_API_KEY environment variable is not set in Vercel.",
    });
  }

  const {
    text,
    reference_id,
    format = "mp3",
    mp3_bitrate = 128,
    normalize = true,
    latency = "normal",
  } = req.body || {};

  if (!text || typeof text !== "string" || !text.trim()) {
    return res.status(400).json({ error: "Missing 'text' in request body." });
  }

  try {
    const fishRes = await fetch("https://api.fish.audio/v1/tts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${FISH_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text, reference_id, format, mp3_bitrate, normalize, latency }),
    });

    if (!fishRes.ok) {
      const detail = await fishRes.text();
      return res.status(fishRes.status).json({ error: "Fish Audio request failed", detail });
    }

    const arrayBuffer = await fishRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    res.setHeader("Content-Type", "audio/mpeg");
    return res.status(200).send(buffer);
  } catch (err) {
    return res.status(500).json({ error: "Unexpected server error", detail: String(err) });
  }
};
