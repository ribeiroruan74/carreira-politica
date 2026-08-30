import { useState } from 'react';
import { useGame } from '../../state/store';
import { Card, Stat, Meter, Pill, PageHead } from '../components/primitives';
import { protocolarProjeto, negociarVotosProjeto, declararPosicaoJogador, acaoComissao, COMISSOES, MANDATO_MESES } from '../../engine/mandate';
import lawsDef from '../../content/laws.json';
import { bairrosDaCidade } from '../../engine/offices';

const POS_LABEL = { BASE: 'Base do governo', OPOSICAO: 'Oposição', INDEPENDENTE: 'Independente', INDEFINIDO: 'Não declarada' };

const STATUS_TONE = { TRAMITANDO: 'amber', APROVADO: 'accent', REJEITADO: 'red', ARQUIVADO: undefined };

export default function Mandato() {
  const s = useGame((g) => g.estado);
  const aplicar = useGame((g) => g.aplicar);
  const m = s.mandato;
  const bairros = bairrosDaCidade(s.personagem.cidade);
  const [form, setForm] = useState({ tema: lawsDef.temas[0].id, tipo: lawsDef.tipos[0].id, bairroId: bairros[0].id });
  const [erro, setErro] = useState(null);

  if (!m) return <div className="stack"><PageHead eyebrow="Mandato" title="Você não está no exercício de um mandato" /></div>;

  const mesAtual = s.tempo.mes - m.mesInicio + 1;
  const ind = m.indicadores;
  const tramitando = m.projetos.filter((p) => p.status === 'TRAMITANDO');
  const encerrados = m.projetos.filter((p) => p.status !== 'TRAMITANDO');

  function agir(fn) {
    try { aplicar(fn); setErro(null); } catch (e) { setErro(e.message); }
  }

  return (
    <div className="stack">
      <PageHead eyebrow={`${m.cargoNome || 'Vereador(a)'} · mês ${Math.max(1, mesAtual)} de ${MANDATO_MESES}`} title="Mandato">
        {m.encerrando && 'Mandato encerrado — vá à Agenda para disputar a próxima eleição.'}
      </PageHead>

      <div className="grid cols-3">
        <Card><Stat k="Aprovação" v={`${Math.round(s.reputacao.aprovacao)}%`} sub={`Rejeição ${Math.round(s.reputacao.rejeicao)}%`} /></Card>
        <Card><Stat k="Projetos aprovados" v={ind.projetosAprovados} sub={`${ind.projetosRejeitados} rejeitados`} /></Card>
        <Card><Stat k="Fiscalizações" v={ind.fiscalizacoes} sub={`relação com a prefeitura ${m.relacaoPrefeitura > 10 ? 'boa' : m.relacaoPrefeitura < -10 ? 'tensa' : 'neutra'}`} /></Card>
      </div>

      {erro && <Card><p className="small" style={{ color: 'var(--red)', margin: 0 }}>{erro}</p></Card>}

      {m.executivo && (
        <Card title={`Você é ${m.cargoNome}`}>
          <p className="small dim">
            Você comanda o Executivo. A relação com o Legislativo, o orçamento e as
            entregas de governo passam a ser sua responsabilidade direta — e a cobrança
            também. Use as ferramentas abaixo para tocar a gestão.
          </p>
        </Card>
      )}

      {!m.executivo && (
      <Card title="Posição em relação à prefeitura" aside={<Pill tone={m.posicao === 'BASE' ? 'accent' : m.posicao === 'OPOSICAO' ? 'red' : undefined}>{POS_LABEL[m.posicao]}</Pill>}>
        <p className="small dim">
          <strong>Base:</strong> acesso a emendas e obras, projetos andam — mas sua imagem passa a andar junto com a do prefeito.{' '}
          <strong>Oposição:</strong> liberdade para criticar, fiscalização rende mais holofote — mas seus projetos de lei penam.
        </p>
        <div className="chips" style={{ marginTop: 10 }}>
          {['BASE', 'OPOSICAO', 'INDEPENDENTE'].map((p) => (
            <button key={p} className={`btn sm ${m.posicao === p ? '' : 'ghost'}`}
              onClick={() => agir((st) => declararPosicaoJogador(st, p))}>
              {POS_LABEL[p]}
            </button>
          ))}
        </div>
      </Card>
      )}

      {!m.executivo && (
      <Card title="Comissões da Câmara" aside={`${m.comissoes.participando.length}/3`}>
        {m.comissoes.participando.length === 0 && <p className="small dim">Você não integra nenhuma comissão. Participar de uma dá relatoria nos projetos do tema dela.</p>}
        {COMISSOES.map((c) => {
          const dentro = m.comissoes.participando.includes(c.id);
          const preside = m.comissoes.presidindo === c.id;
          return (
            <div key={c.id} className="row">
              <span className="grow">
                <span className="name">{c.nome}</span>{' '}
                {preside && <Pill tone="accent">você preside</Pill>}
                {dentro && !preside && <Pill tone="blue">membro</Pill>}
                <div className="small faint">{c.temas.join(' · ')}{c.gatekeeper ? ' · barra projetos' : ''}</div>
              </span>
              {!dentro && (
                <button className="btn sm ghost" disabled={m.comissoes.participando.length >= 3 || s.tempo.pontosRestantes < 2}
                  onClick={() => agir((st) => acaoComissao(st, c.id, 'vaga'))}>Pedir vaga</button>
              )}
              {dentro && !preside && (
                <button className="btn sm ghost" disabled={s.tempo.pontosRestantes < 2}
                  onClick={() => agir((st) => acaoComissao(st, c.id, 'presidencia'))}>Disputar presidência</button>
              )}
            </div>
          );
        })}
      </Card>
      )}

      <Card title="Protocolar novo projeto" aside="custa 3 tempo · 12 energia">
        <div className="field-row two">
          <div>
            <label>Tema</label>
            <select value={form.tema} onChange={(e) => setForm({ ...form, tema: e.target.value })}>
              {lawsDef.temas.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </select>
          </div>
          <div>
            <label>Tipo</label>
            <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
              {lawsDef.tipos.map((t) => <option key={t.id} value={t.id}>{t.nome}{t.precisaMaioria ? ' (precisa maioria)' : ''}</option>)}
            </select>
          </div>
        </div>
        <label>Bairro-foco</label>
        <select value={form.bairroId} onChange={(e) => setForm({ ...form, bairroId: e.target.value })}>
          {bairros.map((b) => <option key={b.id} value={b.id}>{b.nome} · {b.regiao}</option>)}
        </select>
        <button className="btn" style={{ marginTop: 12 }} disabled={m.encerrando || s.tempo.pontosRestantes < 3}
          onClick={() => agir((st) => protocolarProjeto(st, form))}>
          Protocolar
        </button>
      </Card>

      <Card title={`Em tramitação (${tramitando.length})`}>
        {tramitando.length === 0 && <p className="small dim">Nenhum projeto seu tramitando. Protocole um acima.</p>}
        {tramitando.map((pj) => (
          <div key={pj.id} style={{ padding: '12px 0', borderBottom: '1px solid var(--line)' }}>
            <div className="card-head" style={{ marginBottom: 6 }}>
              <strong>{pj.titulo}</strong>
              <Pill tone="amber">{lawsDef.tipos.find((t) => t.id === pj.tipo)?.nome}</Pill>
            </div>
            <Meter label="Apoio parlamentar estimado" value={pj.apoio} tone={pj.apoio >= 55 ? 'ok' : pj.apoio >= 40 ? 'warn' : 'bad'} suffix="%" />
            <div className="small faint mono" style={{ margin: '6px 0' }}>
              impacto {pj.impacto} · prazo mês {pj.prazo - m.mesInicio + 1}
              {pj.precisaMaioria ? ' · precisa de 20 votos' : ' · não precisa de maioria'}
            </div>
            <button className="btn sm ghost" disabled={s.tempo.pontosRestantes < 2}
              onClick={() => agir((st) => negociarVotosProjeto(st, pj.id))}>
              Negociar votos (2 tempo)
            </button>
          </div>
        ))}
      </Card>

      {encerrados.length > 0 && (
        <Card title="Histórico de proposições">
          {encerrados.map((pj) => (
            <div key={pj.id} className="row">
              <span className="grow name">{pj.titulo}</span>
              {pj.votos && pj.votos.sim > 0 && <span className="faint small mono">{pj.votos.sim}×{pj.votos.nao}</span>}
              <Pill tone={STATUS_TONE[pj.status]}>{pj.status.toLowerCase()}</Pill>
            </div>
          ))}
        </Card>
      )}

      {m.promessas.length > 0 && (
        <Card title="Promessas" aside={`${m.promessas.filter((p) => p.cumprida).length}/${m.promessas.length} cumpridas`}>
          {m.promessas.map((pr) => (
            <div key={pr.id} className="row">
              <span className="grow">{lawsDef.temas.find((t) => t.id === pr.tema)?.nome || pr.tema} — {bairros.find((b) => b.id === pr.bairroId)?.nome}</span>
              <Pill tone={pr.cumprida ? 'accent' : s.tempo.mes > pr.prazo ? 'red' : 'amber'}>
                {pr.cumprida ? 'cumprida' : s.tempo.mes > pr.prazo ? 'vencida' : `prazo mês ${pr.prazo - m.mesInicio + 1}`}
              </Pill>
            </div>
          ))}
        </Card>
      )}

      {m.sessoes.length > 0 && (
        <Card title="Últimas sessões">
          {m.sessoes.slice(0, 5).map((se, i) => (
            <div key={i} style={{ padding: '8px 0', borderBottom: '1px dashed var(--line)' }}>
              <div className="small faint mono">mês {se.mes - m.mesInicio + 1}</div>
              {se.itens.map((it, j) => (
                <div key={j} className="small">{it.titulo} — <strong>{it.resultado}</strong>{it.placar ? ` (${it.placar})` : ''}</div>
              ))}
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
