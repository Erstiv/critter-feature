// Critter Feature — Cassius Vane live commentary endpoint.
// Calls Gemini with the system prompt + few-shot from the spec.
// Spec: CritterFeature_Cassius_Vane_Voice_and_Live_Commentate_Spec.md
//
// Architecture: "AI proposes, engine disposes." This endpoint receives the
// engine's resolved CommentateInput + recent lines and returns 1-3 short beats
// in the Cassius voice. It NEVER changes the outcome.

import express from 'express';

const PORT = process.env.PORT || 8030;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash-exp';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`;

const SYSTEM_PROMPT = `You are Cassius Vane, ringside announcer at a 1950s drive-in creature-feature where the monsters are real and the fight just happened. You call the anatomy of the kill — never the score. The attacker's biology is the weapon (venom, deathroll, beak, crushing arms, engulfing slime); the biome is the second killer (ocean pressure, ice, desert heat, wetlands drag). You are horrified and thrilled in the same breath — half out of your chair, shouting to the crowd ("folks," "ladies and gentlemen"). Use caps sparingly for the gasp. This is campy rubber-suit gore: lurid, theatrical, a little funny — never genuinely disturbing, never mapped onto real people. Output 1 to 3 lines, each at most 30 words, plain text, one beat per line. The result is FIXED: the attacker I name won — never contradict it. Name the real critters and the real biome. Do not reuse any line I list as recent.`;

const FEW_SHOTS = {
  Venom: [
    "One strike. You barely saw it land. Now watch the {L}'s legs stop — one, then the next, then all of them. The venom is reading it the last rites.",
    "The {A} doesn't fight. It INJECTS. The {L} is already a statue in {B} and doesn't know it yet. HORRIBLE. Magnificent.",
  ],
  Armor: [
    "The {A} gets its jaws set and ROLLS. {B} goes red to the waterline. Folks, I'm told the {L} is in several pieces. SEVERAL.",
    "No finesse. No mercy. Just a ton of armor closing like a car door on the {L}. Cassius needs a moment.",
  ],
  Aquatic: [
    "Down it goes — past the light, past the cold, to where the water itself is a fist. The {A} barely bites. The dark of {B} does the rest.",
    "Eight arms find every seam in the {L} at once. Ladies and gentlemen, the {L} is being UNFOLDED.",
  ],
  Flyer: [
    "The {A} folds its wings and drops out of {B} like a thrown knife. The {L} never hears it. Then it's just feathers and a sound I won't describe.",
    "Talons first at two hundred miles an hour. The {L} comes apart in the air over {B} before it lands. The CROWD is on its feet.",
  ],
  Mind: [
    "The {A} doesn't out-muscle the {L} — it out-THINKS it. Knew where it'd flinch in {B} before it flinched. Cold. Deliberate. Awful to watch.",
  ],
  Mindless: [
    "It doesn't kill the {L}. It SURROUNDS it. And the part they'll talk about for weeks, folks — the {L} is still moving in there.",
    "No brain, no plan, no mercy. The {A} just flows over the {L} in {B} until there's only {A}.",
  ],
  Unbroken: [
    "The {A} can't be killed and the {L} finally understands that in {B}. It throws everything. The {A} simply… outlasts it. Endurance is its own kind of horror.",
  ],
};

const EVENT_OVERRIDES = {
  narrow: "By a HAIR. The {L} nearly had it in {B} — but the {A} drags itself up off the mat with the win and one less life in its eyes.",
  'tie-bounce': "NOBODY dies! The {A} and the {L} hit at the exact same instant, recoil, and the {A} staggers back to the bench. {B} holds its breath.",
  empty: "The {A} struts into an empty {B} and plants the banner. No blood today, folks — just a flag and a very smug {A}.",
  'ace-burn': "THAT WAS THE ACE. The {A} just tore the mask off the {L} — their hidden champion, dead in {B}, and every secret they had spills out with it.",
  'glory-end': "THREE ARENAS! It's over! {A}'s banners fly over the board and the crowd has completely lost its mind!",
  'endurance-end': "They've got nothing left to send. No hand, no bench, no monsters. The {A} wins by simply being the last thing standing.",
  'assassination-end': "THE ACE IS DEAD AND SO IS THE NIGHT! {A} hunted the champion through {B} and ended it. UNMASK IT. Show them what they killed!",
};

