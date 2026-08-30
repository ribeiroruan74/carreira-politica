import { useGame } from '../../state/store';
import { nomeMes, formatBRL } from '../../engine/tick';
import partiesDef from '../../content/parties.json';

const FASE_LABEL = {
  VIDA: 'Vida pessoal',
  VIDA_PUBLICA: 'Vida pública',
  PARTIDO: 'Filiado',
  CANDIDATO: 'Em campanha',
  MANDATO: 'No mandato',
};

export default function TopBar() {
  const s = useGame((g) => g.estado);
  if (!s) return null;
  const { personagem: p, tempo, financas, reputacao, redes } = s;
  const partido = partiesDef.partidos.find((x) => x.id === p.partidoId);
  const ano = tempo.anoInicial + Math.floor(tempo.mes / 12);

  return (
    <header className="topbar">
      <div className="id">
        <strong>{p.nome}</strong>
        <span className="small faint mono">
          {FASE_LABEL[p.fase]}{partido ? ` · ${partido.id}` : ''} · {nomeMes(tempo.mes)}/{ano}
        </span>
      </div>
      <div className="metrics">
        <div className="metric"><span className="k">Aprov.</span><span className="v">{Math.round(reputacao.aprovacao)}%</span></div>
        <div className="metric"><span className="k">Rejei.</span><span className="v">{Math.round(reputacao.rejeicao)}%</span></div>
        <div className="metric"><span className="k">Notor.</span><span className="v">{Math.round(reputacao.notoriedade)}</span></div>
        <div className="metric"><span className="k">Caixa pessoal</span><span className="v">{formatBRL(financas.pessoal)}</span></div>
        <div className="metric"><span className="k">Seguidores</span><span className="v">{redes.seguidores.toLocaleString('pt-BR')}</span></div>
        <div className="metric"><span className="k">Tempo</span><span className="v">{tempo.pontosRestantes}/{tempo.pontosPorMes}</span></div>
        <div className="metric"><span className="k">Energia</span><span className="v">{Math.round(tempo.energia)}</span></div>
      </div>
    </header>
  );
}
