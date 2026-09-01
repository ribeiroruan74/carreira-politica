import { createRng, streamRng, clamp } from './rng';
import { JORNALISTAS, veiculo } from './press';
import { ganharXp } from './attributes';
import { ajustarSatisfacao, impactoDeTema, resumoSatisfacao } from './electorate';
import intDef from '../content/interviews.json';
import lawsDef from '../content/laws.json';
import partiesDef from '../content/parties.json';
import neighborhoods from '../content/neighborhoods/recife.json';

const nomeBairro = (id) => neighborhoods.bairros.find((b) => b.id === id)?.nome || id;
const nomeTema = (id) => lawsDef.temas.find((t) => t.id === id)?.nome || id;
const nomePartido = (id) => partiesDef.partidos.find((p) => p.id === id)?.nome || id;

// contextos ativos no estado atual → dados para preencher os placeholders.
// Também define `_alvos`: grupo/rival que a resposta pode afetar.
function contextos(state) {
  const c = {};
  const alvos = {};
  const prom = state.mandato?.promessas?.find((p) => !p.cumprida && state.tempo.mes - p.mesFeita > 6);
  if (prom) {
    c.promessa_furada = { meses: state.tempo.mes - prom.mesFeita, tema: nomeTema(prom.tema), bairro: nomeBairro(prom.bairroId) };
    alvos.promessa_furada = { temaId: prom.tema };
  }
  const ultimaCrise = state.log.find((l) => l.tipo === 'CRISE');
  if (ultimaCrise) c.crise_recente = { crise: ultimaCrise.texto.split(':')[0].toLowerCase() };
  if (state.financas.campanha > 60000 || state.financas.gabinete > 120000) c.caixa_alto = {};
  if (state.mandato?.posicao === 'BASE' || state.mandato?.posicao === 'OPOSICAO') {
    c.tem_posicao = { posicao: state.mandato.posicao === 'BASE' ? 'da base' : 'da oposição' };
  }
  const ataque = state.mundo.noticias?.find((n) => n.tipo === 'ATAQUE' && n.texto.includes('atacou você'));
  if (ataque) {
    const rivalNome = ataque.texto.split(' (')[0];
    const rival = Object.values(state.mundo.politicos || {}).find((p) => p.nome === rivalNome);
    c.ataque_rival = { rival: rivalNome };
    alvos.ataque_rival = { rivalId: rival?.id || null };
  }
  if (state.reputacao.rejeicao > 30) c.rejeicao_alta = {};

  // cargo em exercício
  if (state.mandato) {
    const exec = state.mandato.executivo;
    c.cargo = { cargo: state.mandato.cargoNome || 'parlamentar', escopo: exec ? 'do Executivo' : 'do Legislativo' };
  }
  // projeto recente (aprovado ou rejeitado)
  const proj = (state.mandato?.projetos || []).slice().reverse()
    .find((p) => p.status === 'APROVADO' || p.status === 'REJEITADO');
  if (proj) {
    c.projeto = { projeto: proj.titulo || proj.nome || 'seu projeto', desfecho: proj.status === 'APROVADO' ? 'aprovado' : 'rejeitado' };
    if (proj.tema) alvos.projeto = { temaId: proj.tema };
  }
  // adversário em ascensão (relação baixa + influência alta)
  const rivalForte = Object.values(state.mundo.politicos || {})
    .filter((p) => p.ativo && p.relacaoJogador < 12 && p.influencia > 58)
    .sort((a, b) => b.influencia - a.influencia)[0];
  if (rivalForte) {
    c.adversario = { rival: rivalForte.nome, partido: rivalForte.partidoId };
    alvos.adversario = { rivalId: rivalForte.id };
  }
  // histórico partidário (item 1): já trocou de sigla
  const hist = state.personagem.partidoHistorico || [];
  if (hist.length >= 2) {
    const anterior = hist[hist.length - 2];
    c.trocou_partido = { n: hist.length, anterior: anterior?.partidoId || '—', atual: nomePartido(state.personagem.partidoId) };
  }
  // grupo social irritado (item 3)
  const pior = resumoSatisfacao(state)[0];
  if (pior && pior.valor <= -28) {
    c.grupo_contra = { grupo: pior.nome };
    alvos.grupo_contra = { grupoId: pior.id };
  }
  // acontecimento em destaque
  const quente = (state.mundo.noticias || []).find((n) => n.destaque && n.tipo !== 'MIDIA' && !n.texto.includes(state.personagem.nome));
  if (quente) c.noticia = { assunto: quente.texto.replace(/\.$/, '').toLowerCase() };

  c.generico = {};
  return { c, alvos };
}

