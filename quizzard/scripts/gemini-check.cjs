const fs = require("node:fs");
const path = require("node:path");

function loadEnv(file) {
  const raw = fs.readFileSync(file, "utf8");
  const out = {};
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[m[1]] = v;
  }
  return out;
}

const env = loadEnv(path.join(__dirname, "..", ".env"));

async function tryGemini(model) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`;
  const t0 = Date.now();
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: "Say OK" }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 64 },
      }),
      signal: AbortSignal.timeout(30000),
    });
    const text = await res.text();
    console.log(`  [${model}] ${res.status} ${Date.now() - t0}ms ${text.slice(0, 110).replace(/\n/g, " ")}`);
    return res.ok;
  } catch (err) {
    console.log(`  [${model}] ERROR ${Date.now() - t0}ms ${err.message}`);
    return false;
  }
}

(async () => {
  for (const m of ["gemini-3.8-flash", "gemini-3.5-flash", "gemini-2.5-flash", "gemini-2.0-flash"]) {
    for (let i = 0; i < 2; i++) {
      await tryGemini(m);
    }
  }
})();
