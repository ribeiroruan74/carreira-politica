import { useGame } from '../../state/store';
import { Card, PageHead, Sparkline, Meter, Pill } from '../components/primitives';
import { corPartido } from '../../engine/voteModel';
import { resumoSatisfacao } from '../../engine/electorate';
import { nomeMes } from '../../engine/tick';
import partiesDef from '../../content/parties.json';

const MARCO_TONE = { ELEICAO: 'accent', CRISE: 'red', CONQUISTA: 'accent', MANDATO: 'amber', MIDIA: 'amber', CARREIRA: 'amber' };

export default function Pesquisas() {
  const s = useGame((g) => g.estado);
  const serie = s.series || [];
  const col = (k) => serie.map((p) => p[k]).filter((v) => v != null);

  const partidosRank = Object.entries(s.mundo.partidosRuntime || {})
    .map(([id, pr]) => ({ id, ...pr, nome: partiesDef.partidos.find((p) => p.id === id)?.nome }))
    .sort((a, b) => b.popularidade - a.popularidade)
    .slice(0, 8);

  const prefeito = Object.values(s.mundo.politicos || {}).find((p) => p.cargo === 'PREFEITO');
  const ultimaPesquisa = s.eleicao?.pesquisas?.at(-1);

  // Fase 28 — marcos na janela da série, como linhas verticais
  const mesMin = serie.length ? serie[0].mes : 0;
  const mesMax = serie.length ? serie[serie.length - 1].mes : 1;
  const spanMes = mesMax - mesMin || 1;
  const marcos = (s.marcos || []).filter((m) => m.mes >= mesMin && m.mes <= mesMax);
  const marks = marcos.map((m) => ({ pos: (m.mes - mesMin) / spanMes, tone: MARCO_TONE[m.tipo] || 'amber' }));

  return (
    <div className="stack">
      <PageHead eyebrow="Pesquisas e opinião" title="Como o Recife te enxerga">
        Números de opinião pública. Eles se movem sozinhos — com o que você faz, com o que a imprensa diz, com o que os adversários fazem.
      </PageHead>

      <div className="grid cols-2">
        <Card title="Sua aprovação e rejeição">
          {serie.length > 1 ? <Sparkline data={col('aprovacao')} width={260} height={44} marks={marks} /> : <p className="small faint">Avance alguns meses para ver a série.</p>}
          <div className="stack" style={{ gap: 8, marginTop: 10 }}>
            <Meter label="Aprovação" value={s.reputacao.aprovacao} />
            <Meter label="Rejeição" value={s.reputacao.rejeicao} tone={s.reputacao.rejeicao > 35 ? 'bad' : 'warn'} />
            <Meter label="Confiança" value={s.reputacao.confianca} tone="info" />
          </div>
        </Card>

        <Card title="Sua notoriedade">
          {serie.length > 1 && <Sparkline data={col('notoriedade')} width={260} height={44} marks={marks} />}
          <Meter label="Notoriedade" value={s.reputacao.notoriedade} tone="info" />
          <p className="small faint" style={{ marginTop: 8 }}>
            {s.reputacao.notoriedade < 15 ? 'Você ainda é um nome pouco conhecido.'
              : s.reputacao.notoriedade < 40 ? 'Reconhecido em alguns círculos.'
                : s.reputacao.notoriedade < 70 ? 'Nome conhecido na cidade.' : 'Figura pública de peso.'}
          </p>
        </Card>
      </div>

      {ultimaPesquisa && (
        <Card title={`Intenção de voto — Vereador (${ultimaPesquisa.mes}º mês de campanha)`} aside={`margem ±${ultimaPesquisa.margemErro}pp`}>
          {ultimaPesquisa.linhas.slice(0, 10).map((l, i) => (
            <div key={l.id} className="row" style={l.jogador ? { background: 'var(--accent-soft)', borderRadius: 6 } : undefined}>
              <span className="faint mono" style={{ width: 22 }}>{i + 1}</span>
              <span className="grow name">{l.nome} <span className="pill" style={{ borderColor: corPartido(l.partidoId), color: corPartido(l.partidoId) }}>{l.partidoId}</span></span>
              <span className="num"><strong>{l.pct}%</strong></span>
            </div>
          ))}
        </Card>
      )}

      {(() => {
        const sat = resumoSatisfacao(s);
        if (!sat.some((x) => x.valor !== 0)) return null;
        return (
          <Card title="Satisfação por grupo social" aside="−100 a +100">
            <p className="small dim" style={{ marginBottom: 10 }}>
              Quão contente cada grupo está com a sua atuação. Entregas nas pautas de um grupo sobem esse número; abandono e desalinhamento o derrubam. Pesa no voto.
            </p>
            <div className="stack" style={{ gap: 6 }}>
              {sat.map((g) => (
                <div key={g.id} className="row">
                  <span className="grow">{g.nome}</span>
                  <span className="num" style={{ color: g.valor >= 15 ? 'var(--accent)' : g.valor <= -15 ? 'var(--red)' : 'var(--ink)' }}>
                    {g.valor > 0 ? '+' : ''}{g.valor}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        );
      })()}

      {marcos.length > 0 && (
        <Card title="Linha do tempo" aside={`${marcos.length} marcos`}>
          <p className="small dim" style={{ marginBottom: 8 }}>As linhas tracejadas nos gráficos acima marcam estes momentos.</p>
          <div className="stack" style={{ gap: 4 }}>
            {[...marcos].reverse().map((m, i) => (
              <div key={i} className="row">
                <span className="faint mono small" style={{ width: 64 }}>{nomeMes(m.mes)}/{s.tempo.anoInicial + Math.floor(m.mes / 12)}</span>
                <span className="grow small">{m.texto}</span>
                <Pill tone={MARCO_TONE[m.tipo]}>{m.tipo.toLowerCase()}</Pill>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card title="Popularidade dos partidos no Recife">
        {partidosRank.map((p) => (
          <div key={p.id} className="row">
            <span className="grow">
              <span className="pill" style={{ borderColor: corPartido(p.id), color: corPartido(p.id) }}>{p.id}</span>
              {' '}{p.nome} {p.id === s.personagem.partidoId && <Pill tone="accent">seu partido</Pill>}
            </span>
            <span className="num">{Math.round(p.popularidade)}</span>
            <span className="faint small" style={{ width: 70, textAlign: 'right' }}>{p.bancada} cadeira(s)</span>
          </div>
        ))}
      </Card>

      {prefeito && (
        <Card title="Governo municipal">
          <div className="row"><span className="grow name">{prefeito.nome} ({prefeito.partidoId}) — prefeito</span></div>
          <Meter label="Notoriedade / presença pública" value={prefeito.notoriedade} tone="info" />
          <Meter label="Rejeição" value={prefeito.rejeicao} tone={prefeito.rejeicao > 35 ? 'bad' : 'warn'} />
        </Card>
      )}
    </div>
  );
}
