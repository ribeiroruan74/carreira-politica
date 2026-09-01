export default function SectionHub({ titulo, abas, onAbrir }) {
  return (
    <div className="hub">
      <h2 className="hub-title">{titulo}</h2>
      <div className="hub-grid">
        {abas.map((t) => (
          <button key={t.id} className="hub-card" onClick={() => onAbrir(t.id)}>
            <span className="hub-ico" aria-hidden="true">{t.ico}</span>
            <span className="hub-body">
              <span className="hub-name">{t.titulo || t.nome}</span>
              {t.resumo && <span className="hub-resumo">{t.resumo}</span>}
            </span>
            <span className="hub-arrow" aria-hidden="true">›</span>
          </button>
        ))}
      </div>
    </div>
  );
}
