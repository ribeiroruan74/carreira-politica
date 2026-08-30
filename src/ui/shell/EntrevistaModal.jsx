import { useState } from 'react';
import { useGame } from '../../state/store';

export default function EntrevistaModal() {
  const e = useGame((g) => g.estado?.entrevistaAtiva);
  const responder = useGame((g) => g.responderEntrevista);
  const fechar = useGame((g) => g.fecharEntrevista);
  const [travado, setTravado] = useState(false);

  if (!e) return null;

  if (e.concluida) {
    return (
      <div className="overlay">
        <div className="modal" style={{ maxWidth: 480 }}>
          <p className="eyebrow">Fim da entrevista</p>
          <h2 style={{ marginBottom: 8 }}>{e.concluida.manchete}</h2>
          <p className="small dim">{e.concluida.resumo}</p>
          <button className="btn block" style={{ marginTop: 16 }} onClick={fechar}>Continuar</button>
        </div>
      </div>
    );
  }

  const p = e.perguntas[e.idx];

  function escolher(i) {
    setTravado(true);
    responder(i);
    setTravado(false);
  }

  return (
    <div className="overlay">
      <div className="modal" style={{ maxWidth: 520 }}>
        <p className="eyebrow">{e.jornalistaNome} · {e.veiculoNome} · pergunta {e.idx + 1}/{e.perguntas.length}</p>
        {e.idx === 0 && <p className="small faint" style={{ marginTop: -4 }}>"{e.abertura}"</p>}
        <h3 style={{ margin: '10px 0 14px' }}>{p.texto}</h3>
        <div className="stack" style={{ gap: 8 }}>
          {p.tons.map((t, i) => (
            <button key={i} className="btn ghost" disabled={travado}
              style={{ textAlign: 'left', justifyContent: 'flex-start' }}
              onClick={() => escolher(i)}>
              {t.texto}
            </button>
          ))}
        </div>
        <div className="track" style={{ marginTop: 16, height: 5 }}>
          <div className="fill" style={{ width: `${(e.idx / e.perguntas.length) * 100}%` }} />
        </div>
      </div>
    </div>
  );
}
