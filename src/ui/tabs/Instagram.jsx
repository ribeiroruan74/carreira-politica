import { useState, useMemo } from 'react';
import { useGame } from '../../state/store';
import { Card, Stat, Meter, Pill, PageHead, Sparkline } from '../components/primitives';
import { FORMATOS, PAUTAS, postar, estimarAlcance, relevanciaMidiatica, fazerLive, perguntasCaixa } from '../../engine/social';
import { bairrosDaCidade } from '../../engine/offices';
import { imagemResumo, IMAGEM_EIXOS } from '../../engine/image';
import { influenciadoresDisponiveis, contratarInfluenciador } from '../../engine/influencers';
import { formatBRL } from '../../engine/tick';

export default function Instagram() {
  const s = useGame((g) => g.estado);
  const aplicar = useGame((g) => g.aplicar);
  const [formato, setFormato] = useState('reels');
  const [pauta, setPauta] = useState('proposta');
  const [erro, setErro] = useState(null);
  const [ultimo, setUltimo] = useState(null);

  const r = s.redes;
  const serie = (s.series || []).map((x) => x.seguidores).filter((v) => v != null);
  const alcanceEst = estimarAlcance(s);
  const f = FORMATOS.find((x) => x.id === formato);
  const bloq = !!s.eventoPendente || s.tempo.pontosRestantes < f.tempo;
  const img = imagemResumo(s);
  const influs = influenciadoresDisponiveis(s);
  const [mesesContrato, setMesesContrato] = useState(3);
  const [erroInf, setErroInf] = useState(null);

  function contratar(id) {
    try { aplicar((st) => contratarInfluenciador(st, id, mesesContrato)); setErroInf(null); }
    catch (e) { setErroInf(e.message); }
  }

  function publicar() {
    try {
      let res;
      aplicar((st) => { res = postar(st, formato, pauta); });
      setUltimo(res);
      setErro(null);
    } catch (e) { setErro(e.message); }
  }

  const bairros = bairrosDaCidade(s.personagem.cidade);
  const [liveModo, setLiveModo] = useState('aberta');
  const [liveBairro, setLiveBairro] = useState(bairros[0].id);
  const [caixaResp, setCaixaResp] = useState({});
  const [liveRes, setLiveRes] = useState(null);
  const jaFezLive = (s.redes.ultimaLive ?? -99) === s.tempo.mes;
  const perguntas = useMemo(
    () => (liveModo === 'caixa' ? perguntasCaixa(s) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [liveModo, s.tempo.mes],
  );

  function transmitir() {
    try {
      let res;
      const respostas = perguntas.map((q, i) => caixaResp[i] || q.tons[0].id);
      aplicar((st) => { res = fazerLive(st, { modo: liveModo, bairroId: liveBairro, respostas }); });
      setLiveRes(res); setCaixaResp({}); setErro(null);
    } catch (e) { setErro(e.message); }
  }

  return (
    <div className="stack">
      <PageHead eyebrow="Instagram" title={`${r.seguidores.toLocaleString('pt-BR')} seguidores`}>
        Nenhuma publicação tem alcance garantido. Um Reels pode fazer 800 ou 5 milhões — e viralizar também aumenta rejeição.
      </PageHead>

      <div className="grid cols-3">
        <Card><Stat k="Seguidores" v={r.seguidores.toLocaleString('pt-BR')} delta={r.crescimentoMensal} /></Card>
        <Card><Stat k="Alcance médio" v={r.alcanceMedio.toLocaleString('pt-BR')} /></Card>
        <Card><Stat k="Engajamento" v={`${(r.engajamento * 100).toFixed(1)}%`} /></Card>
      </div>

      <Card title="Relevância midiática" aside={`${relevanciaMidiatica(s)}/100`}>
        <Meter label="Presença pública (notoriedade + audiência + repercussão + cargo)" value={relevanciaMidiatica(s)} tone="info" />
        <p className="small faint" style={{ marginTop: 8 }}>
          É o quanto você "existe" na mídia — alimenta convites de entrevista e o peso do seu nome no partido.
          Não é aprovação nem voto: seguidor grande dá alcance e notoriedade, não urna.
        </p>
      </Card>

      {serie.length > 1 && (
        <Card title="Crescimento de seguidores">
          <Sparkline data={serie} width={280} height={44} />
        </Card>
      )}

      <Card title="Nova publicação" aside={`${s.tempo.pontosRestantes} tempo disponível`}>
        <div className="field-row two">
          <div>
            <label>Formato</label>
            <select value={formato} onChange={(e) => setFormato(e.target.value)}>
              {FORMATOS.map((x) => <option key={x.id} value={x.id}>{x.nome} · {x.tempo} tempo</option>)}
            </select>
          </div>
          <div>
            <label>Pauta</label>
            <select value={pauta} onChange={(e) => setPauta(e.target.value)}>
              {PAUTAS.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
            </select>
          </div>
        </div>
        <div className="chips" style={{ margin: '10px 0' }}>
          <Pill>alcance provável ~{alcanceEst.toLocaleString('pt-BR')}</Pill>
          {f.id === 'reels' && <Pill tone="amber">alto potencial viral</Pill>}
          {pauta === 'denuncia' || pauta === 'humor' ? <Pill tone="red">risco de rejeição</Pill> : null}
        </div>
        <button className="btn" disabled={bloq} onClick={publicar}>Publicar</button>
        {erro && <p className="small" style={{ color: 'var(--red)', marginTop: 8 }}>{erro}</p>}
        {ultimo && (
          <div className="card" style={{ marginTop: 12, background: 'var(--surface-2)' }}>
            <p className="small" style={{ margin: 0 }}>{ultimo.resumo}</p>
          </div>
        )}
      </Card>

      <Card title="Live" aside={`2 tempo · ${jaFezLive ? 'já fez este mês' : 'ao vivo é sem roteiro'}`}>
        <div className="chips" style={{ marginBottom: 10 }}>
          {[['aberta', 'Live aberta'], ['bairro', 'Live de bairro'], ['caixa', 'Caixa de perguntas']].map(([id, nome]) => (
            <button key={id} className={`btn sm ${liveModo === id ? '' : 'ghost'}`} onClick={() => { setLiveModo(id); setLiveRes(null); }}>{nome}</button>
          ))}
        </div>
        {liveModo === 'bairro' && (
          <select value={liveBairro} onChange={(e) => setLiveBairro(e.target.value)} style={{ marginBottom: 10 }}>
            {bairros.map((b) => <option key={b.id} value={b.id}>{b.nome} · {b.regiao}</option>)}
          </select>
        )}
        {liveModo === 'caixa' && (
          <div className="stack" style={{ gap: 10, marginBottom: 10 }}>
            <p className="small dim" style={{ margin: 0 }}>As perguntas vêm do seu histórico. Escolha como responder cada uma.</p>
            {perguntas.map((q, i) => (
              <div key={q.id}>
                <p className="small" style={{ margin: '0 0 4px', fontWeight: 600 }}>"{q.texto}"</p>
                <div className="chips">
                  {q.tons.map((t) => (
                    <button key={t.id} className={`btn sm ${(caixaResp[i] || q.tons[0].id) === t.id ? '' : 'ghost'}`}
                      onClick={() => setCaixaResp({ ...caixaResp, [i]: t.id })}>{t.texto}</button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
        <p className="small faint" style={{ margin: '0 0 8px' }}>
          {liveModo === 'aberta' && 'Maior alcance e maior variância: pode viralizar ou escorregar numa fala.'}
          {liveModo === 'bairro' && 'Alcance menor, mas firma sua presença e voto naquele bairro.'}
          {liveModo === 'caixa' && 'Interação direta: boa resposta cola confiança, má resposta vira corte.'}
        </p>
        <button className="btn" disabled={jaFezLive || s.tempo.pontosRestantes < 2 || !!s.eventoPendente} onClick={transmitir}>Entrar ao vivo</button>
        {liveRes && (
          <div className="card" style={{ marginTop: 12, background: 'var(--surface-2)' }}>
            <p className="small" style={{ margin: 0 }}>{liveRes.resumo}</p>
          </div>
        )}
      </Card>

      <Card title="Imagem pública" aside="como o eleitor te enxerga">
        <p className="small dim" style={{ marginBottom: 10 }}>
          Hoje você passa a imagem de <strong>{img.filter((x) => x.forca >= 6).map((x) => x.frase).join(', ') || 'alguém ainda sem marca definida'}</strong>.
          Podcasts moldam isso mais que qualquer post.
        </p>
        <div className="stack" style={{ gap: 8 }}>
          {IMAGEM_EIXOS.map((e) => {
            const v = img.find((x) => x.id === e.id);
            return <Meter key={e.id} label={`${e.baixo} ↔ ${e.alto}`} value={v.valor} tone={v.valor >= 60 ? 'ok' : v.valor <= 40 ? 'warn' : 'info'} />;
          })}
        </div>
      </Card>

      <Card title="Influenciadores" aside="mercado de influência">
        <p className="small dim" style={{ marginBottom: 10 }}>
          Cultive relação e faça collabs pela Agenda. Contratar tranca o creator com sua campanha (pago da caixa de campanha) e nega ele a rivais.
          Nomes <strong>nacionais</strong> são apolíticos, caríssimos e só topam collab com relação alta — mas o alcance é gigante.
        </p>
        <div className="row" style={{ marginBottom: 8 }}>
          <span className="grow small">Duração do contrato</span>
          <select value={mesesContrato} onChange={(e) => setMesesContrato(Number(e.target.value))}>
            {[2, 3, 4, 6].map((m) => <option key={m} value={m}>{m} meses</option>)}
          </select>
        </div>
        {erroInf && <p className="small" style={{ color: 'var(--red)' }}>{erroInf}</p>}
        <div className="stack" style={{ gap: 6 }}>
          {influs.map((i) => (
            <div key={i.id} className="row" style={{ alignItems: 'baseline' }}>
              <span className="grow">
                <strong>{i.nome}</strong>{i.real && <Pill tone="blue">nacional</Pill>} <span className="small dim">· {i.nicho} · alcance {i.alcance}</span>
                <br />
                <span className="small dim">
                  relação {Math.round(i.relacao)} · afinidade {i.afinidade}
                  {i.contratado ? ' · SUA campanha' : i.capturado ? ' · com um rival' : ''}
                </span>
              </span>
              {i.contratado ? (
                <Pill tone="accent">contratado</Pill>
              ) : (
                <button className="btn sm ghost" onClick={() => contratar(i.id)}>
                  {formatBRL(i.cache * mesesContrato)}
                </button>
              )}
            </div>
          ))}
        </div>
      </Card>

      <Card title="Público">
        <Meter label="Notoriedade" value={s.reputacao.notoriedade} tone="info" />
        <div style={{ height: 8 }} />
        <Meter label="Rejeição" value={s.reputacao.rejeicao} tone={s.reputacao.rejeicao > 35 ? 'bad' : 'warn'} />
        <p className="small faint" style={{ marginTop: 8 }}>
          Repercussão atual (eco midiático): {Math.round(s.reputacao.ecoMidiatico)} — decai a cada mês.
        </p>
      </Card>
    </div>
  );
}
