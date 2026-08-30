import { useGame } from '../../state/store';
import { formatBRL, nomeMes } from '../../engine/tick';
import { Card, Stat, Meter, Pill, PageHead } from '../components/primitives';
import { janelaCandidatura } from '../../engine/calendar';
import { cascatasAtivas } from '../../engine/cascade';
import { riscosAbertos } from '../../engine/worldMemory';
import { eventoNacionalAtual, rotuloClima, climaNacional } from '../../engine/national';
import { bairrosDaCidade } from '../../engine/offices';

function proximoPasso(s) {
  const f = s.personagem.fase;
  if (f === 'VIDA') return 'Construa vida pública: ativismo e liderança comunitária abrem caminho para um partido.';
  if (f === 'VIDA_PUBLICA') return 'Filie-se a um partido para poder disputar uma eleição.';
  if (f === 'CANDIDATO') return `Campanha em andamento — eleição em ${nomeMes(s.eleicao?.mesPleito ?? 0)}/${s.eleicao?.anoPleito ?? ''}. Cada mês conta.`;
  if (f === 'PARTIDO' || f === 'MANDATO') {
    const j = janelaCandidatura(s);
    if (j.aberta) return `A janela de candidatura para a eleição de ${j.ano} está ABERTA — decida na Agenda.`;
    return `Próxima eleição municipal: ${nomeMes(j.mes)}/${j.ano}. A janela de candidatura abre em ${j.mesesAteAbrir} mês(es).`;
  }
  return '';
}

export default function Dashboard({ irPara }) {
  const s = useGame((g) => g.estado);
  const avancarMes = useGame((g) => g.avancarMes);
  const { personagem: p, tempo, financas, reputacao, redes, relacionamentos, territorio, log } = s;

  const pessoas = Object.values(relacionamentos.pessoas);
  const aliados = pessoas.filter((x) => x.nivel === 'ALIADO' || x.nivel === 'PARCEIRO').length;
  const bairrosComPresenca = Object.entries(territorio.porBairro)
    .filter(([, v]) => v.presenca > 0)
    .sort((a, b) => b[1].presenca - a[1].presenca);
  const topBairro = bairrosComPresenca[0];
  const topBairroNome = topBairro
    ? bairrosDaCidade(p.cidade).find((b) => b.id === topBairro[0])?.nome
    : null;
  const ano = tempo.anoInicial + Math.floor(tempo.mes / 12);

  return (
    <div className="stack">
      <PageHead eyebrow={`${nomeMes(tempo.mes)} de ${ano} · ${p.idade} anos`} title={`Situação de ${p.nome}`} />

      <div className="grid cols-3">
        <Card><Stat k="Aprovação" v={`${Math.round(reputacao.aprovacao)}%`} sub={`Confiança ${Math.round(reputacao.confianca)}%`} /></Card>
        <Card><Stat k="Rejeição" v={`${Math.round(reputacao.rejeicao)}%`} sub={`Notoriedade ${Math.round(reputacao.notoriedade)}`} /></Card>
        <Card><Stat k="Seguidores" v={redes.seguidores.toLocaleString('pt-BR')} delta={redes.crescimentoMensal} sub={`Alcance médio ${redes.alcanceMedio.toLocaleString('pt-BR')}`} /></Card>
        <Card><Stat k="Caixa pessoal" v={formatBRL(financas.pessoal)} sub={`Renda ${formatBRL(financas.rendaMensal)}/mês`} /></Card>
        <Card><Stat k="Rede política" v={`${pessoas.length} contatos`} sub={`${aliados} aliado(s)`} /></Card>
        <Card><Stat k="Território" v={topBairroNome || '—'} sub={topBairro ? `presença ${Math.round(topBairro[1].presenca)}` : 'Sem base territorial'} /></Card>
      </div>

      {(cascatasAtivas(s).length > 0 || riscosAbertos(s).length > 0) && (
        <Card title="Repercussão e riscos" className="">
          {cascatasAtivas(s).map((c) => (
            <div key={c.id} className="row">
              <span className="grow"><Pill tone="amber">em curso</Pill> {c.rótulo}</span>
              <span className="faint small">estágio {c.estagio + 1}/{c.total}</span>
            </div>
          ))}
          {riscosAbertos(s).map((f) => (
            <div key={f.id} className="row">
              <span className="grow"><Pill tone="red">risco aberto</Pill> {f.texto}</span>
            </div>
          ))}
          <p className="small faint" style={{ marginTop: 8 }}>
            Cascatas avançam sozinhas todo mês. Riscos abertos podem voltar a te cobrar mais adiante.
          </p>
        </Card>
      )}

      {(() => {
        const ev = eventoNacionalAtual(s);
        const c = climaNacional(s);
        if (!ev && Math.abs(c) < 8) return null;
        return (
          <Card title="Cenário nacional">
            <div className="row"><span className="grow"><strong>{rotuloClima(s)}</strong></span><span className="faint small">clima {c > 0 ? '+' : ''}{c}</span></div>
            {ev && <p className="small dim" style={{ marginTop: 6 }}>{ev.texto}</p>}
          </Card>
        );
      })()}

      <Card title="Próximo passo">
        <p className="dim small">{proximoPasso(s)}</p>
        <div className="chips" style={{ marginTop: 10 }}>
          <Pill tone="accent">{tempo.pontosRestantes}/{tempo.pontosPorMes} pontos de tempo</Pill>
          <Pill tone={tempo.energia < 30 ? 'red' : 'accent'}>energia {Math.round(tempo.energia)}</Pill>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
          <button className="btn" onClick={() => irPara('agenda')}>Ir para a Agenda</button>
          <button className="btn ghost" disabled={!!s.eventoPendente} onClick={avancarMes}>Avançar o mês →</button>
        </div>
      </Card>

      <div className="grid cols-2">
        <Card title="Reputação">
          <div className="stack" style={{ gap: 10 }}>
            <Meter label="Aprovação" value={reputacao.aprovacao} />
            <Meter label="Confiança" value={reputacao.confianca} tone="info" />
            <Meter label="Rejeição" value={reputacao.rejeicao} tone={reputacao.rejeicao > 35 ? 'bad' : 'warn'} />
            <Meter label="Notoriedade" value={reputacao.notoriedade} tone="info" />
          </div>
        </Card>
        <Card title="Notícias do Recife" aside={`${(s.mundo.noticias || []).length}`}>
          <div>
            {(s.mundo.noticias || []).slice(0, 7).map((n) => (
              <div key={n.id} className={`log-item ${n.tipo === 'ATAQUE' ? 'ALERTA' : n.tipo === 'ALIANCA' ? 'RELACIONAMENTO' : ''}`}>
                <span className="when">{nomeMes(n.mes)}/{tempo.anoInicial + Math.floor(n.mes / 12)}</span>
                <span className="txt">{n.texto}</span>
              </div>
            ))}
            {(s.mundo.noticias || []).length === 0 && (
              log.slice(0, 6).map((l, i) => (
                <div key={i} className={`log-item ${l.tipo}`}>
                  <span className="when">{nomeMes(l.mes)}/{tempo.anoInicial + Math.floor(l.mes / 12)}</span>
                  <span className="txt">{l.texto}</span>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
