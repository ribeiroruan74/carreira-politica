import { useGame } from '../../state/store';

// FASE 29 — Resumo mensal agrupado por categoria, com destaque para o que
// exige decisão. Substitui a lista plana antiga.

const GRUPOS = [
  { id: 'marcos', nome: 'Marcos e riscos', ico: '⚑', tipos: ['MARCO', 'MEMORIA', 'CRISE', 'CALENDARIO'] },
  { id: 'midia', nome: 'Mídia e redes', ico: '📰', tipos: ['MIDIA', 'CASCATA', 'PESQUISA', 'CAMPANHA'] },
  { id: 'politica', nome: 'Política e relações', ico: '👥', tipos: ['MUNDO', 'POLITICA', 'ALIANCA', 'ATAQUE', 'RELACIONAMENTO'] },
  { id: 'mandato', nome: 'Mandato e gabinete', ico: '🏛️', tipos: ['MANDATO', 'GABINETE'] },
  { id: 'cidade', nome: 'Cidade', ico: '🗺️', tipos: ['CIDADE'] },
  { id: 'financas', nome: 'Finanças e alertas', ico: '💰', tipos: ['ALERTA'] },
];
const grupoDe = (tipo) => GRUPOS.find((g) => g.tipos.includes(tipo))?.id || 'outros';

export default function TickEventos() {
  const eventos = useGame((g) => g.ultimoTick);
  const temCrise = useGame((g) => !!g.estado?.eventoPendente);
  const limpar = () => useGame.setState({ ultimoTick: null });

  if (temCrise) return null; // a crise tem prioridade
  const relevantes = (eventos || []).filter((e) => e.tipo !== 'INFO' && e.tipo !== 'MES');
  if (relevantes.length === 0) return null;

  const porGrupo = {};
  for (const e of relevantes) {
    const g = grupoDe(e.tipo);
    (porGrupo[g] ||= []).push(e);
  }
  const marcos = porGrupo.marcos || [];

  return (
    <div className="overlay" onClick={limpar}>
      <div className="modal" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
        <p className="eyebrow">Resumo do mês</p>

        {marcos.length > 0 && (
          <div className="card" style={{ background: 'var(--amber-soft)', borderColor: 'transparent', marginBottom: 12 }}>
            {marcos.map((e, i) => (
              <p key={i} className="small" style={{ margin: i ? '6px 0 0' : 0, color: 'var(--amber)', fontWeight: 500 }}>⚑ {e.texto}</p>
            ))}
          </div>
        )}

        <div className="stack" style={{ gap: 12 }}>
          {GRUPOS.filter((g) => g.id !== 'marcos' && porGrupo[g.id]?.length).map((g) => (
            <div key={g.id}>
              <div className="small faint mono" style={{ marginBottom: 4 }}>{g.ico} {g.nome.toUpperCase()}</div>
              {porGrupo[g.id].map((e, i) => (
                <div key={i} className={`log-item ${e.tipo}`} style={{ borderBottom: 'none', padding: '3px 0' }}>
                  <span className="txt small">{e.texto}</span>
                </div>
              ))}
            </div>
          ))}
          {porGrupo.outros?.length > 0 && porGrupo.outros.map((e, i) => (
            <div key={i} className="small dim">{e.texto}</div>
          ))}
        </div>

        <button className="btn block" style={{ marginTop: 16 }} onClick={limpar}>Continuar</button>
      </div>
    </div>
  );
}
