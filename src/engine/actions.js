import { createRng, streamRng, clamp } from './rng';
import { nivelPorConfianca } from './tick';
import etapa1Def from '../content/actions/etapa1.json';
import campanhaDef from '../content/actions/campanha.json';
import politicaDef from '../content/actions/politica.json';
import mandatoDef from '../content/actions/mandato.json';
import midiaDef from '../content/actions/midia.json';
import contactsDef from '../content/contacts.json';
import neighborhoods from '../content/neighborhoods/recife.json';
import professionsDef from '../content/professions.json';
import { cultivarPolitico, tentarAlianca, limiarAlianca } from './world';
import { assumirEmprego, pedirAumento, freela } from './jobs';
import { fiscalizar, registrarPromessa } from './mandate';
import { cascatasAtivas, conterCascata } from './cascade';
import { captarDoacao } from './donors';
import { recrutarMilitancia } from './militancy';
import { cuidarDeSi } from './personal';
import { impactoDeTema } from './electorate';
import { gravarPodcast } from './podcasts';
import { cultivarInfluenciador, colaborarInfluenciador } from './influencers';

const FASES = ['VIDA', 'VIDA_PUBLICA', 'PARTIDO', 'CANDIDATO', 'MANDATO'];
const TODAS = [...etapa1Def.acoes, ...campanhaDef.acoes, ...politicaDef.acoes, ...mandatoDef.acoes, ...midiaDef.acoes];

export function acaoPorId(id) {
  return TODAS.find((a) => a.id === id);
}

function nome(rng) {
  return `${rng.pick(contactsDef.nomes.primeiros)} ${rng.pick(contactsDef.nomes.sobrenomes)}`;
}

function elegivel(acao, state) {
  const r = acao.requisitos || {};
  if (r.faseMin && FASES.indexOf(state.personagem.fase) < FASES.indexOf(r.faseMin)) return false;
  if (r.temContato && Object.keys(state.relacionamentos.pessoas).length === 0) return false;
  if (r.temEmprego && !state.personagem.emprego) return false;
  if (r.temCascata && !(state.mundo?.cascatas || []).some((c) => !c.encerrada)) return false;
  if (r.temProjetoTramitando && !(state.mandato?.projetos || []).some((p) => p.status === 'TRAMITANDO')) return false;
  if ((acao.custo.tempo || 0) > state.tempo.pontosRestantes) return false;
  return true;
}

// Leque de ações do mês (4–6), sorteado por peso. Determinístico por mês.
export function acoesDisponiveis(state) {
  const fase = state.personagem.fase;
  let base;
  if (fase === 'CANDIDATO') base = campanhaDef.acoes;
  else if (fase === 'MANDATO') {
    // projetos e negociação de votos vivem na aba Mandato, não no leque
    base = mandatoDef.acoes.filter((a) => !a.efeitos?.alvoProjeto && !a.efeitos?.alvoProjetoTramitando);
  } else base = [...etapa1Def.acoes, ...politicaDef.acoes];
  // Fase 14/15 — ações de mídia/influência entram em qualquer fase
  base = [...base, ...midiaDef.acoes];
  const pool = base.filter((a) => elegivel(a, state));
  const rng = streamRng(state.meta.seed, "menu", state.tempo.mes, fase);
  const escolhidas = [];
  const restante = [...pool];
  const alvo = Math.min(restante.length, 5 + (rng.chance(0.4) ? 1 : 0));
  while (escolhidas.length < alvo && restante.length) {
    const a = rng.weighted(restante, (x) => x.peso ?? 1);
    escolhidas.push(a);
    restante.splice(restante.indexOf(a), 1);
  }
  return escolhidas;
}

function bonusAtributo(state, chave) {
  if (!chave) return 1;
  const v = state.personagem.atributos[chave] ?? 50;
  return 0.6 + (v / 100) * 0.9;
}

