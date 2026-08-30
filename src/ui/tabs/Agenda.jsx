import { useMemo, useState } from 'react';
import { useGame } from '../../state/store';
import { acoesDisponiveis, aplicarAcao, precisaBairro, precisaPessoa, precisaPolitico, precisaEmprego, precisaPodcast, precisaInfluenciador } from '../../engine/actions';
import { empregosDisponiveis } from '../../engine/jobs';
import { objetivoDaFase, aplicarObjetivo } from '../../engine/career';
import { podcastsDisponiveis, POSTURAS } from '../../engine/podcasts';
import { influenciadoresDisponiveis } from '../../engine/influencers';
import { Card, Pill, PageHead } from '../components/primitives';
import { formatBRL } from '../../engine/tick';
import { bairrosDaCidade } from '../../engine/offices';
import partiesDef from '../../content/parties.json';

const CAT_LABEL = { PESSOAL: 'Pessoal', COMUNIDADE: 'Comunidade', VIDA_PUBLICA: 'Vida pública', CAMPANHA: 'Campanha', MIDIA: 'Mídia', MANDATO: 'Mandato', POLITICA: 'Política' };

function ObjetivoCard({ obj, aplicar, irPara }) {
  const [partidoId, setPartidoId] = useState(partiesDef.partidos[0].id);
  const [cargoId, setCargoId] = useState(obj.cargoPadrao || 'VEREADOR');
  const [confirmar, setConfirmar] = useState(false);

  const cargos = obj.cargos || null;
  const cargoSel = cargos?.find((c) => c.id === cargoId) || null;
  const podeLancarCargo = !cargos || (cargoSel && cargoSel.requisitosOk && cargoSel.janelaAberta);

  function agir() {
    aplicar((st) => aplicarObjetivo(st, obj.id, { partidoId, cargoId }));
    if (obj.id === 'lancar_candidatura') irPara('eleicao');
  }

  return (
    <Card className="card" title={`Objetivo: ${obj.titulo}`} aside={<Pill tone="accent">próximo marco</Pill>}>
      <p className="small dim">{obj.desc}</p>

      {!obj.disponivel && obj.motivo && (
        <p className="small" style={{ color: 'var(--amber)', marginTop: 8 }}>
          Bloqueado — falta: {obj.motivo}
        </p>
      )}

      {obj.disponivel && obj.precisaPartido && (
        <>
          <label>Partido</label>
          <select value={partidoId} onChange={(e) => setPartidoId(e.target.value)}>
            {partiesDef.partidos.map((p) => (
              <option key={p.id} value={p.id}>{p.id} — {p.nome}</option>
            ))}
          </select>
        </>
      )}

      {cargos && cargos.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <label>Qual cargo disputar?</label>
          <select value={cargoId} onChange={(e) => { setCargoId(e.target.value); setConfirmar(false); }}>
            {cargos.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome} — {c.janelaAberta ? `eleição ${c.ano}` : c.requisitosOk ? `janela em ${c.mesesAteAbrir} mês(es)` : 'requisitos não cumpridos'}
              </option>
            ))}
          </select>
          {cargoSel && !cargoSel.requisitosOk && (
            <p className="small" style={{ color: 'var(--amber)', marginTop: 6 }}>Falta: {cargoSel.faltaRequisito}</p>
          )}
          {cargoSel && cargoSel.requisitosOk && !cargoSel.janelaAberta && (
            <p className="small" style={{ color: 'var(--amber)', marginTop: 6 }}>A janela de candidatura para {cargoSel.nome} abre em {cargoSel.mesesAteAbrir} mês(es).</p>
          )}
        </div>
      )}

      {obj.disponivel && obj.aviso && (
        <p className="small" style={{ color: 'var(--amber)', marginTop: 8 }}>{obj.aviso}</p>
      )}

      {obj.disponivel && podeLancarCargo && (
        obj.id === 'lancar_candidatura' && !confirmar ? (
          <button className="btn" style={{ marginTop: 12 }} onClick={() => setConfirmar(true)}>
            {cargoSel ? `Lançar candidatura a ${cargoSel.nome}…` : 'Lançar candidatura…'}
          </button>
        ) : (
          <button className="btn" style={{ marginTop: 12 }} onClick={agir}>
            {obj.id === 'lancar_candidatura' ? 'Confirmar e começar a campanha' : obj.titulo}
          </button>
        )
      )}
    </Card>
  );
}

