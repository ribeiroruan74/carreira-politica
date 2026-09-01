import { useState } from 'react';
import { useGame } from '../../state/store';
import { Card, PageHead, Pill, Meter } from '../components/primitives';
import { contatosTelefone, ligar } from '../../engine/phone';
import { acaoRelacao } from '../../engine/world';

const relMeter = (v) => Math.max(0, Math.min(100, v + 50));

function Linha({ nome, sub, rel, chance, prontos, cooldownAte, disabled, onLigar }) {
  return (
    <div className="row" style={{ alignItems: 'baseline', padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
      <span className="grow">
        <strong>{nome}</strong> <span className="small dim">· {sub}</span>
        <br />
        <span className="small dim">
          relação {rel > 0 ? '+' : ''}{rel}
          {prontos ? ` · atende ~${chance}%` : ` · "liga depois" até o mês ${cooldownAte}`}
        </span>
        <div style={{ maxWidth: 180, marginTop: 3 }}><Meter value={relMeter(rel)} tone={rel >= 25 ? 'ok' : rel <= -10 ? 'bad' : 'warn'} /></div>
      </span>
      <button className="btn sm ghost" disabled={disabled || !prontos} onClick={onLigar}>Ligar · 1t</button>
    </div>
  );
}

export default function Telefone() {
  const s = useGame((g) => g.estado);
  const aplicar = useGame((g) => g.aplicar);
  const [msg, setMsg] = useState(null);
  const semTempo = s.tempo.energia < 1;

  const { midia, famosos } = contatosTelefone(s);
  const politicos = Object.values(s.mundo.politicos || {})
    .filter((p) => p.ativo && (p.relacaoJogador > 5 || p.influencia > 60))
    .sort((a, b) => b.relacaoJogador - a.relacaoJogador || b.influencia - a.influencia)
    .slice(0, 10);

  function chamar(fn) {
    try { let r; aplicar((st) => { r = fn(st); }); setMsg(r?.msg || 'ok'); }
    catch (e) { setMsg(e.message); }
  }

  return (
    <div className="stack">
      <PageHead eyebrow="Telefone" title="Rede de contatos">
        Uma ligação pode render uma conversa, um encontro, um convite de entrevista — ou um "me liga depois".
        Quem não te conhece raramente atende. Nada disso vira voto direto.
      </PageHead>

      {msg && <Card><p className="small" style={{ margin: 0 }}>{msg}</p></Card>}

      <Card title="📰 Mídia">
        {midia.map((c) => (
          <Linha key={c.id} {...c} sub={c.sub} disabled={semTempo}
            onLigar={() => chamar((st) => ligar(st, c.id))} />
        ))}
      </Card>

      <Card title="🌟 Famosos">
        {famosos.map((c) => (
          <Linha key={c.id} {...c} sub={`${c.tipo} · ${c.sub}`} disabled={semTempo}
            onLigar={() => chamar((st) => ligar(st, c.id))} />
        ))}
      </Card>

      {politicos.length > 0 && (
        <Card title="🏛️ Políticos" aside={<Pill>ligação rápida</Pill>}>
          <p className="small dim" style={{ marginBottom: 8 }}>Para o leque completo de interações, abra a ficha na aba Pessoas ou Política.</p>
          {politicos.map((p) => (
            <div key={p.id} className="row" style={{ alignItems: 'baseline', padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
              <span className="grow">
                <strong>{p.nome}</strong> <span className="small dim">· {p.partidoId} · {(p.cargo || '').replace(/_/g, ' ')} · relação {Math.round(p.relacaoJogador)}</span>
              </span>
              <button className="btn sm ghost" disabled={semTempo}
                onClick={() => chamar((st) => acaoRelacao(st, p.id, 'telefonar'))}>Ligar · 1t</button>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