// --- P3: registry de handlers de efeito -------------------------------------
// ctx = { state, ef, opts, rng, mult, mes, resumo, acao, alvoPolId }
const EFEITOS = {
  energia({ state, ef, rng, resumo }) {
    const g = rng.rangeInt(ef.energia);
    state.tempo.energia = clamp(state.tempo.energia + g, 0, state.tempo.energiaMax);
    resumo.push(`energia +${g}`);
  },

  reputacao({ state, ef, rng, mult, resumo }) {
    for (const [k, faixa] of Object.entries(ef.reputacao)) {
      let d = rng.range(faixa);
      if (k === 'notoriedade' || k === 'aprovacao' || k === 'confianca') d *= mult;
      d = Math.round(d * 10) / 10;
      const min = k === 'ecoMidiatico' ? -50 : 0;
      state.reputacao[k] = clamp((state.reputacao[k] ?? 0) + d, min, 100);
      if (Math.abs(d) >= 0.5) resumo.push(`${k} ${d > 0 ? '+' : ''}${d}`);
    }
  },

  ecoMidiatico({ state, ef, rng, mult, resumo }) {
    const d = Math.round(rng.range(ef.ecoMidiatico) * mult * 10) / 10;
    state.reputacao.ecoMidiatico = clamp(state.reputacao.ecoMidiatico + d, -50, 100);
    resumo.push(`repercussão +${d}`);
  },

  viral({ state, rng, mult, resumo }) { resumo.push(resolverViral(state, rng, mult)); },
  debate({ state, rng, mult, resumo }) { resumo.push(resolverDebate(state, rng, mult)); },

  seguidores({ state, ef, rng, mult, resumo }) {
    if (!ef.seguidores?.pct) return;
    const pct = rng.range(ef.seguidores.pct) * mult;
    const d = Math.round(state.redes.seguidores * pct + rng.int(-20, 60));
    state.redes.seguidores = Math.max(0, state.redes.seguidores + d);
    resumo.push(`seguidores ${d >= 0 ? '+' : ''}${d}`);
  },

  skillsAleatoria({ state, ef, rng, resumo }) {
    const profSkills = Object.keys(professionsDef.profissoes.find((p) => p.id === state.personagem.profissaoId)?.skills || {});
    const cands = profSkills.length ? profSkills : ['comunicacao', 'mobilizacao', 'gestao'];
    const skill = rng.pick(cands);
    const g = rng.rangeInt(ef.skillsAleatoria);
    state.personagem.skills[skill] = clamp((state.personagem.skills[skill] ?? 0) + g, 0, 100);
    resumo.push(`${skill} +${g}`);
  },

  relacionamentosNovos({ state, ef, rng, mult, mes, acao, resumo }) {
    const papeis = ['Empresário local', 'Jornalista', 'Vereador em exercício', 'Presidente de associação', 'Líder religioso', 'Dirigente sindical', 'Assessor parlamentar', 'Influenciador local', 'Servidor graduado', 'Advogado'];
    for (let i = 0; i < ef.relacionamentosNovos; i++) {
      const id = `p_${mes}_${rng.int(1000, 9999)}`;
      state.relacionamentos.pessoas[id] = {
        id, nome: nome(rng), papel: rng.pick(papeis), profissao: '—',
        ideologiaEixo: rng.int(-60, 60), influencia: rng.int(15, 70),
        confianca: rng.int(8, 22) + Math.round((mult - 1) * 15),
        nivel: 'CONHECIDO', ultimoContatoMes: mes, origem: acao.titulo,
      };
      resumo.push('novo contato');
    }
  },

  relacionamentosContato({ state, opts, rng, mult, mes, resumo }) {
    const alvos = opts.pessoaId
      ? [state.relacionamentos.pessoas[opts.pessoaId]].filter(Boolean)
      : Object.values(state.relacionamentos.pessoas).sort((a, b) => a.confianca - b.confianca).slice(0, 1);
    for (const p of alvos) {
      const g = Math.round(rng.rangeInt([4, 9]) * mult);
      p.confianca = clamp(p.confianca + g, 0, 100);
      p.ultimoContatoMes = mes;
      p.nivel = nivelPorConfianca(p.confianca);
      resumo.push(`${p.nome}: confiança +${g}`);
    }
  },

  territorioBairroAlvo({ state, ef, opts, rng, mult, resumo }) {
    const bid = opts.bairroId || neighborhoods.bairros[0].id;
    const t = state.territorio.porBairro[bid] || { presenca: 0, penetracao: 0 };
    for (const [k, faixa] of Object.entries(ef.territorioBairroAlvo)) {
      t[k] = clamp((t[k] ?? 0) + rng.range(faixa) * mult, 0, 100);
    }
    state.territorio.porBairro[bid] = t;
    const bnome = neighborhoods.bairros.find((b) => b.id === bid)?.nome || bid;
    resumo.push(`${bnome}: presença ${Math.round(t.presenca)}`);
  },

  cultivarPolitico({ state, ef, rng, mult, alvoPolId, resumo }) {
    const g = rng.range(ef.cultivarPolitico) * mult;
    const p = cultivarPolitico(state, alvoPolId, g);
    resumo.push(`${p.nome}: relação ${p.relacaoJogador >= 0 ? '+' : ''}${Math.round(p.relacaoJogador)}`);
  },

  tentarAlianca({ state, alvoPolId, resumo }) {
    resumo.push(tentarAlianca(state, alvoPolId).msg);
  },

  fiscalizar({ state, rng, resumo }) { resumo.push(fiscalizar(state, rng).texto); },

  registrarPromessa({ state, opts, resumo }) {
    const bid = opts.bairroId;
    const bairro = neighborhoods.bairros.find((b) => b.id === bid);
    const problema = bairro?.problemas?.[0] || 'assistencia';
    registrarPromessa(state, { tema: problema, bairroId: bid });
    resumo.push(`promessa registrada: ${problema} na ${bairro?.nome || 'cidade'}`);
  },

  impulsoTemaProjetos({ state, rng, mult, resumo }) {
    if (!state.mandato) return;
    let n = 0;
    for (const pj of state.mandato.projetos) {
      if (pj.status === 'TRAMITANDO') { pj.apoio = clamp(pj.apoio + rng.range([1, 4]) * mult, 0, 98); n++; }
    }
    if (n) resumo.push(`apoio a ${n} projeto(s) subiu`);
  },

  cobrarSecretaria({ state, rng, resumo }) {
    if (!state.mandato) return;
    const ok = rng.chance(0.5 + (state.personagem.atributos.influencia - 50) / 200);
    if (ok) {
      for (const pj of state.mandato.projetos) {
        if (pj.status === 'TRAMITANDO' && !pj.precisaMaioria) pj.apoio = clamp(pj.apoio + 15, 0, 98);
      }
      state.reputacao.aprovacao = clamp(state.reputacao.aprovacao + rng.range([0.5, 2]), 0, 100);
      state.mandato.relacaoPrefeitura = clamp(state.mandato.relacaoPrefeitura + rng.int(1, 5), -100, 100);
      resumo.push('a secretaria se comprometeu a agilizar');
    } else {
      state.mandato.relacaoPrefeitura = clamp(state.mandato.relacaoPrefeitura - rng.int(2, 8), -100, 100);
      resumo.push('a secretaria empurrou com a barriga');
    }
  },

  freela({ state, rng, resumo }) { resumo.push(`+${brl(freela(state, rng))} na conta`); },

  // Fase 17 — captação com origem rastreada
  captarDoacao({ state, ef, rng, resumo }) {
    const base = typeof ef.captarDoacao === 'number' ? ef.captarDoacao : 30000;
    const { doador, valor, setor } = captarDoacao(state, rng, base);
    resumo.push(`+${brl(valor)} de ${doador.nome} (${setor?.nome || 'setor privado'})`);
  },

  // Fase 23 — formar/reforçar núcleo de militância num bairro
  recrutarMilitancia({ state, opts, rng, resumo }) {
    const { bid, ganho } = recrutarMilitancia(state, rng, opts.bairroId);
    if (!bid) { resumo.push('sem base para organizar militância ainda'); return; }
    const bnome = neighborhoods.bairros.find((b) => b.id === bid)?.nome || bid;
    resumo.push(`+${ganho} voluntários na ${bnome}`);
  },

  // Fase 22 — cuidar da saúde / vida pessoal
  cuidarDeSi({ state, rng, resumo }) { resumo.push(cuidarDeSi(state, rng)); },

  // Fase 8 — um gesto público sobre um tema mexe com os grupos daquele tema
  satisfacaoTema({ state, ef, rng, resumo }) {
    impactoDeTema(state, ef.satisfacaoTema, rng.range([2, 5]));
    resumo.push('repercutiu com o público da pauta');
  },

  // Fase 14 — gravar um podcast (o custo de tempo/energia já foi debitado;
  // gravarPodcast NÃO deve debitar de novo)
  gravarPodcast({ state, opts, resumo }) {
    if (!opts.podcastId) { resumo.push('nenhum podcast escolhido'); return; }
    const r = gravarPodcast(state, opts.podcastId, opts.posturaId || 'tecnica', { cobrarCusto: false });
    resumo.push(r.resumo.join(', '));
  },

  // Fase 15 — cultivar / colaborar com um influenciador
  cultivarInfluenciador({ state, opts, rng, resumo }) {
    if (!opts.influenciadorId) { resumo.push('nenhum influenciador escolhido'); return; }
    const r = cultivarInfluenciador(state, opts.influenciadorId, rng);
    resumo.push(`${r.nome}: relação ${r.relacao >= 0 ? '+' : ''}${r.relacao}`);
  },
  colaborarInfluenciador({ state, opts, rng, resumo }) {
    if (!opts.influenciadorId) { resumo.push('nenhum influenciador escolhido'); return; }
    const r = colaborarInfluenciador(state, opts.influenciadorId, rng);
    resumo.push(r.resumo);
  },
  pedirAumento({ state, rng, resumo }) { resumo.push(pedirAumento(state, rng).msg); },

  trocarEmprego({ state, opts, rng, resumo }) {
    resumo.push(`novo emprego: ${brl(assumirEmprego(state, opts.empregoId, rng))}/mês`);
  },

  apoioPartido({ state, ef, rng, mult, resumo }) {
    if (!state.personagem.partidoId) return;
    const pr = state.mundo.partidosRuntime[state.personagem.partidoId];
    if (!pr) return;
    const g = Math.round(rng.range(ef.apoioPartido) * mult * 10) / 10;
    pr.apoioAoJogador = clamp(pr.apoioAoJogador + g, 0, 100);
    resumo.push(`apoio interno +${g}`);
  },

  // Fase 12 — responder a uma repercussão em curso e conter o estrago
  conterCascata({ state, rng, mult, resumo }) {
    const ativas = cascatasAtivas(state).sort((a, b) => b.estagio - a.estagio);
    if (!ativas.length) { resumo.push('não havia repercussão ativa para conter'); return; }
    const alvo = ativas[0];
    const forca = 1 + (rng.chance(0.4 + (mult - 1) + (state.personagem.atributos.comunicacao - 50) / 200) ? 1 : 0);
    conterCascata(state, alvo.id, forca);
    state.reputacao.confianca = clamp(state.reputacao.confianca + rng.range([0, 2]) * mult, 0, 100);
    resumo.push(`você respondeu à repercussão "${alvo.rótulo}" e reduziu o estrago`);
  },
};

