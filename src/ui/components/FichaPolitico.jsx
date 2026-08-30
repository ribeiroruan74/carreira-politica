import { Pill, Meter } from './primitives';
import { corPartido, nomePartido } from '../../engine/voteModel';

function eixoLabel(e) {
  if (e <= -50) return 'esquerda';
  if (e <= -15) return 'centro-esquerda';
  if (e < 15) return 'centro';
  if (e < 50) return 'centro-direita';
  return 'direita';
}

// Fase 28 — ficha de um ator político (adversário ou aliado).
export default function FichaPolitico({ pol, estado, onClose }) {
  if (!pol) return null;
  const s = estado;
  const rel = Math.round(pol.relacaoJogador || 0);
  const aliado = rel > 20;
  const hostil = rel < -10;
  const noticias = (s.mundo.noticias || []).filter((n) => (n.atores || []).includes(pol.id) || n.texto.includes(pol.nome)).slice(0, 5);
  const aliados = (pol.aliados || [])
    .map((id) => s.mundo.politicos?.[id]?.nome)
    .filter(Boolean);
  const mesmoPartido = pol.partidoId === s.personagem.partidoId;

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <p className="eyebrow">{(pol.cargo || 'Ator político').replace(/_/g, ' ')}</p>
            <h2 style={{ margin: '2px 0 4px' }}>{pol.nome}</h2>
            <p className="small dim">
              <span className="pill" style={{ borderColor: corPartido(pol.partidoId), color: corPartido(pol.partidoId) }}>{pol.partidoId}</span>
              {' '}{nomePartido(pol.partidoId)} · {eixoLabel(pol.ideologiaEixo)}
            </p>
          </div>
          <button className="btn sm ghost" onClick={onClose}>fechar</button>
        </div>

        <div className="chips" style={{ margin: '10px 0' }}>
          {mesmoPartido && <Pill tone="blue">seu partido</Pill>}
          {aliado && <Pill tone="accent">aliado seu</Pill>}
          {hostil && <Pill tone="red">hostil a você</Pill>}
          {pol.lider && <Pill>liderança</Pill>}
          {pol.objetivo && <Pill>quer: {String(pol.objetivo).replace(/_/g, ' ')}</Pill>}
        </div>

        <div className="grid cols-2" style={{ gap: 10 }}>
          <Meter label="Influência" value={pol.influencia} tone="info" />
          <Meter label="Notoriedade" value={pol.notoriedade} tone="info" />
          <Meter label="Rejeição" value={pol.rejeicao} tone={pol.rejeicao > 40 ? 'bad' : 'warn'} />
          <Meter label={`Relação com você (${rel > 0 ? '+' : ''}${rel})`} value={clampMeter(rel)} tone={aliado ? 'ok' : hostil ? 'bad' : 'warn'} />
        </div>

        {aliados.length > 0 && (
          <p className="small dim" style={{ marginTop: 12 }}>
            <strong>Alianças:</strong> {aliados.join(', ')}
          </p>
        )}
        {typeof pol.aprovacao === 'number' && (
          <p className="small dim" style={{ marginTop: 6 }}><strong>Aprovação (gestão):</strong> {Math.round(pol.aprovacao)}%</p>
        )}

        <div style={{ marginTop: 12 }}>
          <div className="small faint mono" style={{ borderBottom: '1px solid var(--line)', paddingBottom: 3, marginBottom: 6 }}>ÚLTIMOS MOVIMENTOS</div>
          {noticias.length === 0 && <p className="small dim">Nada de relevante no noticiário recente.</p>}
          {noticias.map((n) => (
            <p key={n.id} className="small" style={{ margin: '0 0 4px' }}>› {n.texto}</p>
          ))}
        </div>
      </div>
    </div>
  );
}

function clampMeter(v) {
  return Math.max(0, Math.min(100, v + 50));
}
