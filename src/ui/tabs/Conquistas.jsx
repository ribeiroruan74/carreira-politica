import { useGame } from '../../state/store';
import { Card, PageHead, Pill } from '../components/primitives';
import { conquistasResumo } from '../../engine/achievements';
import { nomeMes } from '../../engine/tick';

export default function Conquistas() {
  const s = useGame((g) => g.estado);
  const { total, feitas, grupos } = conquistasResumo(s);
  const pct = Math.round((feitas / total) * 100);

  return (
    <div className="stack">
      <PageHead eyebrow="Conquistas" title={`${feitas} de ${total} desbloqueadas`}>
        Marcos da sua trajetória política. Algumas aparecem sozinhas conforme o jogo anda;
        outras exigem que você vá atrás.
      </PageHead>

      <Card>
        <div style={{ height: 10, background: 'var(--surface-3)', borderRadius: 6, overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: 'var(--accent)' }} />
        </div>
        <p className="small dim" style={{ marginTop: 8 }}>{pct}% completo</p>
      </Card>

      {Object.entries(grupos).map(([grupo, itens]) => (
        <Card key={grupo} title={grupo} aside={`${itens.filter((i) => i.feita).length}/${itens.length}`}>
          <div className="stack" style={{ gap: 8 }}>
            {itens.map((c) => (
              <div key={c.id} className="row" style={{ alignItems: 'baseline', opacity: c.feita ? 1 : 0.5 }}>
                <span style={{ fontSize: '1.3rem', width: 30, filter: c.feita ? 'none' : 'grayscale(1)' }}>{c.icone}</span>
                <span className="grow">
                  <strong>{c.nome}</strong>
                  <br /><span className="small dim">{c.desc}</span>
                </span>
                {c.feita
                  ? <Pill tone="accent">{nomeMes(c.mes)}/{s.tempo.anoInicial + Math.floor(c.mes / 12)}</Pill>
                  : <Pill>bloqueada</Pill>}
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}
