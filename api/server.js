// Critter Feature — Cassius Vane live commentary endpoint.
// Calls Gemini with the system prompt + few-shot from the spec.
// Spec: CritterFeature_Cassius_Vane_Voice_and_Live_Commentate_Spec.md
//
// Architecture: "AI proposes, engine disposes." This endpoint receives the
// engine's resolved CommentateInput + recent lines and returns 1-3 short beats
// in the Cassius voice. It NEVER changes the outcome.

import express from 'express';

const PORT = process.env.PORT || 8030;
// Provider: xAI/Grok (OpenAI-compatible). Cowork bcdf3ec1 (Elliot's call).
// Fallback: Gemini if XAI_API_KEY is absent (during local dev or rollback).
const XAI_API_KEY = process.env.XAI_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const PROVIDER = XAI_API_KEY ? 'xai' : (GEMINI_API_KEY ? 'gemini' : 'none');
const XAI_MODEL = process.env.XAI_MODEL || 'grok-2-1212';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
const MODEL = PROVIDER === 'xai' ? XAI_MODEL : GEMINI_MODEL;
const XAI_ENDPOINT = 'https://api.x.ai/v1/chat/completions';
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

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

  // v0.3 (cowork e9f2970f): if the bout was multi-round, tell Cassius to call
  // it blow-by-blow — one beat per significant round/swing — instead of one
  // summary line. The rounds[] array carries the per-round data.
  const rounds = Array.isArray(input.rounds) ? input.rounds : [];
  const isMultiRound = rounds.length >= 2;
  let roundsBlock = '';
  let outcomeLine = '';
  if (isMultiRound) {
    const att = input.attacker.name;
    const def = input.loser ? input.loser.name : '(empty arena)';
    const beatCount = Math.min(rounds.length, 5);  // cap so it stays readable
    roundsBlock = `\n\nThe bout went ${rounds.length} rounds — narrate it as a blow-by-blow, ONE short beat per significant round (or two adjacent rounds if you need to compress). The round-by-round:\n${rounds.map((r) => `- R${r.round}: ${att} ${r.attackerHits} hits / ${def} ${r.defenderHits} hits → ${att} S${r.attackerStaminaAfter} · ${def} S${r.defenderStaminaAfter} ${r.roundWinner === 'tie' ? '(clinch — both bleed 1)' : r.roundWinner === 'attacker' ? '(' + att + ' wins the round)' : '(' + def + ' wins the round)'}`).join('\n')}\n\nWrite up to ${beatCount} lines.`;
    if (input.outcome === 'mutual-draw') outcomeLine = `Final: MUTUAL DESTRUCTION — both ${att} and ${def} burn at the same instant in the ${input.biome}.`;
    else if (input.outcome === 'exhaustion-draw') outcomeLine = `Final: 12-round cap — DRAW BY EXHAUSTION. ${att} retreats; ${def} holds the ${input.biome}.`;
    else if (input.outcome === 'attacker-wins') outcomeLine = `Final: ${att} bleeds ${def} dry. ${def} burns; ${att} takes the ${input.biome}.`;
    else if (input.outcome === 'defender-wins') outcomeLine = `Final: ${def} outlasts. ${att} burns; ${def} holds the ${input.biome}.`;
    outcomeLine = '\n\n' + outcomeLine + ' Never contradict the winner.';
  }

  return `${SYSTEM_PROMPT}${fewShotBlock}

Call this fight:
- Attacker: ${input.attacker.name} (tags: ${(input.attacker.tags || []).join(', ') || 'none'}, might ${input.attacker.might}, stamina ${input.attacker.stamina})
- Loser: ${input.loser ? input.loser.name + ' (tags: ' + (input.loser.tags || []).join(', ') + ')' : '(empty arena)'}
- Biome: ${input.biome}
- Hits: ${input.hitsFor} for the attacker, ${input.hitsAgainst} against (margin ${input.margin})
- Event: ${input.event}${input.aceBurned ? ' — ACE BURNED' : ''}${input.winCondition ? ' — match-end by ' + input.winCondition : ''}${roundsBlock}${outcomeLine}${recentBlock}

${isMultiRound ? `Output one beat per line, plain text, no markdown, each ≤30 words. Cover the arc — early swings, momentum shifts, the kill (or mutual death). NAME the round when relevant.` : `Write 1-3 short beats (one per line, plain text, no markdown, each ≤30 words). The attacker won — never contradict that.`}`;
}

async function callXAI(prompt) {
  // OpenAI-compatible chat/completions. Spec voice goes in `system`; specific
  // call goes in `user`. Cowork bcdf3ec1: "Loosen/disable any safety knob" —
  // xAI doesn't expose Gemini-style safety thresholds (they keep their content
  // filter server-side), so nothing to set here. Campy gore comes through.
  const body = {
    model: XAI_MODEL,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: prompt },
    ],
    temperature: 0.9,
    max_tokens: 500,  // v0.3: bouts can run 6+ rounds, so up to 5 beats need room
  };
  const resp = await fetch(XAI_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${XAI_API_KEY}`,
    },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`xAI ${resp.status}: ${errText.slice(0, 200)}`);
  }
  const json = await resp.json();
  return json?.choices?.[0]?.message?.content ?? '';
}

async function callGemini(prompt) {
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.9, maxOutputTokens: 240 },
    safetySettings: [
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
    ],
  };
  const resp = await fetch(GEMINI_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Gemini ${resp.status}: ${errText.slice(0, 200)}`);
  }
  const json = await resp.json();
  return json?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

const app = express();
app.use(express.json({ limit: '64kb' }));

app.get('/api/commentate/health', (_req, res) => {
  res.json({ ok: true, provider: PROVIDER, model: MODEL, hasKey: PROVIDER !== 'none' });
});

app.post('/api/commentate', async (req, res) => {
  if (PROVIDER === 'none') {
    return res.status(503).json({ error: 'no API key configured' });
  }
  const { input, recentLines } = req.body || {};
  if (!input || !input.attacker || !input.biome || !input.event) {
    return res.status(400).json({ error: 'malformed input' });
  }
  const prompt = buildPrompt(input, recentLines || []);

  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 4500);
    const text = PROVIDER === 'xai' ? await callXAI(prompt) : await callGemini(prompt);
    clearTimeout(t);
    const lines = text
      .split('\n')
      .map((l) => l.replace(/^[\s\-\*•>]+/, '').trim())
      .filter((l) => l.length > 0 && l.length < 280)
      .slice(0, 6);  // v0.3 multi-round bouts can return up to ~5 round beats + an outcome
    if (lines.length === 0) {
      return res.status(502).json({ error: 'empty response' });
    }
    res.json({ lines });
  } catch (e) {
    console.error('[commentate]', e.message);
    if (e.message?.startsWith('xAI') || e.message?.startsWith('Gemini')) {
      return res.status(502).json({ error: 'provider error', detail: e.message.slice(0, 100) });
    }
    res.status(504).json({ error: 'timeout or fetch failed' });
  }
});

app.listen(PORT, () => {
  console.log(`Critter Feature API listening on :${PORT} (provider: ${PROVIDER}, model: ${MODEL})`);
});
