// Hub de seção — padrão life sim: título fantasma + linhas grandes com botão circular.
export default function SectionHub({ titulo, abas, onAbrir, atalho }) {
  return (
    <div className="hub">
      <div className="hub-head">
        {atalho ? (
          <button className={`hub-pill ${atalho.tone || ''}`} onClick={() => onAbrir(atalho.id)}>
            {atalho.rotulo}
          </button>
        ) : <span />}
        <span className="hub-ghost" aria-hidden="true">{titulo}</span>
      </div>

      <div className="hub-grid">
        {abas.map((t) => (
          <button key={t.id} className="hub-row" onClick={() => onAbrir(t.id)}>
            <span className="hub-row-main">
              <span className="hub-row-name">{t.titulo || t.nome}</span>
              {t.resumo && <span className="hub-row-sub">{t.resumo}</span>}
            </span>
            {t.ico && <span className="hub-row-ico" aria-hidden="true">{t.ico}</span>}
            <span className="hub-go" aria-hidden="true">→</span>
          </button>
        ))}
      </div>
    </div>
  );
}
