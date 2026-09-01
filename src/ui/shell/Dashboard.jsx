import { useGame } from '../../state/store';
import { formatBRL, nomeMes } from '../../engine/tick';
import { relevanciaMidiatica } from '../../engine/social';
import { cargoPorId } from '../../engine/offices';
import { janelaCandidatura } from '../../engine/calendar';

const TIPO_STYLE = {
  'decisão': { pill: 'red', lbl: 'Decisão' },
  'oportunidade': { pill: 'accent', lbl: 'Oportunidade' },
  'convite': { pill: 'blue', lbl: 'Convite' },
  'problema': { pill: 'amber', lbl: 'Problema' },
  'notícia': { pill: '', lbl: 'Notícia' },
};

function fmtCompact(n) {
  const neg = n < 0 ? '-' : '';
  n = Math.abs(n);
  if (n >= 1e6) return `${neg}${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M`;
  if (n >= 1e3) return `${neg}${(n / 1e3).toFixed(n >= 1e4 ? 0 : 1)}k`;
  return `${neg}${Math.round(n)}`;
}
const fmtDin = (n) => (Math.abs(n) >= 100000 ? `R$ ${fmtCompact(n)}` : formatBRL(n));

function proximoPasso(s) {
  const f = s.personagem.fase;
  if (f === 'VIDA') return 'Construa vida pública: ativismo e liderança comunitária abrem caminho para um partido.';
  if (f === 'VIDA_PUBLICA') return 'Filie-se a um partido para poder disputar uma eleição.';
  if (f === 'CANDIDATO') return `Campanha em andamento — eleição em ${nomeMes(s.eleicao?.mesPleito ?? 0)}/${s.eleicao?.anoPleito ?? ''}.`;
  if (f === 'PARTIDO' || f === 'MANDATO') {
    const j = janelaCandidatura(s);
    if (j.aberta) return `A janela de candidatura para ${j.ano} está ABERTA — decida na Agenda.`;
    return `Próxima eleição: ${nomeMes(j.mes)}/${j.ano}. Janela abre em ${j.mesesAteAbrir} mês(es).`;
  }
  return '';
}

function StatTile({ ico, k, v, sub, tone }) {
  return (
    <div className={`stile ${tone || ''}`}>
      <div className="stile-top"><span className="stile-ico">{ico}</span><span className="stile-k">{k}</span></div>
      <div className="stile-v mono">{v}</div>
      {sub && <div className="stile-sub">{sub}</div>}
    </div>
  );
}

export default function Dashboard({ irPara, feed = [] }) {
  const s = useGame((g) => g.estado);
  const avancarMes = useGame((g) => g.avancarMes);
  const { personagem: p, tempo, financas, reputacao, redes, mundo } = s;
  const ano = tempo.anoInicial + Math.floor(tempo.mes / 12);
  const cargo = p.cargoAtual && p.cargoAtual !== 'NENHUM' ? cargoPorId(p.cargoAtual)?.nome : null;
  const pr = mundo.partidosRuntime?.[p.partidoId];
  const popular = pr ? Math.round(pr.popularidade) : Math.round(reputacao.notoriedade);
  const fama = relevanciaMidiatica(s);

  return (
    <div className="stack dash">
      <div className="dash-hero">
        <div className="dash-hero-id">
          <h2>{p.nome}</h2>
          <p className="dim small" style={{ margin: '2px 0 0' }}>
            {cargo || 'Sem cargo'} · {p.idade} anos
          </p>
        </div>
        <button className="btn dash-adv" disabled={!!s.eventoPendente} onClick={avancarMes}>
          Avançar&nbsp;mês →
        </button>
      </div>

      <div className="stile-grid">
        <StatTile ico="💰" k="Dinheiro" v={fmtDin(financas.pessoal)} sub={`${fmtDin(financas.rendaMensal)}/mês`} />
        <StatTile ico="👍" k="Aprovação" v={`${Math.round(reputacao.aprovacao)}%`} sub={`Rejeição ${Math.round(reputacao.rejeicao)}%`} tone={reputacao.aprovacao >= 50 ? 'good' : reputacao.rejeicao > 35 ? 'bad' : ''} />
        <StatTile ico="⭐" k="Fama" v={`${fama}`} sub={`Notoriedade ${Math.round(reputacao.notoriedade)}`} />
        <StatTile ico="📣" k="Seguidores" v={fmtCompact(redes.seguidores)} sub={`${redes.crescimentoMensal >= 0 ? '+' : ''}${fmtCompact(redes.crescimentoMensal)} no mês`} />
        <StatTile ico="🏛️" k="Popularidade" v={`${popular}`} sub={pr ? 'do seu partido' : 'notoriedade'} />
        <StatTile ico="🎖️" k="Influência" v={`${Math.round(p.atributos.influencia ?? 45)}`} sub={`${(p.grupoPolitico || []).length} aliado(s)`} />
        <StatTile ico="⚡" k="Energia" v={`${Math.round(tempo.energia)}`} sub={`Tempo ${tempo.pontosRestantes}/${tempo.pontosPorMes}`} tone={tempo.energia < 30 ? 'bad' : ''} />
        <StatTile ico="📅" k="Data" v={`${nomeMes(tempo.mes)}/${String(ano).slice(2)}`} sub={`mês ${tempo.mes}`} />
      </div>

      <div className="card dash-next">
        <div className="card-head"><h3>Próximo passo</h3></div>
        <p className="small dim" style={{ margin: 0 }}>{proximoPasso(s)}</p>
        <button className="btn ghost sm" style={{ marginTop: 12 }} onClick={() => irPara('agenda')}>Abrir a Agenda</button>
      </div>

      <div className="dash-feed">
        <div className="feed-head"><h3>Acontecendo agora</h3><span className="pill">{feed.length}</span></div>
        {feed.length === 0 && <p className="small dim">Tudo tranquilo por enquanto. Avance o mês para ver o que se move.</p>}
        {feed.map((f) => {
          const st = TIPO_STYLE[f.tipo] || TIPO_STYLE['notícia'];
          const clickable = !!f.aba;
          return (
            <button
              key={f.id}
              className={`feed-card ${f.urgente ? 'urgente' : ''} ${clickable ? 'clk' : ''}`}
              onClick={() => clickable && irPara(f.aba)}
              disabled={!clickable}
            >
              <span className="feed-ico">{f.ico}</span>
              <span className="feed-body">
                <span className="feed-meta"><span className={`pill ${st.pill}`}>{st.lbl}</span></span>
                <span className="feed-title">{f.titulo}</span>
                {f.texto && <span className="feed-text">{f.texto}</span>}
              </span>
              {clickable && <span className="feed-arrow">›</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