function preencher(texto, dados) {
  return texto.replace(/\{(\w+)\}/g, (_, k) => dados?.[k] ?? '—');
}

// Monta a entrevista: EXATAMENTE 3 perguntas, priorizando o que é quente no estado.
export function montarEntrevista(state, jornalistaId) {
  const j = JORNALISTAS.find((x) => x.id === jornalistaId) || JORNALISTAS[0];
  const v = veiculo(j.veiculo);
  const rng = streamRng(state.meta.seed, 'entrevista', jornalistaId, state.tempo.mes);
  const { c: ctx, alvos } = contextos(state);
  const N = 3;

  const especificas = intDef.perguntas.filter((p) => p.contexto !== 'generico' && ctx[p.contexto]);
  const genericas = intDef.perguntas.filter((p) => p.contexto === 'generico');

  const escolhidas = [];
  const rest = [...especificas];
  while (escolhidas.length < N && rest.length) {
    const p = rng.weighted(rest, (x) => x.peso ?? 1);
    escolhidas.push(p);
    rest.splice(rest.indexOf(p), 1);
  }
  for (const g of rng.shuffle(genericas)) {
    if (escolhidas.length >= N) break;
    if (!escolhidas.includes(g)) escolhidas.push(g);
  }

  const perguntas = escolhidas.slice(0, N).map((p) => ({
    id: p.id,
    contexto: p.contexto,
    texto: preencher(p.texto, ctx[p.contexto]),
    tons: p.tons.map((t) => ({ id: t.id, texto: t.texto, score: t.score, rep: t.rep, grupo: t.grupo, grupoAuto: t.grupoAuto, rival: t.rival })),
  }));

  return {
    jornalistaId: j.id,
    jornalistaNome: j.nome,
    veiculoNome: v?.nome || 'imprensa',
    rigor: j.rigor,
    abertura: rng.pick(intDef.aberturas),
    perguntas,
    alvos, // { contexto: { grupoId|rivalId|temaId } }
    idx: 0,
    score: 0,
    respostas: [],
  };
}

// Aplica a resposta a uma pergunta. Muta state.entrevistaAtiva + reputação.
export function responderPergunta(state, tomIdx) {
  const e = state.entrevistaAtiva;
  if (!e) return null;
  const p = e.perguntas[e.idx];
  const tom = p?.tons[tomIdx];
  if (!tom) throw new Error('Resposta inválida.');

  const rng = createRng(state.meta.seed, state.meta.rngState);
  const preparo = (state.personagem.atributos.comunicacao + state.personagem.atributos.oratoria
    + state.personagem.atributos.inteligencia) / 3;
  // jornalista rigoroso amplifica respostas ruins; preparo suaviza
  const fatorRigor = 1 + (e.rigor - 55) / 120;
  const fatorPreparo = 1 - (preparo - 50) / 200;

  for (const [k, faixa] of Object.entries(tom.rep || {})) {
    let d = rng.range(faixa);
    if (d < 0) d *= fatorPreparo; // preparo reduz o dano
    if (d > 0 && tom.score < 0) d *= fatorRigor; // rigor piora respostas ruins
    d = Math.round(d * 10) / 10;
    const min = k === 'ecoMidiatico' ? -50 : 0;
    state.reputacao[k] = clamp((state.reputacao[k] ?? 0) + d, min, 100);
  }
  // item 6 — a resposta também mexe com grupos sociais e com relações
  const alvo = e.alvos?.[p.contexto] || {};
  const sinal = tom.score >= 0 ? 1 : -1;
  const gid = tom.grupo || (tom.grupoAuto && alvo.grupoId) || null;
  if (gid) ajustarSatisfacao(state, gid, rng.range([2, 6]) * sinal);
  if (alvo.temaId && (tom.grupoAuto || tom.grupo)) impactoDeTema(state, alvo.temaId, rng.range([2, 5]) * sinal);
  if (typeof tom.rival === 'number' && alvo.rivalId && state.mundo.politicos[alvo.rivalId]) {
    const pol = state.mundo.politicos[alvo.rivalId];
    pol.relacaoJogador = clamp(pol.relacaoJogador + tom.rival, -100, 100);
  }

  e.score += tom.score * (tom.score < 0 ? fatorRigor : 1);
  e.respostas.push({ pergunta: p.id, tom: tom.id });
  e.idx += 1;

  state.meta.rngState = rng.state;
  if (e.idx >= e.perguntas.length) return finalizarEntrevista(state);
  return { fim: false };
}