// ordem de aplicação (algumas chaves não são efeitos — ignoradas)
const ORDEM_EFEITOS = [
  'energia', 'reputacao', 'ecoMidiatico', 'viral', 'debate', 'seguidores',
  'skillsAleatoria', 'relacionamentosNovos', 'relacionamentosContato',
  'territorioBairroAlvo', 'cultivarPolitico', 'tentarAlianca', 'fiscalizar',
  'registrarPromessa', 'impulsoTemaProjetos', 'cobrarSecretaria', 'freela',
  'pedirAumento', 'trocarEmprego', 'apoioPartido', 'conterCascata',
  'captarDoacao', 'recrutarMilitancia', 'cuidarDeSi', 'satisfacaoTema',
  'gravarPodcast', 'cultivarInfluenciador', 'colaborarInfluenciador',
];

// permite a outros módulos (Bloco B) registrarem novos efeitos sem editar este arquivo
export function registrarEfeito(chave, handler, { antesDe } = {}) {
  EFEITOS[chave] = handler;
  const at = antesDe ? ORDEM_EFEITOS.indexOf(antesDe) : -1;
  if (at >= 0) ORDEM_EFEITOS.splice(at, 0, chave);
  else ORDEM_EFEITOS.push(chave);
}

export function aplicarAcao(state, acaoId, opts = {}) {
  const acao = acaoPorId(acaoId);
  if (!acao) throw new Error('Ação inexistente.');
  if (!elegivel(acao, state)) throw new Error('Ação indisponível agora.');
  if ((acao.custo.dinheiroPessoal || 0) > state.financas.pessoal) throw new Error('Dinheiro pessoal insuficiente.');
  if ((acao.custo.campanhaGasto || 0) > state.financas.campanha) throw new Error('Caixa de campanha insuficiente.');
  if ((acao.custo.gabineteGasto || 0) > state.financas.gabinete) throw new Error('Verba de gabinete insuficiente.');

  const ef = acao.efeitos || {};
  const alvoPolId = ef.cultivarPoliticoFixo || opts.politicoId;
  if ((ef.cultivarPolitico || ef.tentarAlianca) && !alvoPolId) throw new Error('Escolha um político.');
  if (ef.tentarAlianca) {
    const alvo = state.mundo.politicos[alvoPolId];
    if (alvo && alvo.relacaoJogador < limiarAlianca(alvo)) {
      throw new Error(`${alvo.nome} ainda não confia o suficiente (relação ${Math.round(alvo.relacaoJogador)}/${limiarAlianca(alvo)}). Cultive antes.`);
    }
  }
  if (ef.trocarEmprego && !opts.empregoId) throw new Error('Escolha uma vaga.');

  const rng = createRng(state.meta.seed, state.meta.rngState);
  const mult = bonusAtributo(state, ef.atributoPeso);
  const mes = state.tempo.mes;
  const resumo = [];

  // custos
  state.tempo.pontosRestantes -= acao.custo.tempo || 0;
  state.tempo.energia = clamp(state.tempo.energia - (acao.custo.energia || 0), 0, state.tempo.energiaMax);
  state.financas.pessoal -= acao.custo.dinheiroPessoal || 0;
  if (acao.custo.campanhaGasto) {
    state.financas.campanha -= acao.custo.campanhaGasto;
    if (acao.custo.campanhaGasto < 0) resumo.push(`caixa de campanha +${brl(-acao.custo.campanhaGasto)}`);
  }
  if (acao.custo.gabineteGasto) state.financas.gabinete -= acao.custo.gabineteGasto;

  // P3 — cada chave de `efeitos` tem um handler registrado. Adicionar um efeito
  // novo = adicionar uma entrada em EFEITOS, sem tocar neste loop.
  const ctx = { state, ef, opts, rng, mult, mes, resumo, acao, alvoPolId };
  for (const chave of ORDEM_EFEITOS) {
    if (ef[chave] === undefined) continue;
    EFEITOS[chave](ctx);
  }

  state.meta.rngState = rng.state;
  state.log.unshift({ mes, tipo: 'ACAO', texto: `${acao.titulo} — ${resumo.join(', ') || 'concluído'}.` });
  state.log = state.log.slice(0, 200);
  return resumo;
}

