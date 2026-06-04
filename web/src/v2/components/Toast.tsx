// Inline, non-blocking notice — replaces the "Continue" interstitial modals
// for purely-informational results (Garrison/EndTurn/Redeploy/Declare). Cowork
// a18beedd: a one-click-to-dismiss popup every turn is friction.
//
// Renders as a small toast in the top-right that auto-dismisses after ~3.5s.
// Click to dismiss early.

import { useEffect } from 'react';
import type { ActionResult as AR } from '../state.ts';

type Props = {
  result: AR;
  onDismiss: () => void;
};

export function Toast({ result, onDismiss }: Props) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 3500);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <div className="v2-toast" onClick={onDismiss}>
      <div className="v2-toast-title">{result.title}</div>
      {result.body.map((l, i) => <div key={i} className="v2-toast-line">{l}</div>)}
    </div>
  );
}
