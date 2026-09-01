import { useState, useMemo } from 'react';
import { useGame } from '../../state/store';
import { Card, Stat, Meter, Pill, PageHead } from '../components/primitives';
import { formatBRL } from '../../engine/tick';
import { streamRng } from '../../engine/rng';
import {
  candidatosAssessor, contratarAssessor, demitirAssessor,
  reuniaoGabinete, definirPrioridade, delegar, promoverAssessor,
  treinarAssessor, custoTreino, conversarAssessor,
  AREAS_GABINETE, DELEGACOES, capacidadeDelegacao, multGabinete, chefeGabinete,
} from '../../engine/mandate';
import staffDef from '../../content/staff.json';

export default function Gabinete() {
  const s = useGame((g) => g.estado);
  const aplicar = useGame((g) => g.aplicar);
  const m = s.mandato;
  const [aba, setAba] = useState(null); // cargoChave sendo contratado
  const [erro, setErro] = useState(null);
  const [briefing, setBriefing] = useState(null);

  // candidatos determinísticos por cargo+mês
  const candidatos = useMemo(() => {
    if (!aba) return [];
    const rng = streamRng(s.meta.seed, 'hire', aba, s.tempo.mes);
    return candidatosAssessor(s, aba, rng);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aba, s.tempo.mes, s.meta.seed]);

  if (!m) return <div className="stack"><PageHead eyebrow="Gabinete" title="Disponível ao assumir um mandato" /></div>;

  const contratados = m.gabinete.contratados;
  const folha = Object.values(contratados).reduce((sum, a) => sum + a.salario, 0);

  function agir(fn) {
    try { aplicar(fn); setErro(null); setAba(null); } catch (e) { setErro(e.message); }
  }
  function reunir() {
    try { let r; aplicar((st) => { r = reuniaoGabinete(st); }); setBriefing(r?.briefing || null); setErro(null); }
    catch (e) { setErro(e.message); }
  }
  function conversar(chave) {
    try { let r; aplicar((st) => { r = conversarAssessor(st, chave); }); setBriefing(r?.msg ? [r.msg] : null); setErro(null); }
    catch (e) { setErro(e.message); }
  }

  const chefe = chefeGabinete(s);
  const cap = capacidadeDelegacao(s);
  const del = m.gabinete.delegacoes || {};
  const nDel = Object.values(del).filter(Boolean).length;

  return (
    <div className="stack">
      <PageHead eyebrow="Gabinete" title="Sua equipe">
        Funcionários bons custam mais e entregam mais. Baixa lealdade é risco de crise ou de perder gente para um rival.
      </PageHead>

      <Card title="🧑‍💼 Chefe de gabinete" aside={chefe ? <Pill tone={chefe.lealdade >= 60 ? 'accent' : 'amber'}>{chefe.traçoNome}</Pill> : <Pill tone="red">vaga aberta</Pill>}>
        {chefe ? (
          <>
            <div className="row"><span className="grow name">{chefe.nome}</span><span className="num small">{formatBRL(chefe.salario)}/mês</span></div>
            <div className="grid cols-2" style={{ gap: 10, marginTop: 8 }}>
              <Meter label={`Competência ${chefe.experiencia ? `(+${Math.round(chefe.experiencia * 6)} exp.)` : ''}`} value={Math.min(100, chefe.competencia + (chefe.experiencia || 0) * 6)} tone="ok" />
              <Meter label="Lealdade" value={chefe.lealdade} tone={chefe.lealdade >= 55 ? 'ok' : 'warn'} />
            </div>
            <p className="small dim" style={{ marginTop: 8 }}>
              Um bom chefe multiplica toda a equipe e destrava até {cap} tarefa(s) delegada(s). {chefe.lealdade >= 60 ? 'Leal — segura a lealdade dos outros.' : chefe.risco === 'vira rival' ? 'Ambicioso — corrói a lealdade da equipe e pode romper com você.' : ''}
            </p>
            <div className="chips" style={{ marginTop: 8 }}>
              <button className="btn sm ghost" onClick={() => conversar('chefe_gabinete')}>Conversar · 1⚡</button>
              <button className="btn sm ghost" onClick={() => agir((st) => promoverAssessor(st, 'chefe_gabinete'))}>Promover</button>
              <button className="btn sm ghost" disabled={(s.financas.pessoal || 0) < custoTreino(chefe)}
                title={`Capacitação paga do seu bolso — sobe a experiência. Custa ${formatBRL(custoTreino(chefe))}`}
                onClick={() => agir((st) => treinarAssessor(st, 'chefe_gabinete'))}>
                Capacitar · {formatBRL(custoTreino(chefe))}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="small dim">Sem chefe de gabinete a casa toda rende menos e você não pode delegar rotinas.</p>
            {aba === 'chefe_gabinete' ? (
              <div className="stack" style={{ gap: 8, marginTop: 8 }}>
                {candidatos.map((c) => (
                  <div key={c.id} className="row">
                    <span className="grow"><span className="name">{c.nome}</span> <Pill>{c.traçoNome}</Pill>{' '}
                      <span className="small faint">comp. {c.competencia} · leald. {c.lealdade}</span></span>
                    <span className="num small">{formatBRL(c.salario)}</span>
                    <button className="btn sm" onClick={() => agir((st) => contratarAssessor(st, c))}>Contratar</button>
                  </div>
                ))}
                <button className="btn sm ghost" onClick={() => setAba(null)}>Cancelar</button>
              </div>
            ) : (
              <button className="btn sm" style={{ marginTop: 8 }} onClick={() => setAba('chefe_gabinete')}>Ver candidatos a chefe</button>
            )}
          </>
        )}
      </Card>

      <Card title="Gestão do gabinete">
        <div className="chips" style={{ marginBottom: 10 }}>
          <button className="btn sm" disabled={m.gabinete.ultimaReuniao === s.tempo.mes || s.tempo.energia < 1} onClick={reunir}>
            Reunião de alinhamento · 1t
          </button>
        </div>
        {briefing && (
          <div className="card" style={{ background: 'var(--surface-2)', padding: 10, marginBottom: 10 }}>
            {briefing.map((b, i) => <p key={i} className="small" style={{ margin: 0 }}>▸ {b}</p>)}
          </div>
        )}

        <div className="small faint mono" style={{ marginBottom: 4 }}>PRIORIDADE DA EQUIPE</div>
        <div className="chips" style={{ marginBottom: 4 }}>
          {AREAS_GABINETE.map((ar) => (
            <button key={ar.id} className={`btn sm ${m.gabinete.prioridade === ar.id ? '' : 'ghost'}`}
              onClick={() => agir((st) => definirPrioridade(st, ar.id))}>
              {ar.nome} <span className="faint">{Math.round(multGabinete(s, ar.id) * 100)}%</span>
            </button>
          ))}
        </div>
        <p className="small faint" style={{ margin: '0 0 12px' }}>A área priorizada rende mais; as demais, um pouco menos.</p>

        <div className="small faint mono" style={{ marginBottom: 4 }}>DELEGAR ROTINAS ({nDel}/{cap})</div>
        <div className="stack" style={{ gap: 6 }}>
          {DELEGACOES.map((d) => (
            <div key={d.id} className="row" style={{ alignItems: 'baseline' }}>
              <span className="grow small">{d.nome} <span className="dim">— {d.desc}</span></span>
              <button className={`btn sm ${del[d.id] ? '' : 'ghost'}`}
                disabled={!del[d.id] && (nDel >= cap || !chefe)}
                onClick={() => agir((st) => delegar(st, d.id, !del[d.id]))}>
                {del[d.id] ? 'Delegado' : 'Delegar'}
              </button>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid cols-3">
        <Card><Stat k="Verba mensal" v={formatBRL(m.gabinete.verbaMensal)} /></Card>
        <Card><Stat k="Folha atual" v={formatBRL(folha)} sub={folha > m.gabinete.verbaMensal ? 'acima da verba!' : `${Math.round((folha / m.gabinete.verbaMensal) * 100)}% da verba`} /></Card>
        <Card><Stat k="Saldo de gabinete" v={formatBRL(s.financas.gabinete)} /></Card>
      </div>

      {erro && <Card><p className="small" style={{ color: 'var(--red)', margin: 0 }}>{erro}</p></Card>}

      {staffDef.cargos.filter((c) => c.chave !== 'chefe_gabinete').map((cargo) => {
        const a = contratados[cargo.chave];
        return (
          <Card key={cargo.chave}>
            <div className="card-head">
              <h3>{cargo.nome}</h3>
              {cargo.essencial && <Pill tone="amber">essencial</Pill>}
            </div>
            {a ? (
              <>
                <div className="row">
                  <span className="grow name">{a.nome} <Pill>{a.traçoNome}</Pill></span>
                  <span className="num">{formatBRL(a.salario)}/mês</span>
                </div>
                <div className="grid cols-2" style={{ gap: 10, marginTop: 8 }}>
                  <Meter label={`Competência ${a.experiencia ? `(+${Math.round(a.experiencia * 6)} exp.)` : ''}`} value={Math.min(100, a.competencia + (a.experiencia || 0) * 6)} tone={a.competencia >= 60 ? 'ok' : 'warn'} />
                  <Meter label="Lealdade" value={a.lealdade} tone={a.lealdade >= 55 ? 'ok' : a.lealdade >= 40 ? 'warn' : 'bad'} />
                </div>
                {a.risco && <p className="small" style={{ color: 'var(--amber)', marginTop: 6 }}>Risco: {a.risco}</p>}
                <div className="chips" style={{ marginTop: 10 }}>
                  <button className="btn sm ghost" onClick={() => conversar(cargo.chave)}>Conversar · 1⚡</button>
                  <button className="btn sm ghost" disabled={(s.financas.pessoal || 0) < custoTreino(a)}
                    title={`Capacitação paga do seu bolso. Custa ${formatBRL(custoTreino(a))}`}
                    onClick={() => agir((st) => treinarAssessor(st, cargo.chave))}>Capacitar · {formatBRL(custoTreino(a))}</button>
                  <button className="btn sm ghost" style={{ color: 'var(--red)', borderColor: 'var(--red)' }}
                    onClick={() => agir((st) => demitirAssessor(st, cargo.chave))}>Demitir</button>
                </div>
              </>
            ) : (
              <>
                <p className="small dim">Vaga aberta. {cargo.afeta.map((x) => x.replace(/_/g, ' ')).join(', ')}.</p>
                {aba === cargo.chave ? (
                  <div className="stack" style={{ gap: 8, marginTop: 8 }}>
                    {candidatos.map((c) => (
                      <div key={c.id} className="row">
                        <span className="grow">
                          <span className="name">{c.nome}</span> <Pill>{c.traçoNome}</Pill>{' '}
                          <span className="small faint">comp. {c.competencia} · leald. {c.lealdade}</span>
                        </span>
                        <span className="num small">{formatBRL(c.salario)}</span>
                        <button className="btn sm" onClick={() => agir((st) => contratarAssessor(st, c))}>Contratar</button>
                      </div>
                    ))}
                    <button className="btn sm ghost" onClick={() => setAba(null)}>Cancelar</button>
                  </div>
                ) : (
                  <button className="btn sm" style={{ marginTop: 8 }} onClick={() => setAba(cargo.chave)}>Ver candidatos</button>
                )}
              </>
            )}
          </Card>
        );
      })}
    </div>
  );
}