function resolverViral(state, rng, mult) {
  // distribuição de cauda longa: a maioria não pega, alguns explodem
  const roll = rng.float() * mult;
  let views;
  if (roll < 0.45) views = rng.int(300, 4000);
  else if (roll < 0.8) views = rng.int(4000, 30000);
  else if (roll < 0.94) views = rng.int(30000, 200000);
  else if (roll < 0.99) views = rng.int(200000, 1200000);
  else views = rng.int(1200000, 5000000);

  const polemico = rng.chance(0.35);
  const escala = Math.log10(views) - 2.5; // ~0 a ~4
  state.reputacao.notoriedade = clamp(state.reputacao.notoriedade + escala * 2.2, 0, 100);
  state.reputacao.ecoMidiatico = clamp(state.reputacao.ecoMidiatico + escala * 3, -50, 100);
  const dSeg = Math.round(views * rng.range([0.002, 0.02]));
  state.redes.seguidores += dSeg;
  if (polemico) {
    state.reputacao.rejeicao = clamp(state.reputacao.rejeicao + escala * 1.6, 0, 100);
    return `Reels: ${fmtViews(views)} views (polêmico) — notoriedade e rejeição sobem, +${dSeg} seguidores`;
  }
  state.reputacao.aprovacao = clamp(state.reputacao.aprovacao + escala * 0.4, 0, 100);
  return `Reels: ${fmtViews(views)} views — +${dSeg} seguidores, repercussão positiva`;
}

