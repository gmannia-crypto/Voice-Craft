 import { useState, useRef, useEffect } from "react";

// ── CONFIG (move to environment variables before deploying) ──
const STRIPE_PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || "pk_live_51SzSN8PJxaCKSSfpCy3dDAEasfCrD4WBM3uAeNzybq1zL8loJeneG0ltgNazVcv8sXhBRmW2pDq6wEwYTftL5NDI00RoTLOlyx";
const FISH_API_KEY = import.meta.env.VITE_FISH_API_KEY || "YOUR_NEW_FISH_AUDIO_KEY";

const PRICE_IDS = {
  creator: "price_1TXtDwPJxaCKSSfpeZ89JTej", // $4.99/month
  studio:  "price_1TXtIgPJxaCKSSfpkdzNRODQ", // $9.99/month
};

const VOICES = [
  { id: "narrator_deep", name: "Atlas",  desc: "Deep cinematic narrator",    tag: "Narrator", color: "#ff6b35" },
  { id: "villain_cold",  name: "Vex",    desc: "Cold, calculating antagonist",tag: "Villain",  color: "#9b5de5" },
  { id: "hero_warm",     name: "Blaze",  desc: "Warm heroic protagonist",     tag: "Hero",     color: "#00bbf9" },
  { id: "mystic_ancient",name: "Oracle", desc: "Ancient mystical voice",      tag: "Mystic",   color: "#fee440" },
  { id: "child_bright",  name: "Pip",    desc: "Bright, curious youth",       tag: "Youth",    color: "#f15bb5" },
  { id: "elder_wise",    name: "Sage",   desc: "Wise elder storyteller",      tag: "Elder",    color: "#00f5d4" },
];

const PLANS = [
  {
    id: "spark",
    name: "Spark",
    price: "Free",
    credits: 3,
    desc: "3 stories/month",
    color: "#555",
    features: ["3 story generations/month", "6 built-in voices", "Basic speed", "Web access"],
  },
  {
    id: "creator",
    priceId: PRICE_IDS.creator,
    name: "Creator",
    price: "$4.99",
    credits: 50,
    desc: "50 stories/month",
    color: "#ff6b35",
    features: ["50 story generations/month", "All built-in voices", "Voice cloning (3 voices)", "Standard speed"],
  },
  {
    id: "studio",
    priceId: PRICE_IDS.studio,
    name: "Studio",
    price: "$9.99",
    credits: 9999,
    desc: "Unlimited stories",
    color: "#9b5de5",
    popular: true,
    features: ["Unlimited story generations", "All built-in voices", "Unlimited voice cloning", "Priority speed"],
  },
];

// Load Stripe.js dynamically
function loadStripe(key) {
  return new Promise((resolve) => {
    if (window.Stripe) return resolve(window.Stripe(key));
    const script = document.createElement("script");
    script.src = "https://js.stripe.com/v3/";
    script.onload = () => resolve(window.Stripe(key));
    document.head.appendChild(script);
  });
}