export default function Agenda({ irPara }) {
  const s = useGame((g) => g.estado);
  const aplicar = useGame((g) => g.aplicar);
  const avancarMes = useGame((g) => g.avancarMes);
  const [erro, setErro] = useState(null);
  const [sel, setSel] = useState(null);

  const acoes = useMemo(
    // eslint-disable-next-line react-hooks/exhaustive-deps
    () => acoesDisponiveis(s), [s.tempo.mes, s.personagem.fase],
  );
  const obj = objetivoDaFase(s);
  const pessoas = Object.values(s.relacionamentos.pessoas);
  const politicos = Object.values(s.mundo.politicos || {}).filter((p) => p.ativo)
    .sort((a, b) => b.relacaoJogador - a.relacaoJogador || b.influencia - a.influencia);
  const emCampanha = s.personagem.fase === 'CANDIDATO';
  const vagas = empregosDisponiveis(s);
  const bairros = bairrosDaCidade(s.personagem.cidade);
  const podcasts = podcastsDisponiveis(s);
  const influs = influenciadoresDisponiveis(s);

  function executar(acao) {
    const precisa = precisaBairro(acao.id) || precisaPessoa(acao.id) || precisaPolitico(acao.id)
      || precisaEmprego(acao.id) || precisaPodcast(acao.id) || precisaInfluenciador(acao.id);
    if (precisa && (!sel || sel.acao.id !== acao.id)) {
      setSel({
        acao, bairroId: bairros[0].id, pessoaId: pessoas[0]?.id, politicoId: politicos[0]?.id,
        empregoId: vagas[0]?.id, podcastId: podcasts[0]?.id, posturaId: POSTURAS[0].id,
        influenciadorId: (precisaInfluenciador(acao.id) && acao.efeitos?.colaborarInfluenciador
          ? influs.find((i) => i.relacao >= 15) : influs[0])?.id || influs[0]?.id,
      });
      return;
    }
    const opts = {};
    if (sel && sel.acao.id === acao.id) {
      opts.bairroId = sel.bairroId; opts.pessoaId = sel.pessoaId; opts.politicoId = sel.politicoId;
      opts.empregoId = sel.empregoId; opts.podcastId = sel.podcastId; opts.posturaId = sel.posturaId;
      opts.influenciadorId = sel.influenciadorId;
    }
    try {
      aplicar((st) => aplicarAcao(st, acao.id, opts));
      setErro(null); setSel(null);
    } catch (e) { setErro(e.message); }
  }

  return (
    <div className="stack">
      <PageHead
        eyebrow={`${s.tempo.pontosRestantes}/${s.tempo.pontosPorMes} tempo · energia ${Math.round(s.tempo.energia)}${emCampanha ? ` · campanha ${formatBRL(s.financas.campanha)}` : ''}`}
        title={emCampanha ? `Campanha — ${s.eleicao.mesAtual}/${s.eleicao.totalMeses} meses` : 'Agenda do mês'}
      >
        Você não consegue fazer tudo. A cada mês surge um conjunto diferente de oportunidades — escolha onde investir tempo, energia e dinheiro.
      </PageHead>

      {obj && <ObjetivoCard obj={obj} aplicar={aplicar} irPara={irPara} />}

      {erro && <Card><p style={{ color: 'var(--red)', margin: 0 }} className="small">{erro}</p></Card>}

      <div className="grid cols-2">
        {acoes.map((a) => {
          const semTempo = (a.custo.tempo || 0) > s.tempo.pontosRestantes;
          const semGrana = (a.custo.dinheiroPessoal || 0) > s.financas.pessoal;
          const semCaixa = (a.custo.campanhaGasto || 0) > s.financas.campanha;
          const semVaga = precisaEmprego(a.id) && vagas.length === 0;
          const bloq = semTempo || semGrana || semCaixa || semVaga;
          const ativoSel = sel?.acao.id === a.id;
          return (
            <Card key={a.id}>
              <div className="card-head">
                <h3>{a.titulo}</h3>
                <Pill>{CAT_LABEL[a.categoria] || a.categoria}</Pill>
              </div>
              <p className="small dim">{a.desc}</p>
              <div className="chips" style={{ margin: '10px 0' }}>
                <Pill tone={semTempo ? 'red' : undefined}>{a.custo.tempo} tempo</Pill>
                {a.custo.energia > 0 && <Pill>{a.custo.energia} energia</Pill>}
                {a.custo.dinheiroPessoal > 0 && <Pill tone={semGrana ? 'red' : undefined}>{formatBRL(a.custo.dinheiroPessoal)} pessoal</Pill>}
                {a.custo.campanhaGasto > 0 && <Pill tone={semCaixa ? 'red' : undefined}>{formatBRL(a.custo.campanhaGasto)} campanha</Pill>}
                {a.custo.campanhaGasto < 0 && <Pill tone="accent">+{formatBRL(-a.custo.campanhaGasto)} caixa</Pill>}
              </div>

              {ativoSel && precisaBairro(a.id) && (
                <>
                  <label>Em qual bairro?</label>
                  <select value={sel.bairroId} onChange={(e) => setSel({ ...sel, bairroId: e.target.value })}>
                    {bairros.map((b) => <option key={b.id} value={b.id}>{b.nome} · {b.regiao}</option>)}
                  </select>
                </>
              )}
              {ativoSel && precisaPessoa(a.id) && (
                <>
                  <label>Qual contato?</label>
                  <select value={sel.pessoaId || ''} onChange={(e) => setSel({ ...sel, pessoaId: e.target.value })}>
                    {pessoas.map((p) => <option key={p.id} value={p.id}>{p.nome} — {p.papel}</option>)}
                  </select>
                </>
              )}
              {ativoSel && precisaEmprego(a.id) && (
                <>
                  <label>Qual vaga? {vagas.length === 0 && '(nenhuma vaga melhor disponível — desenvolva habilidades)'}</label>
                  {vagas.length > 0 && (
                    <select value={sel.empregoId || ''} onChange={(e) => setSel({ ...sel, empregoId: e.target.value })}>
                      {vagas.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.titulo} — R$ {v.salarioMedio.toLocaleString('pt-BR')}/mês · {v.horas} h/mês
                        </option>
                      ))}
                    </select>
                  )}
                </>
              )}
              {ativoSel && precisaPolitico(a.id) && (
                <>
                  <label>Qual político?</label>
                  <select value={sel.politicoId || ''} onChange={(e) => setSel({ ...sel, politicoId: e.target.value })}>
                    {politicos.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nome} — {p.partidoId} · relação {Math.round(p.relacaoJogador)}
                      </option>
                    ))}
                  </select>
                </>
              )}
              {ativoSel && precisaPodcast(a.id) && (
                <>
                  <label>Qual programa?</label>
                  <select value={sel.podcastId || ''} onChange={(e) => setSel({ ...sel, podcastId: e.target.value })}>
                    {podcasts.map((p) => (
                      <option key={p.id} value={p.id}>{p.nome} — {p.nicho} · alcance {p.alcance}{p.convida ? '' : ' (não te convidou ainda)'}</option>
                    ))}
                  </select>
                  <label>Como você vai?</label>
                  <select value={sel.posturaId || ''} onChange={(e) => setSel({ ...sel, posturaId: e.target.value })}>
                    {POSTURAS.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                  </select>
                  <p className="small faint" style={{ marginTop: 4 }}>{POSTURAS.find((p) => p.id === sel.posturaId)?.desc}</p>
                </>
              )}
              {ativoSel && precisaInfluenciador(a.id) && (
                <>
                  <label>Qual influenciador?</label>
                  <select value={sel.influenciadorId || ''} onChange={(e) => setSel({ ...sel, influenciadorId: e.target.value })}>
                    {influs.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.nome} — {i.nicho} · alcance {i.alcance} · relação {Math.round(i.relacao)}{i.capturado ? ' · com rival' : ''}
                      </option>
                    ))}
                  </select>
                </>
              )}

              <button className="btn sm block" disabled={bloq} onClick={() => executar(a)} style={{ marginTop: 10 }}>
                {ativoSel ? 'Confirmar' : 'Fazer isto'}
              </button>
            </Card>
          );
        })}
      </div>

      <Card title="Encerrar o mês">
        <p className="small dim">
          {emCampanha
            ? 'Avançar fecha o mês de campanha: adversários agem, sai nova pesquisa, e o relógio da eleição anda.'
            : 'Energia e pontos se renovam, renda entra, contas saem, e vínculos sem contato esfriam.'}
        </p>
        <button className="btn" disabled={!!s.eventoPendente} onClick={avancarMes}>Avançar o mês →</button>
      </Card>
    </div>
  );
}
