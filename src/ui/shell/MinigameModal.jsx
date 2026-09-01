import { useState } from 'react';
import { useGame } from '../../state/store';

const TIER_COR = { otimo: 'var(--accent)', bom: 'var(--accent)', neutro: 'var(--ink-soft)', ruim: 'var(--red)' };

export default function MinigameModal() {
  const mg = useGame((g) => g.estado?.minigameAtivo);
  const responder = useGame((g) => g.responderMinigame);
  const fechar = useGame((g) => g.fecharMinigame);
  const [travado, setTravado] = useState(false);

  if (!mg) return null;

  if (mg.concluido) {
    return (
      <div className="overlay">
        <div className="modal" style={{ maxWidth: 460, alignItems: 'flex-end' }}>
          <p className="eyebrow" style={{ color: TIER_COR[mg.concluido.tier] }}>{mg.titulo}</p>
          <h2 style={{ marginBottom: 8 }}>{mg.concluido.titulo}</h2>
          {mg.concluido.resumo && <p className="small dim">{mg.concluido.resumo}</p>}
          <button className="btn block" style={{ marginTop: 16 }} onClick={fechar}>Continuar</button>
        </div>
      </div>
    );
  }

  const passo = mg.passos[mg.idx];

  function escolher(i) {
    setTravado(true);
    responder(i);
    setTravado(false);
  }

  return (
    <div className="overlay">
      <div className="modal" style={{ maxWidth: 520 }}>
        <p className="eyebrow">{mg.titulo} · passo {mg.idx + 1}/{mg.passos.length}</p>
        <h3 style={{ margin: '10px 0 14px' }}>{passo.prompt}</h3>
        <div className="stack" style={{ gap: 8 }}>
          {passo.opcoes.map((o, i) => (
            <button key={i} className="btn ghost" disabled={travado}
              style={{ textAlign: 'left', justifyContent: 'flex-start' }}
              onClick={() => escolher(i)}>
              {o.texto}
            </button>
          ))}
        </div>
        <div className="track" style={{ marginTop: 16, height: 5 }}>
          <div className="fill" style={{ width: `${(mg.idx / mg.passos.length) * 100}%` }} />
        </div>
      </div>
    </div>
  );
}
