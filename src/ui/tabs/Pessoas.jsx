import { useState } from 'react';
import { useGame } from '../../state/store';
import { Card, Pill, Meter, PageHead } from '../components/primitives';
import FichaPolitico from '../components/FichaPolitico';

const NIVEL_TONE = { DESCONHECIDO: undefined, CONHECIDO: undefined, CONTATO: 'blue', AMIGO: 'accent', ALIADO: 'accent', PARCEIRO: 'accent' };

function eixoLabel(e) {
  if (e <= -50) return 'esquerda';
  if (e <= -15) return 'centro-esquerda';
  if (e < 15) return 'centro';
  if (e < 50) return 'centro-direita';
  return 'direita';
}

export default function Pessoas() {
  const estado = useGame((g) => g.estado);
  const pessoas = Object.values(estado.relacionamentos.pessoas);
  const [ordem, setOrdem] = useState('confianca');
  const [ficha, setFicha] = useState(null);

  const politicos = Object.values(estado.mundo.politicos || {})
    .filter((p) => p.ativo)
    .sort((a, b) => (b.relacaoJogador - a.relacaoJogador) || (b.influencia - a.influencia));

  const ordenadas = [...pessoas].sort((a, b) => {
    if (ordem === 'influencia') return b.influencia - a.influencia;
    return b.confianca - a.confianca;
  });

  const porNivel = pessoas.reduce((acc, p) => { acc[p.nivel] = (acc[p.nivel] || 0) + 1; return acc; }, {});

  return (
    <div className="stack">
      <PageHead eyebrow="Rede de relacionamentos" title={`${pessoas.length} pessoas na sua rede`}>
        Conhecer alguém não é ganhar um favor. Vínculo se constrói: conhecido → contato → amigo → aliado → parceiro. E pode esfriar se você sumir.
      </PageHead>

      <Card>
        <div className="chips">
          {['CONHECIDO', 'CONTATO', 'AMIGO', 'ALIADO', 'PARCEIRO'].map((n) => (
            <Pill key={n} tone={NIVEL_TONE[n]}>{n.toLowerCase()}: {porNivel[n] || 0}</Pill>
          ))}
        </div>
        <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
          <button className={`btn sm ${ordem === 'confianca' ? '' : 'ghost'}`} onClick={() => setOrdem('confianca')}>por confiança</button>
          <button className={`btn sm ${ordem === 'influencia' ? '' : 'ghost'}`} onClick={() => setOrdem('influencia')}>por influência</button>
        </div>
      </Card>

      {ordenadas.map((p) => (
        <Card key={p.id}>
          <div className="card-head">
            <h3>{p.nome}</h3>
            <Pill tone={NIVEL_TONE[p.nivel]}>{p.nivel.toLowerCase()}</Pill>
          </div>
          <p className="small dim">{p.papel}{p.origem ? ` · conheceu em: ${p.origem}` : ''} · {eixoLabel(p.ideologiaEixo)}</p>
          <div className="grid cols-2" style={{ gap: 10, marginTop: 10 }}>
            <Meter label="Confiança em você" value={p.confianca} tone={p.confianca > 55 ? 'ok' : 'warn'} />
            <Meter label="Influência" value={p.influencia} tone="info" />
          </div>
        </Card>
      ))}
      {pessoas.length === 0 && <Card><p className="dim small">Sua rede está vazia. Use a Agenda para fazer networking.</p></Card>}

      {politicos.length > 0 && (
        <Card title="Cenário político" aside={`${politicos.length} atores`}>
          <p className="small dim" style={{ marginBottom: 10 }}>Vereadores, lideranças e o Executivo. Clique para ver a ficha.</p>
          <div className="stack" style={{ gap: 4 }}>
            {politicos.slice(0, 24).map((p) => {
              const rel = Math.round(p.relacaoJogador || 0);
              return (
                <button key={p.id} className="row" onClick={() => setFicha(p.id)}
                  style={{ background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', padding: '4px 0', width: '100%' }}>
                  <span className="grow">
                    <span className="name">{p.nome}</span> <span className="small faint">{p.partidoId} · {(p.cargo || '').replace(/_/g, ' ').toLowerCase()}</span>
                  </span>
                  <Pill tone={rel > 20 ? 'accent' : rel < -10 ? 'red' : undefined}>rel {rel > 0 ? '+' : ''}{rel}</Pill>
                  <span className="faint small" style={{ width: 48, textAlign: 'right' }}>infl {p.influencia}</span>
                </button>
              );
            })}
          </div>
        </Card>
      )}

      {ficha && <FichaPolitico polId={ficha} onClose={() => setFicha(null)} />}
    </div>
  );
}