function resolverDebate(state, rng, mult) {
  const desempenho = rng.gauss(0.5, 0.22) * mult
    + (state.personagem.atributos.oratoria - 50) / 200
    + (state.personagem.atributos.improviso - 50) / 200;
  if (desempenho > 0.75) {
    state.reputacao.notoriedade = clamp(state.reputacao.notoriedade + rng.range([3, 7]), 0, 100);
    state.reputacao.aprovacao = clamp(state.reputacao.aprovacao + rng.range([1, 4]), 0, 100);
    state.reputacao.ecoMidiatico = clamp(state.reputacao.ecoMidiatico + rng.range([3, 8]), -50, 100);
    return 'Debate: você dominou — notoriedade e aprovação sobem';
  }
  if (desempenho < 0.35) {
    state.reputacao.rejeicao = clamp(state.reputacao.rejeicao + rng.range([2, 6]), 0, 100);
    state.reputacao.ecoMidiatico = clamp(state.reputacao.ecoMidiatico + rng.range([1, 4]), -50, 100);
    return 'Debate: saiu mal — um corte ruim viraliza, rejeição sobe';
  }
  state.reputacao.notoriedade = clamp(state.reputacao.notoriedade + rng.range([1, 3]), 0, 100);
  return 'Debate: desempenho morno, sem grandes ganhos';
}