function finalizarEntrevista(state) {
  const e = state.entrevistaAtiva;
  const rng = createRng(state.meta.seed, state.meta.rngState);
  const v = veiculo(JORNALISTAS.find((j) => j.id === e.jornalistaId)?.veiculo);
  const alcance = (v?.alcance ?? 50) / 100;
  const scoreMedio = e.score / Math.max(1, e.perguntas.length);
  // Etapa 10 — entrevista treina comunicação e oratória (mais se foi bem)
  const xp = scoreMedio > 0.2 ? rng.int(14, 24) : rng.int(6, 12);
  ganharXp(state, 'comunicacao', xp);
  ganharXp(state, 'oratoria', Math.round(xp * 0.7));
  let manchete; let resumo;

  if (scoreMedio > 0.55) {
    const noto = rng.range([3, 7]) * (0.6 + alcance);
    state.reputacao.notoriedade = clamp(state.reputacao.notoriedade + noto, 0, 100);
    state.reputacao.aprovacao = clamp(state.reputacao.aprovacao + rng.range([1, 4]), 0, 100);
    state.reputacao.ecoMidiatico = clamp(state.reputacao.ecoMidiatico + rng.range([3, 8]) * alcance, -50, 100);
    manchete = `Entrevista de ${state.personagem.nome} n${v?.tipo === 'tv' ? 'a' : 'o'} ${v?.nome} repercute bem`;
    resumo = 'Você foi bem — segurou as perguntas difíceis e passou a mensagem.';
  } else if (scoreMedio < -0.35) {
    state.reputacao.rejeicao = clamp(state.reputacao.rejeicao + rng.range([3, 8]) * (0.6 + alcance), 0, 100);
    state.reputacao.ecoMidiatico = clamp(state.reputacao.ecoMidiatico + rng.range([3, 8]) * alcance, -50, 100);
    manchete = `${e.jornalistaNome} encurrala ${state.personagem.nome} em entrevista`;
    resumo = 'Saiu mal. Um corte ruim já está circulando.';
  } else {
    state.reputacao.notoriedade = clamp(state.reputacao.notoriedade + rng.range([1, 3]), 0, 100);
    manchete = `${state.personagem.nome} concede entrevista ${v?.nome ? `à ${v.nome}` : ''}`;
    resumo = 'Entrevista morna, sem grandes ganhos nem perdas.';
  }

  state.mundo.noticias.unshift({ id: `nt_ent_${state.tempo.mes}_${e.jornalistaId}`, mes: state.tempo.mes, tipo: 'MIDIA', destaque: true, atores: [], texto: manchete + '.' });
  state.log.unshift({ mes: state.tempo.mes, tipo: 'ACAO', texto: `Entrevista com ${e.jornalistaNome} (${e.veiculoNome}) — ${resumo}` });
  state.meta.rngState = rng.state;
  const resultado = { fim: true, manchete, resumo, scoreMedio: +scoreMedio.toFixed(2) };
  state.entrevistaAtiva.concluida = resultado;
  return resultado;
}
