import { useGame } from '../../state/store';
import { Card, Stat, PageHead } from '../components/primitives';
import { formatBRL } from '../../engine/tick';
import { doadoresResumo, exposicaoDoadores } from '../../engine/donors';
import { resumoPatrimonio } from '../../engine/assets';

const POLITICO = [
  { k: 'campanha', nome: 'Caixa de campanha', desc: 'Recursos de campanha, com regra própria. Ativado quando você for candidato.' },
  { k: 'partidaria', nome: 'Recursos partidários', desc: 'Verba do partido. Depende de negociação interna.' },
  { k: 'gabinete', nome: 'Orçamento de gabinete', desc: 'Custeio do mandato: equipe, deslocamento, comunicação institucional.' },
];

function Linha({ label, valor, cor, forte }) {
  return (
    <div className="row">
      <span className="grow">{forte ? <strong>{label}</strong> : label}</span>
      <span className="num" style={cor ? { color: cor } : undefined}>{forte ? <strong>{valor}</strong> : valor}</span>
    </div>
  );
}

export default function Financas({ irPara }) {
  const estado = useGame((g) => g.estado);
  const f = estado.financas;
  const p = estado.personagem;
  const rp = resumoPatrimonio(estado);
  const saldoMes = f.rendaMensal - f.custoVidaMensal;
  const rendaPassiva = rp.rendaPassivaEst || 0;
  const despesasRec = rp.manutencaoInst || 0;
  const liquido = (f.pessoal || 0) + (p.patrimonio || 0);
  const doadores = doadoresResumo(estado);
  const exposicao = exposicaoDoadores(estado);
  const temPatrimonio = (p.patrimonio || 0) > 0 || (p.empresas || []).length > 0 || rp.valorInvestido > 0;

  return (
    <div className="stack">
      <PageHead eyebrow="Finanças" title="Seu dinheiro, seu patrimônio e o caixa político">
        Cada natureza de recurso tem regra própria. Misturar caixa de campanha com dinheiro pessoal é problema — inclusive no jogo.
      </PageHead>

      <div className="grid cols-2">
        <Card><Stat k="Patrimônio líquido" v={formatBRL(liquido)} sub="caixa pessoal + bens" /></Card>
        <Card><Stat k="Saldo por mês" v={`${saldoMes >= 0 ? '+' : ''}${formatBRL(saldoMes)}`} sub={saldoMes >= 0 ? 'no azul' : 'no vermelho'} /></Card>
      </div>

      <Card title="Seu dinheiro">
        <Linha label="Caixa pessoal" valor={formatBRL(f.pessoal)} forte />
        <div style={{ borderTop: '1px solid var(--line)', margin: '8px 0' }} />
        <Linha label="Salário / renda" valor={`+${formatBRL(f.rendaMensal)}`} cor="var(--accent)" />
        {rendaPassiva > 0 && <Linha label="Renda passiva (empresas)" valor={`+${formatBRL(rendaPassiva)}`} cor="var(--accent)" />}
        <Linha label="Custo de vida" valor={`−${formatBRL(f.custoVidaMensal)}`} cor="var(--red)" />
        {despesasRec > 0 && <Linha label="Despesas recorrentes (instituições)" valor={`−${formatBRL(despesasRec)}`} cor="var(--red)" />}
        {saldoMes < 0 && <p className="small" style={{ color: 'var(--amber)', marginTop: 10 }}>Você gasta mais do que ganha. Sem uma renda melhor, o patrimônio vai encolhendo.</p>}
      </Card>

      <Card title="Seu patrimônio" aside={irPara && <button className="btn sm ghost" onClick={() => irPara('negocios')}>Gerir</button>}>
        <Linha label="Bens, reservas e participações" valor={formatBRL(p.patrimonio || 0)} />
        {rp.valorInvestido > 0 && <p className="small dim" style={{ margin: '2px 0 0' }}>dos quais em investimentos: {formatBRL(rp.valorInvestido)}</p>}
        {rp.valorEmpresas > 0 && <p className="small dim" style={{ margin: '2px 0 0' }}>dos quais em empresas ({(p.empresas || []).length}): {formatBRL(rp.valorEmpresas)}</p>}
        <div style={{ borderTop: '1px solid var(--line)', margin: '8px 0' }} />
        <Linha label="Patrimônio líquido (com caixa pessoal)" valor={formatBRL(liquido)} forte />
        {!temPatrimonio && <p className="small dim" style={{ marginTop: 8 }}>Você ainda não constituiu patrimônio relevante. Empresas e investimentos ficam na aba Negócios.</p>}
      </Card>

      <Card title="Recursos político-eleitorais">
        <p className="small dim" style={{ marginTop: 0 }}>Não são seus. Têm destino carimbado e prestação de contas própria.</p>
        <div className="stack" style={{ gap: 8, marginTop: 8 }}>
          {POLITICO.map((c) => (
            <div key={c.k}>
              <Linha label={c.nome} valor={formatBRL(f[c.k])} forte />
              <p className="small dim" style={{ margin: '2px 0 0' }}>{c.desc}</p>
            </div>
          ))}
        </div>
      </Card>

      {doadores.length > 0 && (
        <Card title="Financiadores de campanha">
          <div className="row">
            <span className="grow small dim">Exposição do financiamento (concentração + risco)</span>
            <span className="num" style={{ color: exposicao >= 60 ? 'var(--red)' : exposicao >= 35 ? 'var(--amber)' : 'var(--accent)' }}>{exposicao}/100</span>
          </div>
          <div className="stack" style={{ marginTop: 10, gap: 6 }}>
            {doadores.map((d) => (
              <div key={d.id} className="row" style={{ alignItems: 'baseline' }}>
                <span className="grow">
                  <strong>{d.nome}</strong> <span className="small dim">· {d.setorNome}</span>
                  <br /><span className="small dim">Interesse: {d.interesse}{d.cobrado ? ' · já cobrou contrapartida' : ''}{d.investigado ? ' · sob investigação' : ''}</span>
                </span>
                <span className="num">{formatBRL(d.valorTotal)}</span>
              </div>
            ))}
          </div>
          <p className="small dim" style={{ marginTop: 10 }}>Toda doação tem origem. Setores muito concentrados viram reportagem — e quem banca, cobra.</p>
        </Card>
      )}
    </div>
  );
}