function fmtViews(v) {
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}mi`;
  if (v >= 1e3) return `${Math.round(v / 1e3)} mil`;
  return `${v}`;
}
function brl(v) { return `R$ ${Math.round(v).toLocaleString('pt-BR')}`; }

export function precisaBairro(acaoId) {
  const ef = acaoPorId(acaoId)?.efeitos || {};
  return !!(ef.territorioBairroAlvo || ef.recrutarMilitancia);
}
export function precisaPessoa(acaoId) {
  const a = acaoPorId(acaoId);
  return a?.efeitos?.relacionamentosContato && !a?.efeitos?.relacionamentosNovos;
}
export function precisaPolitico(acaoId) {
  const ef = acaoPorId(acaoId)?.efeitos || {};
  return (ef.cultivarPolitico || ef.tentarAlianca) && !ef.cultivarPoliticoFixo;
}
export function precisaEmprego(acaoId) {
  return !!acaoPorId(acaoId)?.efeitos?.alvoEmprego;
}
export function precisaPodcast(acaoId) {
  return !!acaoPorId(acaoId)?.efeitos?.gravarPodcast;
}
export function precisaInfluenciador(acaoId) {
  const ef = acaoPorId(acaoId)?.efeitos || {};
  return !!(ef.cultivarInfluenciador || ef.colaborarInfluenciador);
}
export function apenasAliancaNaoFeita(acaoId, state) {
  const ef = acaoPorId(acaoId)?.efeitos || {};
  return ef.tentarAlianca ? state.personagem.grupoPolitico : null;
}
