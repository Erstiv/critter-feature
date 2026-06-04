type Props = { log: string[] };

export function BoutLog({ log }: Props) {
  return (
    <div className="bout-log">
      {log.map((line, i) => {
        const isLegHeader = /^\[Leg \d/.test(line);
        const isKO = /ENDURANCE KO|GLORY|STALEMATE|SUDDEN-DEATH/.test(line);
        const isScore = /Score:/.test(line);
        const style: React.CSSProperties = {};
        if (isLegHeader) { style.color = 'var(--accent)'; style.marginTop = 6; }
        if (isKO) { style.color = 'var(--good)'; style.fontWeight = 'bold'; style.marginTop = 4; }
        if (isScore) { style.color = 'var(--ink)'; }
        return <div key={i} style={style}>{line || ' '}</div>;
      })}
    </div>
  );
}
