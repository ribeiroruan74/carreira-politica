// Barra inferior fixa — só ícones, sem texto. Some as seções sem sub-aba visível.
export default function BottomNav({ secoes, secao, onTrocar, alertas = {} }) {
  return (
    <nav className="bottomnav" aria-label="Seções">
      {secoes.map((s) => (
        <button
          key={s.id}
          className={`bn-item ${secao === s.id ? 'on' : ''}`}
          onClick={() => onTrocar(s.id)}
          aria-label={s.titulo}
          aria-current={secao === s.id ? 'page' : undefined}
        >
          <span className="bn-ico" aria-hidden="true">
            {s.ico}
            {alertas[s.id] > 0 && <span className="bn-dot">{alertas[s.id] > 9 ? '9+' : alertas[s.id]}</span>}
          </span>
        </button>
      ))}
    </nav>
  );
}
