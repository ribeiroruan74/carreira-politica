import { useState } from 'react';
import { useGame } from '../../state/store';
import { Pill, Meter } from './primitives';
import { corPartido, nomePartido } from '../../engine/voteModel';
import { acaoRelacao, acoesRelacaoInfo, tentarAlianca, romperAlianca, limiarAlianca, chanceAlianca } from '../../engine/world';

function eixoLabel(e) {
  if (e <= -50) return 'esquerda';
  if (e <= -15) return 'centro-esquerda';
  if (e < 15) return 'centro';
  if (e < 50) return 'centro-direita';
  return 'direita';
}
const clampMeter = (v) => Math.max(0, Math.min(100, v + 50));
const ACOES = acoesRelacaoInfo();

// Fase 28/Etapa 4 — ficha de um ator político + ações de relação sob demanda.
export default function FichaPolitico({ polId, onClose }) {
  const s = useGame((g) => g.estado);
  const aplicar = useGame((g) => g.aplicar);
  const [msg, setMsg] = useState(null);
  const pol = s?.mundo?.politicos?.[polId];
  if (!pol) return null;

  const rel = Math.round(pol.relacaoJogador || 0);
  const aliado = rel > 20;
  const hostil = rel < -10;
  const noGrupo = (s.personagem.grupoPolitico || []).includes(polId);
  const noticias = (s.mundo.noticias || []).filter((n) => (n.atores || []).includes(polId) || n.texto.includes(pol.nome)).slice(0, 5);
  const aliados = (pol.aliados || []).map((id) => s.mundo.politicos?.[id]?.nome).filter(Boolean);
  const mesmoPartido = pol.partidoId === s.personagem.partidoId;
  const semTempo = (n) => s.tempo.pontosRestantes < n;

  function agir(fn) {
    try { let r; aplicar((st) => { r = fn(st); }); setMsg(r?.msg || 'ok'); }
    catch (e) { setMsg(e.message); }
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 520, maxHeight: '92vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
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
          {noGrupo && <Pill tone="accent">no seu grupo</Pill>}
          {!noGrupo && aliado && <Pill tone="accent">aliado seu</Pill>}
          {hostil && <Pill tone="red">hostil a você</Pill>}
          {pol.lider && <Pill>liderança</Pill>}
          {pol.objetivo && <Pill>quer: {String(pol.objetivo).replace(/_/g, ' ')}</Pill>}
          {pol.estilo && <Pill>{pol.estilo.replace(/_/g, ' ')}</Pill>}
        </div>

        <div className="grid cols-2" style={{ gap: 10 }}>
          <Meter label="Influência" value={pol.influencia} tone="info" />
          <Meter label="Notoriedade" value={pol.notoriedade} tone="info" />
          <Meter label="Rejeição" value={pol.rejeicao} tone={pol.rejeicao > 40 ? 'bad' : 'warn'} />
          <Meter label={`Relação com você (${rel > 0 ? '+' : ''}${rel})`} value={clampMeter(rel)} tone={aliado ? 'ok' : hostil ? 'bad' : 'warn'} />
        </div>

        {aliados.length > 0 && <p className="small dim" style={{ marginTop: 12 }}><strong>Alianças:</strong> {aliados.join(', ')}</p>}
        {typeof pol.aprovacao === 'number' && <p className="small dim" style={{ marginTop: 6 }}><strong>Aprovação (gestão):</strong> {Math.round(pol.aprovacao)}%</p>}

        <div style={{ marginTop: 14 }}>
          <div className="small faint mono" style={{ borderBottom: '1px solid var(--line)', paddingBottom: 3, marginBottom: 8 }}>APROXIMAÇÃO</div>
          <div className="chips">
            {Object.entries(ACOES).map(([tipo, cfg]) => (
              <button key={tipo} className="btn sm ghost"
                disabled={semTempo(cfg.tempo) || (cfg.exigeContato && (pol.ultimoContatoMes ?? -99) < 0) || (cfg.dinheiro > s.financas.pessoal)}
                onClick={() => agir((st) => acaoRelacao(st, polId, tipo))}>
                {cfg.nome} <span className="faint">· {cfg.tempo}t</span>
              </button>
            ))}
            {!noGrupo && (
              <button className="btn sm"
                disabled={rel < limiarAlianca(pol)}
                title={rel < limiarAlianca(pol) ? `precisa de relação ${limiarAlianca(pol)}` : `~${Math.round(chanceAlianca(s, pol) * 100)}% de chance`}
                onClick={() => agir((st) => tentarAlianca(st, polId, { cobrarCusto: true }))}>
                Tentar aliança{rel >= limiarAlianca(pol) ? ` · 2t (${Math.round(chanceAlianca(s, pol) * 100)}%)` : ''}
              </button>
            )}
            {noGrupo && (
              <button className="btn sm ghost" style={{ color: 'var(--red)' }}
                onClick={() => agir((st) => romperAlianca(st, polId))}>
                Romper aliança
              </button>
            )}
          </div>
          {msg && <p className="small" style={{ marginTop: 8, color: 'var(--ink-soft)' }}>{msg}</p>}
        </div>

        <div style={{ marginTop: 14 }}>
          <div className="small faint mono" style={{ borderBottom: '1px solid var(--line)', paddingBottom: 3, marginBottom: 6 }}>ÚLTIMOS MOVIMENTOS</div>
          {noticias.length === 0 && <p className="small dim">Nada de relevante no noticiário recente.</p>}
          {noticias.map((n) => <p key={n.id} className="small" style={{ margin: '0 0 4px' }}>› {n.texto}</p>)}
        </div>
      </div>
    </div>
  );
}
