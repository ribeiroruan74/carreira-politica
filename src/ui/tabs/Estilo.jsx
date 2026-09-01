import { useState } from 'react';
import { useGame } from '../../state/store';
import { Card, Stat, PageHead, Pill } from '../components/primitives';
import { formatBRL } from '../../engine/tick';
import { SERVICOS, servicosAtivos, custoServicosMensal, bonusServicos, assinarServico, cancelarServico } from '../../engine/lifestyle';

const EFEITO_LABEL = {
  energiaMax: (v) => `+${v} energia máx.`,
  saudeMes: (v) => `+${v}/mês saúde`,
  bemEstarMes: (v) => `+${v}/mês bem-estar`,
  notoriedadeMes: (v) => `+${v}/mês notoriedade`,
  riscoCriseReduz: (v) => `−${Math.round(v * 100)}% risco de crise`,
};
function efeitosTexto(ef) {
  return Object.entries(ef || {}).map(([k, v]) => (EFEITO_LABEL[k] ? EFEITO_LABEL[k](v) : `${k} ${v}`)).join(' · ');
}

export default function Estilo() {
  const s = useGame((g) => g.estado);
  const aplicar = useGame((g) => g.aplicar);
  const [erro, setErro] = useState(null);

  const ativos = servicosAtivos(s);
  const custo = custoServicosMensal(s);
  const b = bonusServicos(s);
  const nivelAtivo = (id) => (s.personagem.servicos || {})[id];

  function agir(fn) {
    try { aplicar(fn); setErro(null); } catch (e) { setErro(e.message); }
  }

  const porCategoria = SERVICOS.reduce((acc, sv) => {
    (acc[sv.categoria] ||= []).push(sv);
    return acc;
  }, {});

  return (
    <div className="stack">
      <PageHead eyebrow="Estilo de vida" title="Serviços que compram tempo e energia">
        Assinatura mensal paga do caixa pessoal. Some energia, saúde e bem-estar — mas pesa nas contas todo mês. Cancelar é imediato.
      </PageHead>

      <div className="grid cols-2">
        <Card><Stat k="Custo mensal" v={formatBRL(custo)} sub={`${ativos.length} serviço(s)`} /></Card>
        <Card><Stat k="Ganho de energia" v={`+${b.energiaMax}`} sub={b.energiaMax >= 5 ? 'no teto (+5)' : 'de +5 possíveis'} /></Card>
      </div>

      {custo > s.financas.rendaMensal * 0.6 && (
        <Card><p className="small" style={{ color: 'var(--amber)', margin: 0 }}>Os serviços já comem mais da metade da sua renda. No vermelho, isso corrói o patrimônio.</p></Card>
      )}

      {erro && <Card><p className="small" style={{ color: 'var(--red)', margin: 0 }}>{erro}</p></Card>}

      {Object.entries(porCategoria).map(([cat, lista]) => (
        <div key={cat} className="stack" style={{ gap: 10 }}>
          <div className="small faint mono" style={{ letterSpacing: '0.05em' }}>{cat.toUpperCase()}</div>
          {lista.map((sv) => {
            const atual = nivelAtivo(sv.id);
            return (
              <Card key={sv.id} title={`${sv.ico} ${sv.nome}`} aside={atual != null ? <Pill tone="accent">nível {atual + 1}</Pill> : null}>
                <div className="stack" style={{ gap: 6 }}>
                  {sv.niveis.map((n, i) => {
                    const ativo = atual === i;
                    const podePagar = s.financas.pessoal >= n.custoMes;
                    return (
                      <div key={i} className="row" style={{ alignItems: 'baseline', gap: 8 }}>
                        <span className="grow">
                          <span className="small" style={{ fontWeight: ativo ? 700 : 400 }}>{n.nome}</span>
                          <br /><span className="small faint">{efeitosTexto(n.efeitos)}</span>
                        </span>
                        <span className="num small">{formatBRL(n.custoMes)}/mês</span>
                        {ativo ? (
                          <button className="btn sm ghost" style={{ color: 'var(--red)' }} onClick={() => agir((st) => cancelarServico(st, sv.id))}>Cancelar</button>
                        ) : (
                          <button className="btn sm" disabled={!podePagar} onClick={() => agir((st) => assinarServico(st, sv.id, i))}>
                            {atual != null ? 'Trocar' : 'Assinar'}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Card>
            );
          })}
        </div>
      ))}
    </div>
  );
}
