import { useGame } from '../../state/store';
import { nomeMes } from '../../engine/tick';
import partiesDef from '../../content/parties.json';
import { cargoPorId } from '../../engine/offices';

function dinheiroCurto(n) {
  const neg = n < 0 ? '-' : '';
  n = Math.abs(n);
  if (n >= 1e6) return `${neg}R$${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M`;
  if (n >= 1e3) return `${neg}R$${Math.round(n / 1e3)}k`;
  return `${neg}R$${Math.round(n)}`;
}

const FASE_LABEL = {
  VIDA: 'Vida pessoal',
  VIDA_PUBLICA: 'Vida pública',
  PARTIDO: 'Filiado',
  CANDIDATO: 'Em campanha',
  MANDATO: null, // usa o nome do cargo
};

export default function TopBar() {
  const s = useGame((g) => g.estado);
  if (!s) return null;
  const { personagem: p, tempo, financas } = s;
  const partido = partiesDef.partidos.find((x) => x.id === p.partidoId);
  const ano = tempo.anoInicial + Math.floor(tempo.mes / 12);
  const cargo = p.cargoAtual && p.cargoAtual !== 'NENHUM' ? cargoPorId(p.cargoAtual)?.nome : null;
  const status = cargo || FASE_LABEL[p.fase] || '—';
  const energiaPct = Math.max(0, Math.min(100, (tempo.energia / (tempo.energiaMax || 100)) * 100));

  return (
    <header className="topbar" style={{ paddingTop: 'max(10px, env(safe-area-inset-top))' }}>
      <div className="tb-id">
        <strong>{p.nome}</strong>
        <span className="tb-sub mono">{status}{partido ? ` · ${partido.id}` : ''}</span>
      </div>

      <div className="tb-right">
        <div className="tb-chip" title="Caixa pessoal">
          <span className="tb-chip-k">💰</span>
          <span className="tb-chip-v mono">{dinheiroCurto(financas.pessoal)}</span>
        </div>
        <div className="tb-chip" title="Tempo do mês">
          <span className="tb-chip-k">⏳</span>
          <span className="tb-chip-v mono">{tempo.pontosRestantes}</span>
        </div>
        <div className="tb-chip" title={`Energia ${Math.round(tempo.energia)}`}>
          <span className="tb-chip-k">⚡</span>
          <span className="tb-energy"><span className="tb-energy-fill" style={{ width: `${energiaPct}%` }} /></span>
        </div>
        <div className="tb-date mono">{nomeMes(tempo.mes)}/{String(ano).slice(2)}</div>
      </div>
    </header>
  );
}
