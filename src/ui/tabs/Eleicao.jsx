import { useState } from 'react';
import { useGame } from '../../state/store';
import { Card, PageHead, Sparkline, Stat } from '../components/primitives';
import { formatBRL } from '../../engine/tick';
import { corPartido } from '../../engine/voteModel';

export default function Eleicao({ irPara }) {
  const s = useGame((g) => g.estado);
  const avancarMes = useGame((g) => g.avancarMes);
  const el = s.eleicao;
  const [busca, setBusca] = useState('');
  const [verTodos, setVerTodos] = useState(false);

  if (!el) return null;

  const ultima = el.pesquisas[el.pesquisas.length - 1];
  const hist = el.jogadorVotosHist || [];
  const campo = [
    ...el.candidatos.map((c) => ({
      id: c.id, nome: c.nome, partidoId: c.partidoId, real: c.real,
      votos: c.votosEstimados || 0, arq: c.arquétipoNome,
    })),
    { id: 'JOGADOR', nome: `${s.personagem.nome} (você)`, partidoId: s.personagem.partidoId, votos: hist[hist.length - 1] || 0, jogador: true },
  ].sort((a, b) => b.votos - a.votos);

  const minhaPos = campo.findIndex((c) => c.jogador) + 1;
  const filtrados = campo.filter((c) => c.nome.toLowerCase().includes(busca.toLowerCase()));
  const mostra = verTodos ? filtrados : filtrados.slice(0, 15);

  if (el.status === 'APURADO') {
    return (
      <div className="stack">
        <PageHead eyebrow="Eleição" title="Apuração encerrada" />
        <Card>
          <p className="small dim">O resultado está na tela de apuração.</p>
          <button className="btn" onClick={() => irPara('dashboard')}>Voltar ao Dashboard</button>
        </Card>
      </div>
    );
  }

  const majoritario = el.sistema === 'MAJORITARIO';
  const segundoTurno = el.turno > 1;

  return (
    <div className="stack">
      <PageHead
        eyebrow={`${el.circunscricaoNome || el.cidade} · ${el.cargoNome || 'Vereador(a)'} · ${el.candidatos.length} candidatos`}
        title={`${segundoTurno ? '2º turno' : 'Campanha'} — ${el.mesAtual} de ${el.totalMeses} ${el.totalMeses === 1 ? 'mês' : 'meses'}`}
      >
        {majoritario
          ? 'Quem tiver mais votos leva. ' + (el.doisTurnos ? 'Se ninguém passar de 50%, os dois primeiros vão ao 2º turno.' : 'Turno único.')
          : 'Sistema proporcional: os votos da sua coligação contam juntos para o quociente. A cada mês avançado os adversários agem e sai uma nova pesquisa.'}
      </PageHead>

      {segundoTurno && el.primeiroTurno && (
        <Card title="Resultado do 1º turno">
          {el.primeiroTurno.ranking.slice(0, 6).map((c, i) => (
            <div key={c.id} className="row" style={c.jogador ? { background: 'var(--accent-soft)', borderRadius: 6 } : undefined}>
              <span className="faint mono" style={{ width: 22 }}>{i + 1}</span>
              <span className="grow name">{c.nome} <span className="pill">{c.partidoId}</span></span>
              <span className="num">{c.pct}%</span>
            </div>
          ))}
        </Card>
      )}

      <div className="grid cols-3">
        <Card><Stat k="Sua colocação (estimada)" v={`${minhaPos}º`} sub={`de ${campo.length}`} /></Card>
        <Card><Stat k="Seus votos estimados" v={(hist[hist.length - 1] || 0).toLocaleString('pt-BR')} delta={hist.length > 1 ? (hist[hist.length - 1] - hist[hist.length - 2]) : 0} /></Card>
        <Card><Stat k="Caixa de campanha" v={formatBRL(s.financas.campanha)} sub={`aporte inicial ${formatBRL(el.aporteInicial)}`} /></Card>
      </div>

      {hist.length > 1 && (
        <Card title="Sua trajetória de votos">
          <Sparkline data={hist} width={280} height={48} />
          <p className="small faint mono">{hist.map((v) => v.toLocaleString('pt-BR')).join('  ·  ')}</p>
        </Card>
      )}

      {ultima && (
        <Card title={`Pesquisa — ${ultima.mes}º mês`} aside={`margem ±${ultima.margemErro}pp`}>
          {ultima.linhas.map((l, i) => (
            <div key={l.id} className={`row ${l.jogador ? '' : ''}`} style={l.jogador ? { background: 'var(--accent-soft)', borderRadius: 6, padding: '8px 8px' } : undefined}>
              <span className="faint mono" style={{ width: 24 }}>{i + 1}</span>
              <span className="grow name">
                {l.nome} <span className="pill" style={{ borderColor: corPartido(l.partidoId), color: corPartido(l.partidoId) }}>{l.partidoId}</span>
              </span>
              <span className="num"><strong>{l.pct}%</strong></span>
            </div>
          ))}
        </Card>
      )}

      <Card title="Todos os candidatos" aside={`você em ${minhaPos}º`}>
        <input placeholder="buscar candidato…" value={busca} onChange={(e) => setBusca(e.target.value)} style={{ marginBottom: 10 }} />
        {mostra.map((c) => (
          <div key={c.id} className="row" style={c.jogador ? { background: 'var(--accent-soft)', borderRadius: 6 } : undefined}>
            <span className="faint mono" style={{ width: 24 }}>{campo.indexOf(c) + 1}</span>
            <span className="grow name">
              {c.nome} <span className="pill">{c.partidoId}</span>
              {c.real && <span className="pill">real 2024</span>}
              {c.arq && <span className="small faint"> · {c.arq}</span>}
            </span>
            <span className="num">{c.votos.toLocaleString('pt-BR')}</span>
          </div>
        ))}
        {!verTodos && filtrados.length > 15 && (
          <button className="btn ghost sm" style={{ marginTop: 10 }} onClick={() => setVerTodos(true)}>ver todos ({filtrados.length})</button>
        )}
      </Card>

      <Card title="Encerrar o mês de campanha">
        <button className="btn" disabled={!!s.eventoPendente} onClick={avancarMes}>Avançar o mês →</button>
      </Card>
    </div>
  );
}
