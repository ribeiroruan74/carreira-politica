import { SECOES } from './tabsConfig';

export default function BottomNav({ secao, onTrocar, alertas = {} }) {
  return (
    <nav className="bottomnav" aria-label="Seções">
      {SECOES.map((s) => (
        <button
          key={s.id}
          className={`bn-item ${secao === s.id ? 'on' : ''}`}
          onClick={() => onTrocar(s.id)}
          aria-current={secao === s.id ? 'page' : undefined}
        >
          <span className="bn-ico" aria-hidden="true">
            {s.ico}
            {alertas[s.id] > 0 && <span className="bn-dot">{alertas[s.id] > 9 ? '9+' : alertas[s.id]}</span>}
          </span>
          <span className="bn-lbl">{s.nome}</span>
        </button>
      ))}
    </nav>
  );
}
