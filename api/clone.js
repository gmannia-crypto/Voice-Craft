// /api/clone.js
// Server-side proxy for creating a real Fish Audio voice model (clone).
// Accepts JSON: { title, description, audio_base64, filename, mime_type }
// Forwards the audio to Fish Audio's POST /model endpoint and returns the new voice id.
// FISH_API_KEY lives only in Vercel's Environment Variables — never in this file.

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const FISH_API_KEY = process.env.FISH_API_KEY;
  if (!FISH_API_KEY) {
    return res.status(500).json({ error: "Server misconfigured: FISH_API_KEY is not set." });
  }

  const {
    title,
    description = "",
    audio_base64,
    filename = "sample.wav",
    mime_type = "audio/wav",
  } = req.body || {};

  if (!title || !audio_base64) {
    return res.status(400).json({ error: "Missing 'title' or 'audio_base64' in request body." });
  }

  try {
    const audioBuffer = Buffer.from(audio_base64, "base64");
    const audioBlob = new Blob([audioBuffer], { type: mime_type });

    const form = new FormData();
    form.append("title", title);
    form.append("description", description);
    form.append("visibility", "private");
    form.append("train_mode", "fast");
    form.append("voices", audioBlob, filename);

    const createRes = await fetch("https://api.fish.audio/model", {
      method: "POST",
      headers: { Authorization: `Bearer ${FISH_API_KEY}` },
      body: form,
    });

    const created = await createRes.json();

    if (!createRes.ok) {
      return res.status(createRes.status).json({ error: "Fish Audio clone request failed", detail: created });
    }

    // "fast" train mode is usually ready almost immediately — poll briefly so the
    // client gets back a voice that's actually usable, not just "created".
    let state = created.state;
    const modelId = created._id;

    for (let i = 0; i < 4 && state !== "trained" && state !== "failed"; i++) {
      await new Promise(r => setTimeout(r, 1500));
      const checkRes = await fetch(`https://api.fish.audio/model/${modelId}`, {
        headers: { Authorization: `Bearer ${FISH_API_KEY}` },
      });
      if (checkRes.ok) {
        const checked = await checkRes.json();
        state = checked.state;
      }
    }

    return res.status(200).json({ id: modelId, state, title: created.title });
  } catch (err) {
    return res.status(500).json({ error: "Unexpected server error", detail: String(err) });
  }
};
