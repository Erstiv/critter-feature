import { useEffect, useState } from 'react';
import type { ActionResult as AR } from '../state.ts';
import { commentateStrike } from '../commentateClient.ts';

type Props = {
  result: AR;
  onDismiss: () => void;
};

export function ActionResult({ result, onDismiss }: Props) {
  // Initial render uses the static fallback. If a live commentate is attached,
  // we fire-and-update: as soon as Gemini returns Cassius's actual lines, we
  // swap them in. If it times out or errors, the fallback stays.
  const [liveLines, setLiveLines] = useState<string[] | null>(null);

  useEffect(() => {
    if (!result.liveInput) return;
    let cancelled = false;
    const { live } = commentateStrike(result.liveInput, result.body.length * 13);
    live.then((lines) => {
      if (!cancelled && lines && lines.length > 0) setLiveLines(lines);
    });
    return () => { cancelled = true; };
  }, [result.liveInput, result.body.length]);

  const narrationLines: string[] = liveLines ?? (result.narration ? [result.narration] : []);

  return (
    <div className="v2-modal-backdrop">
      <div className={`v2-modal v2-result ${result.flavor ?? ''}`}>
        <h3>{result.title}</h3>
        {narrationLines.length > 0 && (
          <div className="v2-narration">
            {narrationLines.map((l, i) => <p key={i} style={{ margin: i === 0 ? 0 : '8px 0 0' }}>"{l}"</p>)}
            {liveLines && <span style={{ fontSize: 10, color: 'var(--marquee-gold)', opacity: 0.6, marginLeft: 6 }}>· live</span>}
          </div>
        )}
        {result.body.map((l, i) => <p key={i} className="v2-result-detail">{l}</p>)}
        <div className="v2-actions" style={{ marginTop: 16 }}>
          <button onClick={onDismiss}>Continue ▸</button>
        </div>
      </div>
    </div>
  );
}
