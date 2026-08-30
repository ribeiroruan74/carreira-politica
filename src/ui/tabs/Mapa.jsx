import { useGame } from '../../state/store';
import { Card, Meter, Pill, PageHead } from '../components/primitives';
import { corPartido } from '../../engine/voteModel';
import { militanciaResumo, totalMilitantes } from '../../engine/militancy';
import { bairrosDaCidade, nomeCidade } from '../../engine/offices';

const PROBLEMA_LABEL = {
  seguranca: 'Segurança', mobilidade: 'Mobilidade', alagamento: 'Alagamento', moradia: 'Moradia',
  saneamento: 'Saneamento', emprego: 'Emprego', saude: 'Saúde', educacao: 'Educação',
  cultura: 'Cultura', comercio: 'Comércio', meio_ambiente: 'Meio ambiente', gestao: 'Gestão',
};

function dominancia(bairroId, territorio, politicos) {
  let best = { quem: null, forca: 0, partidoId: null, nome: null };
  const pl = territorio[bairroId];
  if (pl) best = { quem: 'JOGADOR', forca: pl.presenca / 100, partidoId: 'VOCE', nome: 'Você' };
  for (const p of politicos) {
    const w = (p.baseBairros?.[bairroId] || 0) * (p.influencia / 100);
    if (w > best.forca) best = { quem: p.id, forca: w, partidoId: p.partidoId, nome: p.nome };
  }
  return best.forca < 0.08 ? { quem: null } : best;
}

export default function Mapa() {
  const s = useGame((g) => g.estado);
  const territorio = s.territorio.porBairro;
  const politicos = Object.values(s.mundo.politicos || {}).filter((p) => p.ativo);

  const cidadeBairros = bairrosDaCidade(s.personagem.cidade);
  const bairros = [...cidadeBairros]
    .map((b) => ({
      ...b,
      t: territorio[b.id] || { presenca: 0, penetracao: 0 },
      dom: dominancia(b.id, territorio, politicos),
    }))
    .sort((a, b) => b.t.presenca - a.t.presenca || b.populacao - a.populacao);

  const cobertura = bairros.filter((b) => b.t.presenca > 5).length;
  const seusBairros = bairros.filter((b) => b.dom.quem === 'JOGADOR').length;
  const militancia = militanciaResumo(s);
  const militantes = totalMilitantes(s);

  return (
    <div className="stack">
      <PageHead eyebrow={`${nomeCidade(s.personagem.cidade)} · ${cidadeBairros.length} bairros`} title="Mapa territorial">
        Você domina {seusBairros} bairro(s) e tem presença em {cobertura}. Concentrar costuma eleger; espalhar fino, não.
      </PageHead>

      {militancia.length > 0 && (
        <Card title={`Militância — ${Math.round(militantes)} voluntários`}>
          <div className="stack" style={{ gap: 6 }}>
            {militancia.map((m) => (
              <div key={m.id} className="row"><span className="grow">{m.nome}</span><span className="num">{m.voluntarios} voluntários</span></div>
            ))}
          </div>
          <p className="small dim" style={{ marginTop: 8 }}>Voluntários sustentam sua presença nesses bairros a cada mês e multiplicam a campanha ali. Sem cuidado, o núcleo esvazia.</p>
        </Card>
      )}

      <Card title="Quem manda em cada bairro">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))', gap: 6 }}>
          {bairros.map((b) => {
            const cor = b.dom.quem === 'JOGADOR' ? 'var(--accent)'
              : b.dom.quem ? corPartido(b.dom.partidoId) : 'var(--surface-3)';
            return (
              <div key={b.id} title={`${b.nome} — ${b.dom.quem === 'JOGADOR' ? 'você' : b.dom.nome || 'em disputa'}`}
                style={{
                  border: `1px solid var(--line)`, borderLeft: `4px solid ${cor}`,
                  borderRadius: 6, padding: '7px 8px', background: 'var(--surface-2)',
                  fontSize: 11, lineHeight: 1.3,
                }}>
                <div style={{ fontWeight: 600, color: 'var(--ink)' }}>{b.nome}</div>
                <div className="faint mono">{(b.populacao / 1000).toFixed(0)}k</div>
                <div style={{ color: cor, fontWeight: 500 }}>
                  {b.dom.quem === 'JOGADOR' ? 'você' : b.dom.quem ? b.dom.partidoId : '—'}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {bairros.map((b) => (
        <Card key={b.id}>
          <div className="card-head">
            <h3>{b.nome}</h3>
            <div className="chips">
              <Pill>{b.regiao}</Pill>
              <Pill tone={b.renda <= 2 ? 'amber' : b.renda >= 4 ? 'blue' : undefined}>renda {b.renda}/5</Pill>
              <Pill>{(b.populacao / 1000).toFixed(0)} mil hab.</Pill>
              {b.dom.quem && b.dom.quem !== 'JOGADOR' && (
                <Pill tone="red">reduto de {b.dom.nome} ({b.dom.partidoId})</Pill>
              )}
              {b.dom.quem === 'JOGADOR' && <Pill tone="accent">seu reduto</Pill>}
            </div>
          </div>
          <div className="chips" style={{ marginBottom: 10 }}>
            {b.problemas.map((p) => <Pill key={p} tone="red">{PROBLEMA_LABEL[p] || p}</Pill>)}
          </div>
          <div className="grid cols-2" style={{ gap: 10 }}>
            <Meter label="Sua presença" value={b.t.presenca} tone={b.t.presenca > 30 ? 'ok' : 'warn'} />
            <Meter label="Penetração (voto firme)" value={b.t.penetracao} tone="info" />
          </div>
        </Card>
      ))}
    </div>
  );
}
