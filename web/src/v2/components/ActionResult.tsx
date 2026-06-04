import type { ActionResult as AR } from '../state.ts';

type Props = {
  result: AR;
  onDismiss: () => void;
};

export function ActionResult({ result, onDismiss }: Props) {
  return (
    <div className="v2-modal-backdrop">
      <div className={`v2-modal v2-result ${result.flavor ?? ''}`}>
        <h3>{result.title}</h3>
        {result.body.map((l, i) => <p key={i}>{l}</p>)}
        <div className="v2-actions" style={{ marginTop: 16 }}>
          <button onClick={onDismiss}>Continue</button>
        </div>
      </div>
    </div>
  );
}
