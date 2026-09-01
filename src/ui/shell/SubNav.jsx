export default function SubNav({ abas, ativa, onTrocar }) {
  if (!abas || abas.length < 2) return null;
  return (
    <div className="subnav" role="tablist" aria-label="Sub-seções">
      {abas.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={ativa === t.id}
          className={`sn-item ${ativa === t.id ? 'on' : ''}`}
          onClick={() => onTrocar(t.id)}
        >
          <span aria-hidden="true">{t.ico}</span> {t.titulo}
        </button>
      ))}
    </div>
  );
}
