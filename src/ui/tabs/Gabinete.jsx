import { useState, useMemo } from 'react';
import { useGame } from '../../state/store';
import { Card, Stat, Meter, Pill, PageHead } from '../components/primitives';
import { formatBRL } from '../../engine/tick';
import { streamRng } from '../../engine/rng';
import { candidatosAssessor, contratarAssessor, demitirAssessor } from '../../engine/mandate';
import staffDef from '../../content/staff.json';

export default function Gabinete() {
  const s = useGame((g) => g.estado);
  const aplicar = useGame((g) => g.aplicar);
  const m = s.mandato;
  const [aba, setAba] = useState(null); // cargoChave sendo contratado
  const [erro, setErro] = useState(null);

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

  return (
    <div className="stack">
      <PageHead eyebrow="Gabinete" title="Sua equipe">
        Funcionários bons custam mais e entregam mais. Baixa lealdade é risco de crise ou de perder gente para um rival.
      </PageHead>

      <div className="grid cols-3">
        <Card><Stat k="Verba mensal" v={formatBRL(m.gabinete.verbaMensal)} /></Card>
        <Card><Stat k="Folha atual" v={formatBRL(folha)} sub={folha > m.gabinete.verbaMensal ? 'acima da verba!' : `${Math.round((folha / m.gabinete.verbaMensal) * 100)}% da verba`} /></Card>
        <Card><Stat k="Saldo de gabinete" v={formatBRL(s.financas.gabinete)} /></Card>
      </div>

      {erro && <Card><p className="small" style={{ color: 'var(--red)', margin: 0 }}>{erro}</p></Card>}

      {staffDef.cargos.map((cargo) => {
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
                  <Meter label="Competência" value={a.competencia} tone={a.competencia >= 60 ? 'ok' : 'warn'} />
                  <Meter label="Lealdade" value={a.lealdade} tone={a.lealdade >= 55 ? 'ok' : a.lealdade >= 40 ? 'warn' : 'bad'} />
                </div>
                {a.risco && <p className="small" style={{ color: 'var(--amber)', marginTop: 6 }}>Risco: {a.risco}</p>}
                <button className="btn sm ghost" style={{ marginTop: 10, color: 'var(--red)', borderColor: 'var(--red)' }}
                  onClick={() => agir((st) => demitirAssessor(st, cargo.chave))}>Demitir</button>
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
