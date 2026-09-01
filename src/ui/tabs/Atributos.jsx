import { useState } from 'react';
import { useGame } from '../../state/store';
import { Card, Meter, Pill, PageHead } from '../components/primitives';
import { formatBRL } from '../../engine/tick';
import { progressoAtributo, TREINAVEIS_IDS, CUSTO_TREINO, treinarAtributoPago } from '../../engine/attributes';
import attributesDef from '../../content/attributes.json';
import professionsDef from '../../content/professions.json';

export default function Atributos() {
  const s = useGame((g) => g.estado);
  const aplicar = useGame((g) => g.aplicar);
  const [msg, setMsg] = useState(null);
  const { personagem: p, financas } = s;
  const prof = professionsDef.profissoes.find((x) => x.id === p.profissaoId);
  const traço = attributesDef.traços.find((t) => t.id === p.traçoId);

  const podeTreinar = financas.pessoal >= CUSTO_TREINO.dinheiro && s.tempo.energia >= CUSTO_TREINO.energia;

  function treinar(attrId) {
    try { let r; aplicar((st) => { r = treinarAtributoPago(st, attrId); }); setMsg(r ? `${attrId} +1` : null); }
    catch (e) { setMsg(e.message); }
  }

  return (
    <div className="stack">
      <PageHead eyebrow={`${p.idade} anos · ${prof?.nome || ''}${traço ? ` · ${traço.nome}` : ''}`} title={p.nome} />

      <Card title="Atributos" aside={`treino: ${formatBRL(CUSTO_TREINO.dinheiro)} + ${CUSTO_TREINO.energia}⚡`}>
        <div className="stack" style={{ gap: 10 }}>
          {attributesDef.atributos.map((a) => {
            const v = p.atributos[a.id] ?? 0;
            const treinavel = TREINAVEIS_IDS.has(a.id);
            const noTeto = treinavel && progressoAtributo(s, a.id).noTeto;
            return (
              <div key={a.id} className="row" style={{ alignItems: 'center', gap: 10 }}>
                <span className="grow"><Meter label={a.nome} value={v} tone={v >= 60 ? 'ok' : v <= 35 ? 'bad' : 'warn'} /></span>
                {treinavel && !noTeto && (
                  <button className="btn sm ghost" style={{ flexShrink: 0 }} disabled={!podeTreinar} onClick={() => treinar(a.id)}>+1</button>
                )}
                {noTeto && <span className="small faint" style={{ flexShrink: 0 }}>teto</span>}
              </div>
            );
          })}
        </div>
        {msg && <p className="small" style={{ marginTop: 8, color: 'var(--ink-soft)' }}>{msg}</p>}
      </Card>

      {Object.keys(p.skills).length > 0 && (
        <Card title="Habilidades">
          <div className="stack" style={{ gap: 8 }}>
            {Object.entries(p.skills).map(([k, v]) => (
              <Meter key={k} label={k.replace(/_/g, ' ')} value={v} tone="info" />
            ))}
          </div>
        </Card>
      )}

      {(prof?.contatos || []).length > 0 && (
        <Card title="Contatos herdados da profissão">
          <div className="chips">
            {prof.contatos.map((c) => <Pill key={c}>{c.replace(/_/g, ' ')}</Pill>)}
          </div>
        </Card>
      )}
    </div>
  );
}
