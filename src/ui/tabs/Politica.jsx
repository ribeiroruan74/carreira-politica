import { useState } from 'react';
import { useGame } from '../../state/store';
import { Card, Meter, Pill, PageHead, Stat } from '../components/primitives';
import { corPartido } from '../../engine/voteModel';
import { baseInterna, disputarDiretorioJogador } from '../../engine/world';
import partiesDef from '../../content/parties.json';
import polDef from '../../content/politicians.json';

function eixoLabel(e) {
  if (e <= -50) return 'esquerda';
  if (e <= -15) return 'centro-esquerda';
  if (e < 15) return 'centro';
  if (e < 50) return 'centro-direita';
  return 'direita';
}
const relLabel = (v) => (v >= 60 ? 'aliado' : v >= 40 ? 'próximo' : v >= 15 ? 'cordial' : v <= -25 ? 'adversário' : v < 0 ? 'frio' : 'neutro');

export default function Politica({ irPara }) {
  const s = useGame((g) => g.estado);
  const aplicar = useGame((g) => g.aplicar);
  const [filtro, setFiltro] = useState('TODOS');
  const [erro, setErro] = useState(null);
  const p = partiesDef.partidos.find((x) => x.id === s.personagem.partidoId);
  const pr = s.mundo.partidosRuntime?.[s.personagem.partidoId];
  const presidente = pr && s.mundo.politicos?.[pr.presidenteMunicipal];

  const politicos = Object.values(s.mundo.politicos || {}).filter((x) => x.ativo);
  const grupo = s.personagem.grupoPolitico.map((id) => s.mundo.politicos[id]).filter(Boolean);

  const filtrados = politicos
    .filter((x) => {
      if (filtro === 'MEU_PARTIDO') return x.partidoId === s.personagem.partidoId;
      if (filtro === 'ALIADOS') return x.relacaoJogador >= 40;
      if (filtro === 'ADVERSARIOS') return x.relacaoJogador <= -20;
      if (filtro === 'LIDERANCAS') return x.lider || x.influencia >= 65;
      return true;
    })
    .sort((a, b) => b.influencia - a.influencia)
    .slice(0, 40);

  if (!p) {
    return (
      <div className="stack">
        <PageHead eyebrow="Política" title="Sem partido" />
        <Card>
          <p className="small dim">Você ainda não é filiado. Sem legenda não há candidatura.</p>
          <button className="btn" style={{ marginTop: 10 }} onClick={() => irPara('agenda')}>Ver objetivo na Agenda</button>
        </Card>
      </div>
    );
  }

  return (
    <div className="stack">
      <PageHead eyebrow="Política" title={p.nome}>
        {p.id} · {eixoLabel(p.eixo)}
      </PageHead>

      <div className="grid cols-3">
        <Card><Stat k="Força no Recife" v={`${p.forcaRecife}/100`} /></Card>
        <Card><Stat k="Bancada na Câmara" v={pr ? `${pr.bancada}` : '—'} /></Card>
        <Card><Stat k="Popularidade do partido" v={pr ? `${Math.round(pr.popularidade)}` : '—'} sub="peso do seu nome + dos filiados" /></Card>
      </div>

      {['PARTIDO', 'CANDIDATO'].includes(s.personagem.fase) && pr && (
        <Card title="Disputa interna pela indicação" aside={<Pill tone={pr.apoioAoJogador >= 45 ? 'accent' : pr.apoioAoJogador >= 25 ? 'amber' : 'red'}>{Math.round(pr.apoioAoJogador)}%</Pill>}>
          <Meter label="Apoio interno a você" value={pr.apoioAoJogador} tone={pr.apoioAoJogador >= 45 ? 'ok' : pr.apoioAoJogador >= 25 ? 'warn' : 'bad'} />
          <p className="small dim" style={{ marginTop: 8 }}>
            Quanto o partido banca a sua candidatura — define o tamanho do aporte de campanha. Cai quando surgem pré-candidatos rivais; sobe quando você cultiva as lideranças e reforça sua indicação.
          </p>
          {pr.preCandidatos.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <div className="small faint mono" style={{ marginBottom: 4 }}>PRÉ-CANDIDATOS DISPUTANDO O ESPAÇO</div>
              {pr.preCandidatos.map((pc, i) => (
                <div key={i} className="row"><span className="grow name">{pc.nome}</span><span className="num faint">força {pc.forca}</span></div>
              ))}
            </div>
          )}
        </Card>
      )}

      {pr && (
        <Card title="Diretório municipal" aside={<Pill tone={pr.diretorioDoJogador ? 'accent' : undefined}>{pr.diretorioDoJogador ? 'você preside' : `preside: ${presidente?.nome || '—'}`}</Pill>}>
          {pr.diretorioDoJogador ? (
            <p className="small dim">Você comanda o diretório do {p.id} na cidade: controla a indicação de candidaturas, os recursos do partido e a lista para a Câmara. Isso segura seu apoio interno num piso alto.</p>
          ) : (
            <>
              <p className="small dim">Quem preside o diretório controla candidaturas e recursos do partido na cidade. Disputar exige base interna — filiados que te apoiam + apoio institucional.</p>
              <div className="row" style={{ marginTop: 8 }}>
                <span className="grow">Sua base interna</span>
                <span className="num">{baseInterna(s)}</span>
              </div>
              <button className="btn sm" style={{ marginTop: 10 }} disabled={s.tempo.pontosRestantes < 3}
                onClick={() => {
                  try { aplicar((st) => disputarDiretorioJogador(st)); setErro(null); }
                  catch (e) { setErro(e.message); }
                }}>
                Disputar a presidência do diretório (3 tempo)
              </button>
              {erro && <p className="small" style={{ color: 'var(--red)', marginTop: 6 }}>{erro}</p>}
            </>
          )}
        </Card>
      )}

      {s.eleicao?.coligacoes && (
        <Card title="Coligação nesta eleição">
          {(() => {
            const cs = s.eleicao.coligacoes;
            const cid = cs.deColigacao[s.personagem.partidoId];
            const mem = cs.membros[cid] || [s.personagem.partidoId];
            return (
              <>
                <p className="small"><strong>{cs.nomes[cid]}</strong></p>
                <div className="chips">{mem.map((x) => <Pill key={x} tone={x === s.personagem.partidoId ? 'accent' : undefined}>{x}</Pill>)}</div>
                <p className="small faint" style={{ marginTop: 8 }}>
                  {mem.length > 1
                    ? 'Os votos de todas essas siglas contam juntos para o quociente. Um nanico pode entrar de carona numa legenda forte — e você também.'
                    : 'Seu partido corre isolado nesta eleição.'}
                </p>
              </>
            );
          })()}
        </Card>
      )}

      <Card title="Seu grupo político" aside={`${grupo.length} apoio(s)`}>
        {grupo.length === 0
          ? <p className="small dim">Ninguém apoia você formalmente ainda. Cultive a relação (quanto mais influente o político, mais alta a confiança exigida) e use “Negociar apoio formal” na Agenda.</p>
          : grupo.map((g) => (
            <div key={g.id} className="row">
              <span className="grow name">{g.nome} <span className="pill" style={{ borderColor: corPartido(g.partidoId), color: corPartido(g.partidoId) }}>{g.partidoId}</span></span>
              <span className="faint small">{polDef.cargoNome[g.cargo]} · infl. {g.influencia}</span>
            </div>
          ))}
        <p className="small faint" style={{ marginTop: 8 }}>Aliados dão eco na imprensa, caixa e território no início da campanha — proporcional à influência.</p>
      </Card>

      <Card title="Cenário político do Recife" aside={`${politicos.length} atores`}>
        <div className="chips" style={{ marginBottom: 10 }}>
          {[['TODOS', 'Todos'], ['MEU_PARTIDO', 'Meu partido'], ['LIDERANCAS', 'Lideranças'], ['ALIADOS', 'Próximos a mim'], ['ADVERSARIOS', 'Adversários']].map(([id, nome]) => (
            <button key={id} className={`btn sm ${filtro === id ? '' : 'ghost'}`} onClick={() => setFiltro(id)}>{nome}</button>
          ))}
        </div>
        {filtrados.map((x) => (
          <div key={x.id} className="row">
            <span className="grow">
              <span className="name">{x.nome}</span>{' '}
              <span className="pill" style={{ borderColor: corPartido(x.partidoId), color: corPartido(x.partidoId) }}>{x.partidoId}</span>{' '}
              <span className="small faint">{polDef.cargoNome[x.cargo]}</span>
            </span>
            <span className="faint small" style={{ width: 66, textAlign: 'right' }}>infl. {x.influencia}</span>
            <Pill tone={x.relacaoJogador >= 40 ? 'accent' : x.relacaoJogador <= -20 ? 'red' : undefined}>{relLabel(x.relacaoJogador)}</Pill>
          </div>
        ))}
      </Card>
    </div>
  );
}