function pickFewShots(attackerTags, event) {
  // Event-specific override always gets included.
  const out = [];
  if (EVENT_OVERRIDES[event]) {
    out.push(`Event "${event}": ${EVENT_OVERRIDES[event]}`);
  }
  // Tag-driven: include up to 2 banks matching attacker tags.
  const priority = ['Venom', 'Mindless', 'Unbroken', 'Mind', 'Flyer', 'Aquatic', 'Armor'];
  for (const tag of priority) {
    if (attackerTags && attackerTags.includes(tag) && FEW_SHOTS[tag]) {
      for (const line of FEW_SHOTS[tag]) out.push(`Voice example [${tag}]: ${line}`);
      if (out.length >= 4) break;
    }
  }
  return out;
}

function buildPrompt(input, recentLines) {
  const fewShots = pickFewShots(input.attacker?.tags, input.event);
  const recentBlock = recentLines && recentLines.length
    ? `\n\nDo NOT repeat any of these recent lines:\n${recentLines.map((l) => `- ${l}`).join('\n')}`
    : '';
  const fewShotBlock = fewShots.length
    ? `\n\nVoice examples (use the same register; substitute the real critter and biome):\n${fewShots.map((l) => `- ${l}`).join('\n')}`
    : '';
  return `${SYSTEM_PROMPT}${fewShotBlock}

Call this fight:
- Attacker: ${input.attacker.name} (tags: ${(input.attacker.tags || []).join(', ') || 'none'}, might ${input.attacker.might}, stamina ${input.attacker.stamina})
- Loser: ${input.loser ? input.loser.name + ' (tags: ' + (input.loser.tags || []).join(', ') + ')' : '(empty arena)'}
- Biome: ${input.biome}
- Hits: ${input.hitsFor} for the attacker, ${input.hitsAgainst} against (margin ${input.margin})
- Event: ${input.event}${input.aceBurned ? ' — ACE BURNED' : ''}${input.winCondition ? ' — match-end by ' + input.winCondition : ''}${recentBlock}

Write 1-3 short beats (one per line, plain text, no markdown, each ≤30 words). The attacker won — never contradict that.`;
}

const app = express();
app.use(express.json({ limit: '64kb' }));

app.get('/api/commentate/health', (_req, res) => {
  res.json({ ok: true, model: MODEL, hasKey: !!GEMINI_API_KEY });
});

app.post('/api/commentate', async (req, res) => {
  if (!GEMINI_API_KEY) {
    return res.status(503).json({ error: 'no API key configured' });
  }
  const { input, recentLines } = req.body || {};
  if (!input || !input.attacker || !input.biome || !input.event) {
    return res.status(400).json({ error: 'malformed input' });
  }
  const prompt = buildPrompt(input, recentLines || []);

  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.9,
      maxOutputTokens: 240,
    },
    safetySettings: [
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
    ],
  };

  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 4500);  // budget slightly over the client's 2.5s so client decides
    const resp = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (!resp.ok) {
      const errText = await resp.text();
      console.error(`[commentate] Gemini ${resp.status}: ${errText.slice(0, 200)}`);
      return res.status(502).json({ error: 'provider error', status: resp.status });
    }
    const json = await resp.json();
    const text = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    const lines = text
      .split('\n')
      .map((l) => l.replace(/^[\s\-\*•>]+/, '').trim())
      .filter((l) => l.length > 0 && l.length < 280)
      .slice(0, 3);
    if (lines.length === 0) {
      return res.status(502).json({ error: 'empty response' });
    }
    res.json({ lines });
  } catch (e) {
    console.error('[commentate] error:', e.message);
    res.status(504).json({ error: 'timeout or fetch failed' });
  }
});

app.listen(PORT, () => {
  console.log(`Critter Feature API listening on :${PORT} (model: ${MODEL})`);
});
