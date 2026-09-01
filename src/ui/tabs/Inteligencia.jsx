import { useMemo, useState } from 'react';
import { useGame } from '../../state/store';
import { Card, PageHead, Pill } from '../components/primitives';
import {
  relatorios, pesquisarBairro, pesquisarGrupo, pesquisarRival, rivaisConhecidos,
  analisarTendencias, eleitoradoPotencial, forcasEfraquezas, temasPopulares, sugerirProjetos,
} from '../../engine/intel';
import { GRUPOS_LISTA } from '../../engine/electorate';
import { bairrosDaCidade } from '../../engine/offices';

function Bloco({ titulo, res }) {
  if (!res) return null;
  return (
    <div style={{ marginTop: 10 }}>
      {titulo && <div className="mono faint" style={{ marginBottom: 4 }}>{titulo}</div>}
      <div className="stack" style={{ gap: 5 }}>
        {res.linhas.map((l, i) => <p key={i} className="small" style={{ margin: 0 }}>{l}</p>)}
      </div>
    </div>
  );
}

export default function Inteligencia() {
  const s = useGame((g) => g.estado);
  const rels = relatorios(s);
  const bairros = bairrosDaCidade(s.personagem.cidade);
  const rivais = useMemo(() => rivaisConhecidos(s), [s]);

  const [bairroId, setBairroId] = useState(bairros[0].id);
  const [grupoId, setGrupoId] = useState(GRUPOS_LISTA[0].id);
  const [rivalId, setRivalId] = useState(rivais[0]?.id || '');
  const [aba, setAba] = useState('resumo');

  const emMandato = !!s.mandato;
  const sugestoes = emMandato ? sugerirProjetos(s) : [];

  return (
    <div className="stack">
      <PageHead eyebrow="Central de Inteligência" title="O que sua equipe está vendo">
        Relatórios e pesquisas montados a partir dos dados reais do jogo. A leitura pode errar — os números, não.
      </PageHead>

      <div className="chips">
        {[['resumo', 'Resumo'], ['pesquisa', 'Pesquisas'], ['analise', 'Análises'], emMandato && ['propor', 'O que propor?']]
          .filter(Boolean).map(([id, nome]) => (
            <button key={id} className={`btn sm ${aba === id ? '' : 'ghost'}`} onClick={() => setAba(id)}>{nome}</button>
          ))}
      </div>

      {aba === 'resumo' && rels.map((r) => (
        <Card key={r.area}
          style={r.alerta ? { borderLeft: '4px solid var(--red)' } : r.recomendacao ? { borderLeft: '4px solid var(--accent)' } : undefined}
        >
          <div className="card-head" style={{ marginBottom: 8 }}><h3>{r.ico} {r.area}</h3></div>
          <div className="stack" style={{ gap: 6 }}>
            {r.linhas.map((l, i) => (
              <p key={i} className="small" style={{ margin: 0, color: r.alerta && i === 0 ? 'var(--red)' : undefined }}>{l}</p>
            ))}
          </div>
        </Card>
      ))}

      {aba === 'pesquisa' && (
        <>
          <Card title="🏘️ Pesquisar bairro">
            <select value={bairroId} onChange={(e) => setBairroId(e.target.value)}>
              {bairros.map((b) => <option key={b.id} value={b.id}>{b.nome} · {b.regiao}</option>)}
            </select>
            <Bloco res={pesquisarBairro(s, bairroId)} />
          </Card>
          <Card title="👥 Pesquisar segmento">
            <select value={grupoId} onChange={(e) => setGrupoId(e.target.value)}>
              {GRUPOS_LISTA.map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}
            </select>
            <Bloco res={pesquisarGrupo(s, grupoId)} />
          </Card>
          <Card title="⚔️ Pesquisar adversário">
            {rivais.length === 0 ? <p className="small dim">Nenhum político relevante mapeado ainda.</p> : (
              <>
                <select value={rivalId} onChange={(e) => setRivalId(e.target.value)}>
                  {rivais.map((r) => <option key={r.id} value={r.id}>{r.nome} · {r.partidoId}</option>)}
                </select>
                <Bloco res={pesquisarRival(s, rivalId)} />
              </>
            )}
          </Card>
        </>
      )}

      {aba === 'analise' && (
        <>
          <Card title="📈 Tendências"><Bloco res={analisarTendencias(s)} /></Card>
          <Card title="🎯 Eleitorado potencial"><Bloco res={eleitoradoPotencial(s)} /></Card>
          <Card title="🧭 Forças e fraquezas"><Bloco res={forcasEfraquezas(s)} /></Card>
          <Card title="🔥 Temas populares agora"><Bloco res={temasPopulares(s)} /></Card>
        </>
      )}

      {aba === 'propor' && (
        <Card title="🏛️ O que devo propor?">
          <p className="small dim" style={{ marginBottom: 10 }}>
            A equipe cruzou promessas em aberto, satisfação dos grupos, potencial dos bairros e o clima do momento.
            Leve a sugestão para a aba Mandato.
          </p>
          {sugestoes.length === 0 ? <p className="small dim">Sem sugestão clara agora — o cenário está estável.</p> : (
            <div className="stack" style={{ gap: 10 }}>
              {sugestoes.map((sug, i) => (
                <div key={i} className="card" style={{ background: 'var(--surface-2)', padding: 12 }}>
                  <div className="row" style={{ alignItems: 'baseline' }}>
                    <strong className="grow">{sug.tituloExemplo}</strong>
                    {sug.prioridade >= 3 && <Pill tone="red">urgente</Pill>}
                    {sug.prioridade === 2 && <Pill tone="amber">alta</Pill>}
                  </div>
                  <p className="small dim" style={{ margin: '4px 0 0' }}>
                    {sug.tipoNome} · {sug.temaNome} · {sug.bairroNome}
                  </p>
                  <p className="small" style={{ margin: '6px 0 0' }}>▸ {sug.motivo}</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
