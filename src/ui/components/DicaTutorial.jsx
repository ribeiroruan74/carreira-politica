import { useGame } from '../../state/store';
import tutorialDef from '../../content/tutorial.json';

function bate(q, s) {
  if (q.fase && s.personagem.fase !== q.fase) return false;
  if (q.faseIn && !q.faseIn.includes(s.personagem.fase)) return false;
  if (q.mesMax != null && s.tempo.mes > q.mesMax) return false;
  if (q.temMandato && !s.mandato) return false;
  if (q.mandatoEncerrando && !s.mandato?.encerrando) return false;
  if (q.temObjetivo) {
    // heurística leve: fase pré-mandato tem objetivo
    if (['CANDIDATO', 'MANDATO'].includes(s.personagem.fase)) return false;
  }
  if (q.temPesquisa && !(s.eleicao?.pesquisas?.length)) return false;
  if (q.jaTeveCrise && Object.keys(s.mundo.crisesHistorico || {}).length === 0) return false;
  return true;
}

export default function DicaTutorial({ aba }) {
  const s = useGame((g) => g.estado);
  const vistas = s.flags.dicasVistas || [];
  const dispensar = useGame((g) => g.dispensarDica);
  if (s.flags.tutorialDesligado) return null;

  const dica = tutorialDef.dicas.find(
    (d) => d.aba === aba && !vistas.includes(d.id) && bate(d.quando, s),
  );
  if (!dica) return null;

  return (
    <div className="card" style={{ borderLeft: '4px solid var(--accent)', background: 'var(--accent-soft)', marginBottom: 14 }}>
      <div className="card-head" style={{ marginBottom: 6 }}>
        <h3 style={{ color: 'var(--accent-ink)' }}>💡 {dica.titulo}</h3>
        <button className="btn ghost sm" onClick={() => useGame.setState((st) => ({
          estado: { ...st.estado, flags: { ...st.estado.flags, tutorialDesligado: true } },
        }))}>desligar dicas</button>
      </div>
      <p className="small" style={{ margin: 0 }}>{dica.texto}</p>
      <button className="btn sm" style={{ marginTop: 10 }} onClick={() => dispensar(dica.id)}>Entendi</button>
    </div>
  );
}
