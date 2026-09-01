import { useGame } from '../../state/store';
import { Card, PageHead, Pill } from '../components/primitives';
import { nomeMes } from '../../engine/tick';
import { rotuloClima, eventoNacionalAtual } from '../../engine/national';
import { bairrosDaCidade, nomeCidade } from '../../engine/offices';

const PROB = {
  agua: 'falta de água', alagamento: 'alagamentos', comercio: 'comércio', emprego: 'emprego',
  gestao: 'gestão', moradia: 'moradia', saude: 'saúde', seguranca: 'segurança',
  transporte: 'transporte', educacao: 'educação', mobilidade: 'mobilidade', turismo: 'turismo',
};

export default function Mundo() {
  const s = useGame((g) => g.estado);
  const bairros = bairrosDaCidade(s.personagem.cidade);
  const evNac = eventoNacionalAtual(s);

  // problemas mais citados nos bairros
  const contagem = {};
  for (const b of bairros) for (const p of b.problemas || []) contagem[p] = (contagem[p] || 0) + 1;
  const topProblemas = Object.entries(contagem).sort((a, b) => b[1] - a[1]).slice(0, 6);

  const acontecimentos = s.log
    .filter((l) => ['CIDADE', 'CRISE', 'MARCO'].includes(l.tipo))
    .slice(0, 10);

  return (
    <div className="stack">
      <PageHead eyebrow={`${nomeCidade(s.personagem.cidade)} · ${bairros.length} bairros`} title="O que acontece" />

      <Card title="Cenário nacional">
        <p className="small dim" style={{ marginTop: 0 }}>{rotuloClima(s)}</p>
        {evNac && <p className="small" style={{ marginTop: 6 }}>▸ {evNac.texto || evNac.nome}</p>}
      </Card>

      <Card title="Problemas mais cobrados nos bairros">
        {topProblemas.length === 0
          ? <p className="small dim">Nada em destaque agora.</p>
          : <div className="chips">{topProblemas.map(([p, n]) => <Pill key={p} tone="red">{PROB[p] || p} · {n}</Pill>)}</div>}
      </Card>

      <Card title="Últimos acontecimentos">
        {acontecimentos.length === 0 && <p className="small dim">Silêncio por enquanto.</p>}
        {acontecimentos.map((l, i) => (
          <div key={i} className="log-item">
            <span className="when">{nomeMes(l.mes)}/{s.tempo.anoInicial + Math.floor(l.mes / 12)}</span>
            <span className="txt">{l.texto}</span>
          </div>
        ))}
      </Card>
    </div>
  );
}
