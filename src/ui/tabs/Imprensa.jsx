import { useState } from 'react';
import { useGame } from '../../state/store';
import { Card, Pill, PageHead, Meter } from '../components/primitives';
import { nomeMes } from '../../engine/tick';
import { tomCobertura, JORNALISTAS, veiculo, convitesMidiaAtivos } from '../../engine/press';
import { relevanciaMidiatica } from '../../engine/social';
import { montarEdicao } from '../../engine/newspaper';

const TIPO_LABEL = { jornal: 'Jornal', portal: 'Portal', tv: 'TV', radio: 'Rádio', blog: 'Blog', revista: 'Revista' };
function tomLabel(t) {
  if (t >= 35) return { txt: 'favorável', tone: 'accent' };
  if (t >= 5) return { txt: 'neutra-positiva', tone: 'blue' };
  if (t > -25) return { txt: 'crítica', tone: 'amber' };
  return { txt: 'hostil', tone: 'red' };
}

export default function Imprensa() {
  const s = useGame((g) => g.estado);
  const iniciarEntrevista = useGame((g) => g.iniciarEntrevista);
  const [jornalista, setJornalista] = useState(JORNALISTAS[0].id);

  const veiculos = tomCobertura(s);
  const edicao = montarEdicao(s);
  const noticiasMidia = (s.mundo.noticias || []).filter((n) => n.tipo === 'MIDIA' || (n.destaque && n.tipo === 'CIDADE')).slice(0, 12);
  const bloq = !!s.eventoPendente || s.tempo.pontosRestantes < 2;
  const convites = convitesMidiaAtivos(s);

  function entrevistar() {
    iniciarEntrevista(jornalista);
  }
  function aceitar(c) {
    if (c.tipo === 'entrevista') iniciarEntrevista(c.refId, c.id);
  }

  return (
    <div className="stack">
      <PageHead eyebrow="Imprensa" title="Como a mídia cobre você">
        A cobertura muda com sua aprovação, sua rejeição e a linha de cada veículo. Entrevista bem dada rende — mal dada vira corte ruim.
      </PageHead>

      <Card title="Convites da mídia" aside={`relevância ${relevanciaMidiatica(s)}`}>
        {convites.length === 0 && (
          <p className="small dim">
            Nenhum convite agora. Quanto maior sua relevância midiática (notoriedade, audiência, repercussão, cargo)
            e melhor sua assessoria de comunicação, mais programas vêm te procurar.
          </p>
        )}
        {convites.map((c) => (
          <div key={c.id} className="row" style={{ padding: '6px 0' }}>
            <span className="grow">
              <strong>{c.veiculoNome}</strong>{' '}
              <span className="small dim">
                {c.tipo === 'entrevista' ? `· entrevista com ${c.jornalista}` : `· podcast (${c.nicho})`}
                {' '}· expira em {c.expiraMes - s.tempo.mes} mês(es)
              </span>
            </span>
            {c.tipo === 'entrevista' ? (
              <button className="btn sm" disabled={bloq} onClick={() => aceitar(c)}>Aceitar (2t)</button>
            ) : (
              <Pill tone="accent">disponível na Agenda</Pill>
            )}
          </div>
        ))}
      </Card>

      {edicao && (
        <Card>
          <div style={{ borderBottom: '2px solid var(--ink)', paddingBottom: 6, marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontFamily: 'var(--f-display)', fontWeight: 900, fontSize: '1.4rem', letterSpacing: '0.02em' }}>{edicao.nome}</span>
              <span className="small faint mono">Nº {edicao.edicaoNum} · {edicao.data}</span>
            </div>
          </div>
          <p style={{ fontFamily: 'var(--f-display)', fontWeight: 600, fontSize: '1.15rem', lineHeight: 1.25, margin: '0 0 14px' }}>
            {edicao.capa}
          </p>
          <div className="grid cols-2" style={{ gap: 12 }}>
            {edicao.secoes.map((sec) => (
              <div key={sec.nome}>
                <div className="small faint mono" style={{ borderBottom: '1px solid var(--line)', paddingBottom: 3, marginBottom: 5 }}>{sec.nome.toUpperCase()}</div>
                {sec.itens.map((it, i) => <p key={i} className="small" style={{ margin: '0 0 4px' }}>› {it}</p>)}
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card title="Repercussão atual">
        <Meter label="Eco midiático" value={Math.max(0, s.reputacao.ecoMidiatico)} tone={s.reputacao.ecoMidiatico >= 0 ? 'info' : 'bad'} suffix="" />
        <p className="small faint" style={{ marginTop: 6 }}>
          {s.reputacao.ecoMidiatico > 15 ? 'Você está em alta na imprensa.'
            : s.reputacao.ecoMidiatico < -5 ? 'Cobertura negativa pesando contra você.'
              : 'Sem grande destaque na mídia no momento.'}
        </p>
      </Card>

      <Card title="Veículos">
        {veiculos.map((v) => {
          const l = tomLabel(v.tom);
          return (
            <div key={v.id} className="row">
              <span className="grow">
                <span className="name">{v.nome}</span> <span className="small faint">{TIPO_LABEL[v.tipo]}</span>
              </span>
              <span className="faint small" style={{ width: 70, textAlign: 'right' }}>alcance {v.alcance}</span>
              <Pill tone={l.tone}>{l.txt}</Pill>
            </div>
          );
        })}
      </Card>

      <Card title="Conceder entrevista" aside="custa 2 tempo · 10 energia">
        <label>Jornalista</label>
        <select value={jornalista} onChange={(e) => setJornalista(e.target.value)}>
          {JORNALISTAS.map((j) => (
            <option key={j.id} value={j.id}>{j.nome} — {j.cargo}, {veiculo(j.veiculo)?.nome} (rigor {j.rigor})</option>
          ))}
        </select>
        <p className="small faint" style={{ marginTop: 6 }}>
          São 4–6 perguntas, contextualizadas pelo seu histórico (promessas, crises, ataques). Jornalista rigoroso amplifica respostas ruins; preparo (comunicação, oratória, inteligência) suaviza.
        </p>
        <button className="btn" style={{ marginTop: 10 }} disabled={bloq} onClick={entrevistar}>Dar a entrevista</button>
      </Card>

      <Card title="O que saiu sobre você" aside={`${noticiasMidia.length}`}>
        {noticiasMidia.map((n) => (
          <div key={n.id} className="log-item">
            <span className="when">{nomeMes(n.mes)}/{s.tempo.anoInicial + Math.floor(n.mes / 12)}</span>
            <span className="txt">{n.texto}</span>
          </div>
        ))}
        {noticiasMidia.length === 0 && <p className="small dim">Nada de relevante na imprensa por enquanto.</p>}
      </Card>
    </div>
  );
}
