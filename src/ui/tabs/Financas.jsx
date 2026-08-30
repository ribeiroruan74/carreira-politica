import { useGame } from '../../state/store';
import { Card, Stat, PageHead } from '../components/primitives';
import { formatBRL } from '../../engine/tick';
import { doadoresResumo, exposicaoDoadores } from '../../engine/donors';

const CAIXAS = [
  { k: 'pessoal', nome: 'Caixa pessoal', desc: 'Seu dinheiro. Sustenta você e sua família; entra renda, sai custo de vida.' },
  { k: 'campanha', nome: 'Caixa de campanha', desc: 'Recursos de campanha, com regra própria. Ativado quando você for candidato.' },
  { k: 'partidaria', nome: 'Recursos partidários', desc: 'Verba do partido. Depende de negociação interna.' },
  { k: 'gabinete', nome: 'Orçamento de gabinete', desc: 'Custeio do mandato: equipe, deslocamento, comunicação institucional.' },
];

export default function Financas() {
  const estado = useGame((g) => g.estado);
  const f = estado.financas;
  const saldoMes = f.rendaMensal - f.custoVidaMensal;
  const doadores = doadoresResumo(estado);
  const exposicao = exposicaoDoadores(estado);

  return (
    <div className="stack">
      <PageHead eyebrow="Finanças" title="Quatro caixas, quatro regras">
        O dinheiro é finito e separado por natureza. Misturar caixa de campanha com caixa pessoal é problema — inclusive no jogo.
      </PageHead>

      <div className="grid cols-2">
        {CAIXAS.map((c) => (
          <Card key={c.k}>
            <Stat k={c.nome} v={formatBRL(f[c.k])} />
            <p className="small dim" style={{ marginTop: 8 }}>{c.desc}</p>
          </Card>
        ))}
      </div>

      <Card title="Fluxo mensal — caixa pessoal">
        <div className="row"><span className="grow">Renda</span><span className="num" style={{ color: 'var(--accent)' }}>+{formatBRL(f.rendaMensal)}</span></div>
        <div className="row"><span className="grow">Custo de vida</span><span className="num" style={{ color: 'var(--red)' }}>−{formatBRL(f.custoVidaMensal)}</span></div>
        <div className="row"><span className="grow"><strong>Saldo por mês</strong></span><span className="num"><strong>{saldoMes >= 0 ? '+' : ''}{formatBRL(saldoMes)}</strong></span></div>
        {saldoMes < 0 && <p className="small" style={{ color: 'var(--amber)', marginTop: 10 }}>Você gasta mais do que ganha. Sem uma fonte de renda melhor, o patrimônio vai encolhendo.</p>}
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
