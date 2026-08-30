export function Card({ title, aside, children, className = '', style }) {
  return (
    <div className={`card ${className}`} style={style}>
      {(title || aside) && (
        <div className="card-head">
          {title && <h3>{title}</h3>}
          {aside && <div className="small dim">{aside}</div>}
        </div>
      )}
      {children}
    </div>
  );
}

export function Stat({ k, v, sub, delta }) {
  return (
    <div className="stat">
      <span className="k">{k}</span>
      <span className="v">{v}</span>
      {sub && <span className="sub">{sub}</span>}
      {delta != null && delta !== 0 && (
        <span className={`sub delta ${delta > 0 ? 'up' : 'down'}`}>
          {delta > 0 ? '▲' : '▼'} {Math.abs(delta).toLocaleString('pt-BR')}
        </span>
      )}
    </div>
  );
}

export function Meter({ label, value, max = 100, tone = 'ok', suffix = '' }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const cls = tone === 'ok' ? '' : tone;
  return (
    <div className="meter">
      <div className="lbl">
        <span>{label}</span>
        <span className="n">{typeof value === 'number' ? Math.round(value) : value}{suffix}</span>
      </div>
      <div className="track"><div className={`fill ${cls}`} style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

export function Pill({ tone, children }) {
  return <span className={`pill ${tone || ''}`}>{children}</span>;
}

// `marks`: [{ pos: 0..1, tone?: 'amber'|'red'|'accent' }] — linhas verticais (marcos)
export function Sparkline({ data, width = 120, height = 32, marks }) {
  if (!data || data.length < 2) return <svg width={width} height={height} />;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const step = width / (data.length - 1);
  const pts = data.map((d, i) => `${(i * step).toFixed(1)},${(height - ((d - min) / span) * (height - 4) - 2).toFixed(1)}`);
  const toneVar = (t) => (t === 'red' ? 'var(--red)' : t === 'accent' ? 'var(--accent)' : 'var(--amber)');
  return (
    <svg width={width} height={height} aria-hidden="true">
      {(marks || []).map((m, i) => (
        <line key={i} x1={(m.pos * width).toFixed(1)} x2={(m.pos * width).toFixed(1)} y1="0" y2={height}
          stroke={toneVar(m.tone)} strokeWidth="1" strokeDasharray="2 2" opacity="0.6" />
      ))}
      <polyline
        points={pts.join(' ')}
        fill="none"
        stroke="var(--accent)"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={pts[pts.length - 1].split(',')[0]} cy={pts[pts.length - 1].split(',')[1]} r="2.4" fill="var(--accent)" />
    </svg>
  );
}

export function PageHead({ eyebrow, title, children }) {
  return (
    <div className="page-head">
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <h2>{title}</h2>
      {children && <p className="dim small" style={{ marginTop: 6 }}>{children}</p>}
    </div>
  );
}
