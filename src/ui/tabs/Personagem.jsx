import { useGame } from '../../state/store';
import { Card, Meter, Pill, PageHead } from '../components/primitives';
import { formatBRL } from '../../engine/tick';
import { progressoAtributo, TREINAVEIS } from '../../engine/attributes';
import attributesDef from '../../content/attributes.json';
import professionsDef from '../../content/professions.json';

const TREINAVEL_IDS = new Set(TREINAVEIS.map((t) => t.id));

export default function Personagem() {
  const s = useGame((g) => g.estado);
  const { personagem: p, financas } = s;
  const prof = professionsDef.profissoes.find((x) => x.id === p.profissaoId);
  const traço = attributesDef.traços.find((t) => t.id === p.traçoId);
  const atributos = attributesDef.atributos;

  return (
    <div className="stack">
      <PageHead eyebrow="Personagem" title={p.nome}>
        {p.idade} anos · {prof?.nome}{traço ? ` · ${traço.nome}` : ''}
      </PageHead>

      <div className="grid cols-2">
        <Card title="Atributos de personalidade" aside="0–100">
          <div className="grid cols-2" style={{ gap: 8 }}>
            {atributos.map((a) => {
              const v = p.atributos[a.id] ?? 0;
              const treinavel = TREINAVEL_IDS.has(a.id);
              const prog = treinavel ? progressoAtributo(s, a.id) : null;
              return (
                <div key={a.id}>
                  <Meter label={a.nome} value={v} tone={v >= 60 ? 'ok' : v <= 35 ? 'bad' : 'warn'} />
                  {prog && prog.noTeto && (
                    <div className="small faint" style={{ marginTop: 2 }}>no teto</div>
                  )}
                </div>
              );
            })}
          </div>
          <p className="small faint" style={{ marginTop: 10 }}>
            Atributos evoluem com curso, treino, mentoria (Agenda) e prática (discursos, entrevistas, debates, podcasts). Sobe mais devagar perto do teto.
          </p>
        </Card>

        <div className="stack">
          <Card title="Habilidades">
            {Object.keys(p.skills).length === 0 && <p className="small dim">Nenhuma habilidade desenvolvida ainda.</p>}
            <div className="stack" style={{ gap: 8 }}>
              {Object.entries(p.skills).map(([k, v]) => (
                <Meter key={k} label={k.replace(/_/g, ' ')} value={v} tone="info" />
              ))}
            </div>
          </Card>

          <Card title="Carreira profissional">
            {p.cargoAtual === 'VEREADOR' ? (
              <p className="small dim">Você exerce mandato de vereador(a) — subsídio de {formatBRL(financas.rendaMensal)}/mês.{p.emprego && !p.licenciado && ` Mantém ${p.emprego.titulo} em meio período.`}</p>
            ) : p.emprego ? (
              <>
                <div className="row"><span className="grow name">{p.emprego.titulo}</span><span className="faint small">{p.emprego.setor}</span></div>
                <div className="row"><span className="grow">Salário{p.licenciado ? ' (licenciado — 50%)' : ''}</span><span className="num">{formatBRL(financas.rendaMensal)}</span></div>
                <div className="row"><span className="grow">Horas / mês</span><span className="num">{p.licenciado ? 0 : p.emprego.horas} pontos</span></div>
              </>
            ) : <p className="small dim">Sem emprego no momento.</p>}
            <p className="small faint" style={{ marginTop: 8 }}>Use “Procurar um emprego melhor”, “Pedir aumento” e “Pegar um freela” na Agenda.</p>
          </Card>

          <Card title="Patrimônio">
            <div className="row"><span className="grow">Caixa pessoal</span><span className="num">{formatBRL(financas.pessoal)}</span></div>
            <div className="row"><span className="grow">Patrimônio declarado</span><span className="num">{formatBRL(p.patrimonio)}</span></div>
            <div className="row"><span className="grow">Custo de vida</span><span className="num">−{formatBRL(financas.custoVidaMensal)}</span></div>
          </Card>

          <Card title="Vida pessoal">
            {(() => {
              const v = p.vida || {};
              const civil = { solteiro: 'Solteiro(a)', casado: 'Casado(a)' }[v.estadoCivil] || v.estadoCivil;
              return (
                <>
                  <Meter label="Saúde" value={Math.round(v.saude ?? 100)}
                    tone={(v.saude ?? 100) >= 60 ? 'ok' : (v.saude ?? 100) <= 30 ? 'bad' : 'warn'} />
                  <div className="row" style={{ marginTop: 8 }}><span className="grow">Estado civil</span><span className="small">{civil}{v.conjuge ? ` — ${v.conjuge.nome}` : ''}</span></div>
                  <div className="row"><span className="grow">Filhos</span><span className="num">{v.filhos ?? 0}</span></div>
                  <div className="row"><span className="grow">Hobby</span><span className="small">{v.hobby || '—'}</span></div>
                  <p className="small faint" style={{ marginTop: 8 }}>Saúde baixa derruba sua energia máxima. Use “Cuidar da saúde e da vida pessoal” na Agenda.</p>
                </>
              );
            })()}
          </Card>

          <Card title="Contatos herdados da profissão">
            <div className="chips">
              {(prof?.contatos || []).map((c) => <Pill key={c}>{c.replace(/_/g, ' ')}</Pill>)}
            </div>
          </Card>
        </div>
      </div>

      <Card title="Trajetória">
        {[...p.historicoProfissional, ...p.historicoPolitico].map((h, i) => (
          <div key={i} className="log-item"><span className="when">mês {h.mes}</span><span className="txt">{h.texto}</span></div>
        ))}
      </Card>
    </div>
  );
}