export default function VoiceCraft() {
  const [text, setText]               = useState("");
  const [selectedVoice, setSelectedVoice] = useState(VOICES[0]);
  const [isGenerating, setIsGenerating]   = useState(false);
  const [audioUrl, setAudioUrl]           = useState(null);
  const [activeTab, setActiveTab]         = useState("studio");
  const [cloneName, setCloneName]         = useState("");
  const [uploadedFile, setUploadedFile]   = useState(null);
  const [isCloning, setIsCloning]         = useState(false);
  const [cloneSuccess, setCloneSuccess]   = useState(false);
  const [credits, setCredits]             = useState(3);
  const [userVoices, setUserVoices]       = useState([]);
  const [waveActive, setWaveActive]       = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(null);
  const [toast, setToast]                 = useState(null);
  const fileInputRef = useRef(null);

  const charCount      = text.length;
  const estimatedCost  = ((charCount / 1000) * 0.015).toFixed(4);

  function showToast(msg, type = "info") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  // ── Stripe Checkout ──
  async function handleUpgrade(plan) {
    if (!plan.priceId) return;
    setCheckoutLoading(plan.id);
    try {
      const stripe = await loadStripe(STRIPE_PUBLISHABLE_KEY);
      const { error } = await stripe.redirectToCheckout({
        lineItems: [{ price: plan.priceId, quantity: 1 }],
        mode: "subscription",
        successUrl: window.location.origin + "?success=true",
        cancelUrl:  window.location.origin + "?canceled=true",
      });
      if (error) showToast(error.message, "error");
    } catch (err) {
      showToast("Checkout failed — please try again.", "error");
    }
    setCheckoutLoading(null);
  }

  // ── Fish Audio TTS ──
  async function generateSpeech() {
    if (!text.trim() || credits <= 0) return;
    setIsGenerating(true);
    setWaveActive(true);
    setAudioUrl(null);

    try {
      const res = await fetch("https://api.fish.audio/v1/tts", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${FISH_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          reference_id: selectedVoice.id,
          format: "mp3",
          mp3_bitrate: 128,
          normalize: true,
          latency: "normal",
        }),
      });

      if (res.ok) {
        const blob = await res.blob();
        setAudioUrl(URL.createObjectURL(blob));
        setCredits(c => Math.max(0, c - 1));
        showToast("Audio generated!", "success");
      } else {
        setAudioUrl("demo");
        showToast("Add your Fish Audio API key to generate real audio.", "info");
      }
    } catch {
      setAudioUrl("demo");
      showToast("Demo mode — connect Fish Audio API key.", "info");
    }

    setIsGenerating(false);
    setTimeout(() => setWaveActive(false), 3000);
  }

  // ── Voice Clone ──
  async function cloneVoice() {
    if (!uploadedFile || !cloneName.trim()) return;
    setIsCloning(true);
    await new Promise(r => setTimeout(r, 2500));
    setUserVoices(v => [...v, {
      id: `clone_${Date.now()}`,
      name: cloneName,
      desc: "Your cloned voice",
      tag: "Cloned",
      color: "#00f5d4",
    }]);
    setIsCloning(false);
    setCloneSuccess(true);
    setCloneName("");
    setUploadedFile(null);
    setTimeout(() => setCloneSuccess(false), 3000);
  }

  // Check for Stripe redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("success")) {
      showToast("🎉 Subscription activated! Welcome to VoiceCraft.", "success");
      window.history.replaceState({}, "", window.location.pathname);
    }
    if (params.get("canceled")) {
      showToast("Checkout canceled — no charge made.", "info");
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  const allVoices = [...VOICES, ...userVoices];

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0a0a0f",
      color: "#e8e8f0",
      fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
      position: "relative",
      overflowX: "hidden",
    }}>
      {/* Ambient bg */}
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0,
        background: `
          radial-gradient(ellipse 60% 40% at 20% 20%, rgba(255,107,53,0.08) 0%, transparent 70%),
          radial-gradient(ellipse 50% 50% at 80% 80%, rgba(155,93,229,0.08) 0%, transparent 70%),
          radial-gradient(ellipse 40% 30% at 50% 50%, rgba(0,187,249,0.04) 0%, transparent 70%)
        `,
      }} />

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", top: 20, right: 20, zIndex: 999,
          padding: "12px 20px", borderRadius: 12, fontSize: 13, fontWeight: 600,
          background: toast.type === "success" ? "rgba(0,245,212,0.15)" : toast.type === "error" ? "rgba(255,80,80,0.15)" : "rgba(255,255,255,0.08)",
          border: `1px solid ${toast.type === "success" ? "rgba(0,245,212,0.3)" : toast.type === "error" ? "rgba(255,80,80,0.3)" : "rgba(255,255,255,0.1)"}`,
          color: toast.type === "success" ? "#00f5d4" : toast.type === "error" ? "#ff5050" : "#aaa",
          backdropFilter: "blur(10px)",
          animation: "slideIn 0.3s ease",
        }}>{toast.msg}</div>
      )}

      <div style={{ position: "relative", zIndex: 1, maxWidth: 900, margin: "0 auto", padding: "0 20px 80px" }}>

        {/* Header */}
        <header style={{ padding: "32px 0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 42, height: 42, borderRadius: 12,
              background: "linear-gradient(135deg, #ff6b35, #9b5de5)",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20,
            }}>🎙</div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.5px", color: "#fff" }}>VoiceCraft</div>
              <div style={{ fontSize: 11, color: "#555", letterSpacing: "0.06em", textTransform: "uppercase" }}>AI Voice Studio</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              background: "rgba(255,107,53,0.1)", border: "1px solid rgba(255,107,53,0.2)",
              borderRadius: 20, padding: "6px 14px", fontSize: 13,
            }}>
              <span style={{ color: "#ff6b35", fontWeight: 700 }}>{credits === 9999 ? "∞" : credits}</span>
              <span style={{ color: "#666" }}>credits</span>
            </div>
          </div>
        </header>

        {/* Nav */}
        <nav style={{ display: "flex", gap: 4, marginBottom: 28, background: "rgba(255,255,255,0.03)", borderRadius: 12, padding: 4 }}>
          {[
            { id: "studio",  label: "🎚 Studio" },
            { id: "clone",   label: "🧬 Clone Voice" },
            { id: "pricing", label: "💎 Plans" },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
              flex: 1, padding: "10px 16px", borderRadius: 9, border: "none", cursor: "pointer",
              fontSize: 13, fontWeight: 600, transition: "all 0.2s",
              background: activeTab === tab.id ? "rgba(255,255,255,0.08)" : "transparent",
              color: activeTab === tab.id ? "#fff" : "#555",
            }}>{tab.label}</button>
          ))}
        </nav>

        {/* ── STUDIO ── */}
        {activeTab === "studio" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={card}>
              <div style={label}>Choose a Voice</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 10 }}>
                {allVoices.map(voice => (
                  <button key={voice.id} onClick={() => setSelectedVoice(voice)} style={{
                    padding: "12px 10px", borderRadius: 12, border: "1.5px solid",
                    borderColor: selectedVoice.id === voice.id ? voice.color : "rgba(255,255,255,0.06)",
                    background: selectedVoice.id === voice.id ? `${voice.color}15` : "rgba(255,255,255,0.02)",
                    cursor: "pointer", textAlign: "left", transition: "all 0.2s",
                  }}>
                    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: voice.color, marginBottom: 4 }}>{voice.tag}</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#e8e8f0", marginBottom: 2 }}>{voice.name}</div>
                    <div style={{ fontSize: 11, color: "#555", lineHeight: 1.3 }}>{voice.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div style={card}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                <div style={label}>Your Story</div>
                <div style={{ fontSize: 12, color: "#444" }}>{charCount} chars · ~${estimatedCost} API cost</div>
              </div>
              <textarea
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder="Enter your story, script, or narration here..."
                style={{
                  width: "100%", minHeight: 160, background: "transparent", border: "none",
                  color: "#e8e8f0", fontSize: 15, lineHeight: 1.7, resize: "vertical",
                  outline: "none", fontFamily: "inherit", boxSizing: "border-box",
                }}
              />
            </div>

            {/* Waveform */}
            <div style={{
              height: 60, borderRadius: 12, background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.04)",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 3, padding: "0 16px", overflow: "hidden",
            }}>
              {Array.from({ length: 48 }).map((_, i) => {
                const base = Math.sin(i * 0.4) * 10 + 12;
                return (
                  <div key={i} style={{
                    width: 3, borderRadius: 2,
                    height: waveActive ? `${Math.random() * 35 + 8}px` : `${base}px`,
                    background: waveActive ? `hsl(${(i * 7 + 20) % 60 + 10}, 90%, 60%)` : "rgba(255,255,255,0.08)",
                    transition: waveActive ? "height 0.1s ease" : "height 0.5s ease",
                    animation: waveActive ? `pulse ${0.3 + (i % 5) * 0.1}s ease infinite alternate` : "none",
                  }} />
                );
              })}
            </div>

            {audioUrl && audioUrl !== "demo" && (
              <audio controls src={audioUrl} style={{ width: "100%", borderRadius: 8 }} />
            )}
            {audioUrl === "demo" && (
              <div style={{ padding: "12px 16px", borderRadius: 10, background: "rgba(255,107,53,0.08)", border: "1px solid rgba(255,107,53,0.2)", fontSize: 13, color: "#ff6b35" }}>
                ⚡ Demo mode — add your Fish Audio API key in Vercel environment variables to generate real audio.
              </div>
            )}

            {credits <= 0 && (
              <div style={{ padding: "12px 16px", borderRadius: 10, background: "rgba(155,93,229,0.08)", border: "1px solid rgba(155,93,229,0.2)", fontSize: 13, color: "#9b5de5", textAlign: "center" }}>
                You've used all your free credits. <button onClick={() => setActiveTab("pricing")} style={{ background: "none", border: "none", color: "#9b5de5", fontWeight: 700, cursor: "pointer", textDecoration: "underline" }}>Upgrade to keep creating →</button>
              </div>
            )}

            <button onClick={generateSpeech} disabled={isGenerating || !text.trim() || credits <= 0} style={{
              width: "100%", padding: 16, borderRadius: 14, border: "none",
              background: isGenerating || credits <= 0 ? "rgba(255,255,255,0.05)" : "linear-gradient(135deg, #ff6b35, #9b5de5)",
              color: isGenerating || credits <= 0 ? "#444" : "#fff",
              fontSize: 15, fontWeight: 700, cursor: isGenerating || !text.trim() || credits <= 0 ? "not-allowed" : "pointer",
              transition: "all 0.2s", letterSpacing: "0.02em",
            }}>
              {isGenerating ? "⟳ Generating..." : credits <= 0 ? "No Credits — Upgrade Plan" : `Generate with ${selectedVoice.name} →`}
            </button>
          </div>
        )}

        {/* ── CLONE ── */}
        {activeTab === "clone" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ ...card, padding: 28 }}>
              <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 8, color: "#fff" }}>Clone Your Voice</div>
              <div style={{ fontSize: 14, color: "#666", marginBottom: 28, lineHeight: 1.6 }}>
                Upload a clean audio sample (30 sec – 3 min) and we'll create a digital clone you can use anytime.
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <input
                  type="text"
                  value={cloneName}
                  onChange={e => setCloneName(e.target.value)}
                  placeholder="Name your voice (e.g. 'My Dark Narrator')"
                  style={{
                    padding: "14px 16px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)",
                    background: "rgba(255,255,255,0.04)", color: "#e8e8f0", fontSize: 14, outline: "none", fontFamily: "inherit",
                  }}
                />
                <div onClick={() => fileInputRef.current?.click()} style={{
                  border: "2px dashed", borderColor: uploadedFile ? "rgba(0,245,212,0.3)" : "rgba(255,255,255,0.1)",
                  borderRadius: 14, padding: "40px 20px", textAlign: "center", cursor: "pointer",
                  background: uploadedFile ? "rgba(0,245,212,0.05)" : "rgba(255,255,255,0.02)",
                }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>🎤</div>
                  <div style={{ fontSize: 14, color: uploadedFile ? "#00f5d4" : "#555" }}>
                    {uploadedFile ? `✓ ${uploadedFile.name}` : "Click to upload audio file"}
                  </div>
                  <div style={{ fontSize: 12, color: "#444", marginTop: 4 }}>MP3, WAV, M4A · 30 sec minimum</div>
                  <input ref={fileInputRef} type="file" accept="audio/*" onChange={e => setUploadedFile(e.target.files[0])} style={{ display: "none" }} />
                </div>
                <button onClick={cloneVoice} disabled={isCloning || !cloneName.trim() || !uploadedFile} style={{
                  padding: 15, borderRadius: 12, border: "none",
                  background: isCloning || !cloneName.trim() || !uploadedFile ? "rgba(255,255,255,0.05)" : "linear-gradient(135deg, #00f5d4, #00bbf9)",
                  color: isCloning || !cloneName.trim() || !uploadedFile ? "#444" : "#0a0a0f",
                  fontSize: 14, fontWeight: 700, cursor: "pointer",
                }}>
                  {isCloning ? "⟳ Cloning voice..." : "Create Voice Clone →"}
                </button>
                {cloneSuccess && (
                  <div style={{ padding: "12px 16px", borderRadius: 10, background: "rgba(0,245,212,0.08)", border: "1px solid rgba(0,245,212,0.2)", fontSize: 13, color: "#00f5d4", textAlign: "center" }}>
                    ✓ Voice cloned! Find it in the Studio voice picker.
                  </div>
                )}
              </div>
            </div>

            {userVoices.length > 0 && (
              <div style={card}>
                <div style={label}>Your Cloned Voices</div>
                {userVoices.map(v => (
                  <div key={v.id} style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "10px 12px", borderRadius: 10, background: "rgba(0,245,212,0.05)",
                    border: "1px solid rgba(0,245,212,0.1)", marginBottom: 8,
                  }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#00f5d4" }} />
                    <span style={{ fontWeight: 600 }}>{v.name}</span>
                    <span style={{ fontSize: 11, color: "#555", marginLeft: "auto" }}>Cloned Voice</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── PRICING ── */}
        {activeTab === "pricing" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ textAlign: "center", marginBottom: 8 }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: "#fff", letterSpacing: "-0.5px" }}>Simple Pricing</div>
              <div style={{ fontSize: 14, color: "#555", marginTop: 6 }}>Start free. Upgrade when you're ready.</div>
            </div>

            {PLANS.map(plan => (
              <div key={plan.name} style={{
                background: plan.popular ? `${plan.color}10` : "rgba(255,255,255,0.03)",
                borderRadius: 16, border: "1.5px solid",
                borderColor: plan.popular ? `${plan.color}40` : "rgba(255,255,255,0.06)",
                padding: 24, position: "relative",
              }}>
                {plan.popular && (
                  <div style={{
                    position: "absolute", top: -12, right: 20,
                    background: plan.color, color: "#fff",
                    fontSize: 11, fontWeight: 700, padding: "4px 12px", borderRadius: 20,
                    letterSpacing: "0.05em", textTransform: "uppercase",
                  }}>Most Popular</div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>{plan.name}</div>
                    <div style={{ fontSize: 13, color: "#555", marginTop: 2 }}>{plan.desc}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 26, fontWeight: 800, color: plan.color }}>{plan.price}</div>
                    {plan.price !== "Free" && <div style={{ fontSize: 11, color: "#555" }}>/month</div>}
                  </div>
                </div>
                <div style={{ margin: "16px 0", height: 1, background: "rgba(255,255,255,0.05)" }} />
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
                  {plan.features.map((f, i) => (
                    <div key={i} style={{ display: "flex", gap: 8, fontSize: 13, color: "#888" }}>
                      <span style={{ color: plan.color }}>✓</span> {f}
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => plan.priceId ? handleUpgrade(plan) : null}
                  disabled={checkoutLoading === plan.id || plan.id === "spark"}
                  style={{
                    width: "100%", padding: 13, borderRadius: 10, border: "none",
                    background: plan.id === "spark" ? "rgba(255,255,255,0.06)" : `linear-gradient(135deg, ${plan.color}, ${plan.color}aa)`,
                    color: plan.id === "spark" ? "#555" : "#fff",
                    fontSize: 14, fontWeight: 600, cursor: plan.id === "spark" ? "default" : "pointer",
                    opacity: checkoutLoading === plan.id ? 0.7 : 1,
                  }}>
                  {plan.id === "spark" ? "Current Free Plan" : checkoutLoading === plan.id ? "⟳ Loading..." : `Upgrade to ${plan.name} →`}
                </button>
              </div>
            ))}

            <div style={{
              padding: "16px 20px", borderRadius: 12,
              background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)",
              fontSize: 12, color: "#444", textAlign: "center", lineHeight: 1.6,
            }}>
              🔒 Payments processed securely by Stripe · Cancel anytime · No hidden fees
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse { from { transform: scaleY(0.6); } to { transform: scaleY(1.4); } }
        @keyframes slideIn { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
        * { box-sizing: border-box; }
        textarea::placeholder, input::placeholder { color: #333; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
      `}</style>
    </div>
  );
}

// Shared styles
const card = {
  background: "rgba(255,255,255,0.03)",
  borderRadius: 16,
  border: "1px solid rgba(255,255,255,0.06)",
  padding: 20,
};

const label = {
  fontSize: 12,
  color: "#666",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  marginBottom: 14,
};
