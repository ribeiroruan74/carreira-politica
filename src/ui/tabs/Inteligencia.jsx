import { useGame } from '../../state/store';
import { Card, PageHead } from '../components/primitives';
import { relatorios } from '../../engine/intel';

export default function Inteligencia() {
  const s = useGame((g) => g.estado);
  const rels = relatorios(s);

  return (
    <div className="stack">
      <PageHead eyebrow="Central de Inteligência" title="O que sua equipe está vendo">
        Relatórios montados a partir dos dados reais do jogo. A leitura da situação pode estar errada — os números, não.
      </PageHead>

      {rels.map((r) => (
        <Card key={r.area}
          className=""
          style={r.alerta ? { borderLeft: '4px solid var(--red)' } : r.recomendacao ? { borderLeft: '4px solid var(--accent)' } : undefined}
        >
          <div className="card-head" style={{ marginBottom: 8 }}>
            <h3>{r.ico} {r.area}</h3>
          </div>
          <div className="stack" style={{ gap: 6 }}>
            {r.linhas.map((l, i) => (
              <p key={i} className="small" style={{ margin: 0, color: r.alerta && i === 0 ? 'var(--red)' : undefined }}>
                {l}
              </p>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}
