export default function TabBar({ abas, ativa, onTrocar }) {
  return (
    <nav className="tabbar" aria-label="Seções do jogo">
      {abas.map((t) => (
        <button
          key={t.id}
          className={`tab ${ativa === t.id ? 'on' : ''}`}
          onClick={() => onTrocar(t.id)}
          aria-current={ativa === t.id ? 'page' : undefined}
        >
          <span className="ico" aria-hidden="true">{t.ico}</span>
          {t.nome}
        </button>
      ))}
    </nav>
  );
}
