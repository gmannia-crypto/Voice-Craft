// /api/voices.js
// Lets you search Fish Audio's voice library right from your browser, e.g.:
//   https://your-site.vercel.app/api/voices?q=deep%20narrator
// Returns a simplified list of real voice IDs you can copy into the VOICES array
// in index.html. Read-only — does not create or modify anything.

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const FISH_API_KEY = process.env.FISH_API_KEY;
  if (!FISH_API_KEY) {
    return res.status(500).json({ error: "Server misconfigured: FISH_API_KEY is not set." });
  }

  const q = (req.query && req.query.q) || "";
  const params = new URLSearchParams({
    page_size: "15",
    sort_by: "score",
  });
  if (q) params.set("title", q);

  try {
    const fishRes = await fetch(`https://api.fish.audio/model?${params.toString()}`, {
      headers: { Authorization: `Bearer ${FISH_API_KEY}` },
    });
    const data = await fishRes.json();

    if (!fishRes.ok) {
      return res.status(fishRes.status).json({ error: "Fish Audio request failed", detail: data });
    }

    const simplified = (data.items || []).map(v => ({
      id: v._id,
      title: v.title,
      tags: v.tags,
      languages: v.languages,
      visibility: v.visibility,
    }));

    return res.status(200).json({ total: data.total, voices: simplified });
  } catch (err) {
    return res.status(500).json({ error: "Unexpected server error", detail: String(err) });
  }
};
