import { createRng, streamRng, clamp } from './rng';
import { nivelPorConfianca } from './tick';
import etapa1Def from '../content/actions/etapa1.json';
import campanhaDef from '../content/actions/campanha.json';
import politicaDef from '../content/actions/politica.json';
import mandatoDef from '../content/actions/mandato.json';
import prefeitoDef from '../content/actions/prefeito.json';
import deputadoDef from '../content/actions/deputado.json';
import midiaDef from '../content/actions/midia.json';
import vidaDef from '../content/actions/vida.json';
import contactsDef from '../content/contacts.json';
import neighborhoods from '../content/neighborhoods/recife.json';
import professionsDef from '../content/professions.json';
import { cultivarPolitico, tentarAlianca, limiarAlianca } from './world';
import { assumirEmprego, pedirAumento, freela } from './jobs';
import { fiscalizar, registrarPromessa, cumprirPromessas, temaCanonico, multGabinete } from './mandate';
import { janelaCandidatura } from './calendar';
import { cascatasAtivas, conterCascata } from './cascade';
import { captarDoacao } from './donors';
import { recrutarMilitancia } from './militancy';
import { cuidarDeSi } from './personal';
import { impactoDeTema, cortejarGrupo, GRUPOS_LISTA } from './electorate';
import { gravarPodcast } from './podcasts';
import { cultivarInfluenciador, colaborarInfluenciador } from './influencers';
import { ganharXp } from './attributes';

const FASES = ['VIDA', 'VIDA_PUBLICA', 'PARTIDO', 'CANDIDATO', 'MANDATO'];
const TODAS = [
  ...etapa1Def.acoes, ...campanhaDef.acoes, ...politicaDef.acoes,
  ...mandatoDef.acoes, ...prefeitoDef.acoes, ...deputadoDef.acoes, ...midiaDef.acoes,
  ...vidaDef.acoes,
];
// Etapa 6 — ações de mandato que valem para QUALQUER cargo eletivo
const MANDATO_COMPARTILHADAS = ['discurso_plenario', 'buscar_financiador', 'militancia_mandato', 'conter_repercussao',
  'visita_escola', 'visita_saude', 'reuniao_comunitaria', 'visita_tecnica', 'discurso_grupo'];
const AUTOCUIDADO = ['descansar', 'cuidar_de_si', 'treino_pratico'];

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
  // Item 18 — eventos que dependem de patrimônio (itens 16/17)
  if (r.temInstituicao && !(state.personagem.instituicoes || []).length) return false;
  if (r.temEmpresa && !(state.personagem.empresas || []).length) return false;
  if ((acao.custo.tempo || 0) > state.tempo.pontosRestantes) return false;
  return true;
}

// Leque de ações do mês (4–6), sorteado por peso. Determinístico por mês.
export function acoesDisponiveis(state) {
  const fase = state.personagem.fase;
  let base;
  if (fase === 'CANDIDATO') base = campanhaDef.acoes;
  else if (fase === 'MANDATO') {
    // Etapa 6 — cada cargo tem seu pool próprio + as ações de mandato compartilhadas
    const cargo = state.mandato?.cargo || 'VEREADOR';
    let cargoPool;
    if (cargo === 'PREFEITO') cargoPool = prefeitoDef.acoes;
    else if (cargo.startsWith('DEPUTADO')) cargoPool = deputadoDef.acoes;
    else cargoPool = mandatoDef.acoes; // VEREADOR
    // projetos e negociação de votos vivem na aba Mandato, não no leque
    cargoPool = cargoPool.filter((a) => !a.efeitos?.alvoProjeto && !a.efeitos?.alvoProjetoTramitando);
    const compart = mandatoDef.acoes.filter((a) => MANDATO_COMPARTILHADAS.includes(a.id)
      && !cargoPool.some((c) => c.id === a.id));
    base = [...cargoPool, ...compart];
  } else base = [...etapa1Def.acoes, ...politicaDef.acoes];
  // Fase 14/15 — mídia/influência entra em qualquer fase; Etapa 10/11 — autocuidado também
  // Nova expansão — família/lazer/viagens também entram sempre
  base = [...base, ...midiaDef.acoes, ...vidaDef.acoes];
  if (fase === 'CANDIDATO' || fase === 'MANDATO') {
    base = [...base, ...etapa1Def.acoes.filter((a) => AUTOCUIDADO.includes(a.id) && !base.some((b) => b.id === a.id))];
  }
  const pool = base.filter((a) => elegivel(a, state));
  const rng = streamRng(state.meta.seed, "menu", state.tempo.mes, fase);
  const escolhidas = [];
  const restante = [...pool];
  const catCount = {};
  const alvo = Math.min(restante.length, 6 + (rng.chance(0.5) ? 1 : 0));
  while (escolhidas.length < alvo && restante.length) {
    // Etapa 7 — o peso base é modulado pelo contexto (crise, promessa, eleição…)
    // Agenda — e por diversidade: 2ª ação da mesma categoria no leque pesa menos,
    // 3ª quase não entra, para o mês não virar "4 cards de mídia".
    const a = rng.weighted(restante, (x) => {
      const c = catCount[x.categoria] || 0;
      const spread = c === 0 ? 1 : c === 1 ? 0.4 : 0.12;
      return (x.peso ?? 1) * pesoContextual(x, state) * spread;
    });
    escolhidas.push(a);
    catCount[a.categoria] = (catCount[a.categoria] || 0) + 1;
    restante.splice(restante.indexOf(a), 1);
  }
  // Agenda — variação de fachada: uma ação com `variantes` aparece com um rótulo
  // diferente a cada mês (mesmo id/efeito). Puramente cosmético.
  return escolhidas.map((a) => {
    if (!a.variantes?.length) return a;
    const vr = streamRng(state.meta.seed, "variante", state.tempo.mes, a.id);
    const v = vr.pick(a.variantes);
    return { ...a, titulo: v.titulo || v, desc: v.desc || a.desc, tituloBase: a.titulo };
  });
}

// Etapa 7 — multiplicador de peso conforme a situação atual. Faz o leque
// "responder" ao momento sem criar dezenas de ações redundantes.
const DELIVERY_IDS = ['atender_demanda', 'obra_estruturante', 'emenda_parlamentar', 'trabalhar_base', 'agenda_regional', 'organizar_mutirao', 'visitar_bairro'];
const MIDIA_IDS = ['post_redes', 'carta_jornal', 'gravar_podcast', 'cuidar_imagem', 'reels_campanha', 'propaganda_digital', 'audiencia_publica', 'discurso_plenario'];
const NETWORK_IDS = ['networking_evento', 'cultivar_contato', 'reuniao_liderancas', 'conversar_politico', 'almoco_lideranca'];

export function pesoContextual(a, state) {
  const ef = a.efeitos || {};
  const rep = state.reputacao;
  let m = 1;

  // notoriedade baixa → aparecer vale mais
  if (rep.notoriedade < 15 && MIDIA_IDS.includes(a.id)) m *= 2.2;
  else if (rep.notoriedade < 30 && MIDIA_IDS.includes(a.id)) m *= 1.4;

  // cascata em curso → conter repercussão sobe muito
  if ((ef.conterCascata || a.id === 'gerir_crise_cidade') && cascatasAtivas(state).length) m *= 3.2;
  else if (ef.conterCascata) m *= 0.3; // sem cascata, quase não aparece

  // promessa aberta perto do prazo → entregas sobem
  const prom = state.mandato?.promessas || [];
  const vencendo = prom.some((p) => !p.cumprida && state.tempo.mes > p.prazo - 6);
  if (vencendo && (DELIVERY_IDS.includes(a.id) || ef.entregaLocal || ef.registrarPromessa)) m *= 1.9;

  // campanha com caixa curto → captação sobe
  if (state.personagem.fase === 'CANDIDATO') {
    if ((ef.captarDoacao || (a.custo?.campanhaGasto || 0) < 0) && state.financas.campanha < 10000) m *= 3;
  }

  // fim de mandato / eleição na área → rodar a base
  if ((state.mandato?.encerrando || state.eleicao) && (DELIVERY_IDS.includes(a.id) || ef.territorioBairroAlvo)) m *= 1.5;

  // rede rala → networking
  if (Object.keys(state.relacionamentos.pessoas).length < 3 && NETWORK_IDS.includes(a.id)) m *= 1.8;

  // energia/saúde no chão → descanso e autocuidado
  if ((state.tempo.energia < 35 || (state.personagem.vida?.saude ?? 100) < 40)
    && (a.id === 'descansar' || a.id === 'cuidar_de_si')) m *= 2.5;

  // Nova expansão — o leque reage a mais coisas do momento:
  const cat = a.categoria;

  // 1) proximidade de eleição: com uma eleição chegando, sobe campanha/entrega/mídia,
  //    e cai lazer/família (não é hora de sumir).
  let mesesAteEleicao = 99;
  if (state.personagem.partidoId && state.personagem.fase !== 'VIDA') {
    const tipo = state.mandato?.tipoPleito || 'MUNICIPAL';
    mesesAteEleicao = janelaCandidatura(state, tipo)?.mesesAteEleicao ?? 99;
  }
  if (mesesAteEleicao <= 14 && state.personagem.fase !== 'CANDIDATO') {
    if (cat === 'CAMPANHA' || DELIVERY_IDS.includes(a.id) || ef.entregaLocal || ef.territorioBairroAlvo) m *= 1.6;
    if (MIDIA_IDS.includes(a.id) || cat === 'MIDIA') m *= 1.25;
    if (cat === 'LAZER' || cat === 'FAMILIA' || cat === 'VIAGENS') m *= 0.4;
  }

  // 2) bem-estar / vida pessoal em baixa → família e lazer sobem
  const bem = state.personagem.vida?.bemEstar ?? 60;
  if (bem < 40 && (cat === 'FAMILIA' || cat === 'LAZER')) m *= 2.2;
  else if (bem < 55 && (cat === 'FAMILIA' || cat === 'LAZER')) m *= 1.4;
  const rel = state.personagem.vida?.conjuge?.relacao;
  if (rel != null && rel < 40 && (cat === 'FAMILIA' || a.id === 'fim_de_semana_familia')) m *= 1.8;

  // 3) sazonalidade: fim de ano → cerimônias/família/lazer; meio do ano → congressos
  const mesDoAno = state.tempo.mes % 12; // 0 = Jan
  if ((mesDoAno === 11 || mesDoAno === 0) && (cat === 'FAMILIA' || cat === 'LAZER' || a.id === 'cerimonia_oficial')) m *= 1.6;
  if ((mesDoAno >= 4 && mesDoAno <= 8) && (a.id === 'congresso_setorial' || a.id === 'evento_academico' || a.id === 'evento_nacional')) m *= 1.5;

  // 4) patamar de fama: quem já é grande recebe convite de evento maior;
  //    quem é pequeno raramente viaja pra fora.
  if (rep.notoriedade < 25 && cat === 'VIAGENS' && a.id !== 'viagem_brasilia') m *= 0.4;
  if (rep.notoriedade > 55 && (a.id === 'evento_nacional' || a.id === 'premiacao' || a.id === 'mesa_redonda' || a.id === 'participar_programa')) m *= 1.5;

  // 5) território fraco no mandato → ações de bairro sobem
  if (state.mandato) {
    const base = Object.values(state.territorio.porBairro || {}).filter((t) => t.presenca > 25).length;
    if (base < 2 && (ef.territorioBairroAlvo || DELIVERY_IDS.includes(a.id))) m *= 1.5;
  }

  // Agenda — anti-repetição: ação feita há pouco quase não reaparece
  const recentes = state.meta?.acoesRecentes || [];
  const ult = recentes.find((r) => r.id === a.id);
  if (ult) {
    const atras = state.tempo.mes - ult.mes;
    if (atras <= 1) m *= 0.1;
    else if (atras === 2) m *= 0.35;
    else if (atras <= 4) m *= 0.65;
  }
  // duas ações da mesma categoria seguidas também cansam
  const catRecente = recentes.slice(0, 2).map((r) => acaoPorId(r.id)?.categoria);
  if (a.categoria && catRecente.filter((c) => c === a.categoria).length === 2) m *= 0.55;

  return m;
}

// Etapa 7 — dica curta do porquê da ação aparecer agora (UI).
export function contextoAgenda(a, state) {
  const ef = a.efeitos || {};
  if ((ef.conterCascata || a.id === 'gerir_crise_cidade') && cascatasAtivas(state).length) {
    return 'uma repercussão negativa está crescendo agora';
  }
  if (state.reputacao.notoriedade < 15 && MIDIA_IDS.includes(a.id)) {
    return 'você ainda é pouco conhecido — hora de aparecer';
  }
  const prom = (state.mandato?.promessas || []).find((p) => !p.cumprida && state.tempo.mes > p.prazo - 6);
  if (prom && (DELIVERY_IDS.includes(a.id) || ef.entregaLocal)) {
    return 'há promessa perto de vencer';
  }
  if (state.personagem.fase === 'CANDIDATO' && (ef.captarDoacao || (a.custo?.campanhaGasto || 0) < 0) && state.financas.campanha < 10000) {
    return 'o caixa de campanha está no limite';
  }
  if ((state.tempo.energia < 35) && (a.id === 'descansar' || a.id === 'cuidar_de_si')) {
    return 'sua energia está baixa';
  }
  return null;
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

  // Etapa 10 — treino de atributo (XP, não +10 direto)
  treinarAtributo({ state, ef, opts, rng, resumo }) {
    const attr = opts.atributoId || ef.atributoAlvo || 'comunicacao';
    const faixa = Array.isArray(ef.treinarAtributo) ? ef.treinarAtributo : [20, 40];
    const r = ganharXp(state, attr, rng.rangeInt(faixa));
    resumo.push(r.subiu ? `${attr} +${r.subiu} (agora ${r.valor})` : `${attr}: progresso rumo ao próximo ponto`);
  },

  // Item 2 — curso pago: dinheiro + tempo compram pontos de atributo direto
  // (retornos decrescentes perto do teto). Não é a barra de XP das ações comuns.
  cursoAtributo({ state, ef, rng, resumo }) {
    const attr = ef.atributoAlvo || 'comunicacao';
    const atr = state.personagem.atributos;
    if (atr[attr] == null) atr[attr] = 45;
    const bruto = rng.range(Array.isArray(ef.cursoAtributo) ? ef.cursoAtributo : [1.5, 3]);
    const efetivo = bruto * clamp((88 - atr[attr]) / 42, 0.15, 1);
    atr[attr] = Math.round(clamp(atr[attr] + efetivo, 5, 88) * 10) / 10;
    resumo.push(`${attr} +${efetivo.toFixed(1)} (agora ${Math.round(atr[attr])})`);
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
    const gTer = multGabinete(state, 'territorio'); // Etapa 8 — assessor territorial
    for (const [k, faixa] of Object.entries(ef.territorioBairroAlvo)) {
      t[k] = clamp((t[k] ?? 0) + rng.range(faixa) * mult * gTer, 0, 100);
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
    // Etapa 8 — assessor territorial turbina a mobilização
    const extra = ganho * (multGabinete(state, 'territorio') - 1);
    if (extra > 0) state.personagem.militancia[bid] = (state.personagem.militancia[bid] || 0) + extra;
    const bnome = neighborhoods.bairros.find((b) => b.id === bid)?.nome || bid;
    resumo.push(`+${ganho} voluntários na ${bnome}`);
  },

  // Fase 22 — cuidar da saúde / vida pessoal
  cuidarDeSi({ state, rng, resumo }) { resumo.push(cuidarDeSi(state, rng)); },

  // Nova expansão — tempo de família / lazer: bem-estar (e relação com o cônjuge)
  bemEstar({ state, ef, rng, resumo }) {
    const v = (state.personagem.vida ||= { bemEstar: 60 });
    const g = rng.range(Array.isArray(ef.bemEstar) ? ef.bemEstar : [3, 7]);
    v.bemEstar = clamp((v.bemEstar ?? 60) + g, 0, 100);
    if (v.conjuge) v.conjuge.relacao = clamp((v.conjuge.relacao ?? 60) + rng.range([1, 4]), 0, 100);
    if (v.paisVivos && rng.chance(0.4)) v.paisRelacao = clamp((v.paisRelacao ?? 55) + rng.range([1, 3]), 0, 100);
    resumo.push(`bem-estar +${Math.round(g)}`);
  },

  // Nova expansão — viagem: rende contatos, mídia e (Brasília) articulação
  viagem({ state, ef, rng, mult, resumo }) {
    const tipo = ef.viagem || 'evento';
    const nContatos = tipo === 'brasilia' || tipo === 'nacional' ? rng.int(1, 2) : rng.chance(0.6) ? 1 : 0;
    for (let i = 0; i < nContatos; i++) {
      const id = `p_${state.tempo.mes}_${rng.int(1000, 9999)}`;
      state.relacionamentos.pessoas[id] = {
        id, nome: `${rng.pick(contactsDef.nomes.primeiros)} ${rng.pick(contactsDef.nomes.sobrenomes)}`,
        papel: tipo === 'brasilia' ? 'Contato em Brasília' : tipo === 'nacional' ? 'Articulador nacional' : 'Contato de fora',
        profissao: '—', ideologiaEixo: rng.int(-60, 60), influencia: rng.int(25, 80),
        confianca: rng.int(10, 24), nivel: 'CONHECIDO', ultimoContatoMes: state.tempo.mes, origem: 'viagem',
      };
    }
    state.reputacao.notoriedade = clamp(state.reputacao.notoriedade + rng.range([0.5, 2]) * mult, 0, 100);
    state.reputacao.ecoMidiatico = clamp(state.reputacao.ecoMidiatico + rng.range([1, 5]), -50, 100);
    if ((tipo === 'brasilia' || tipo === 'nacional') && state.personagem.partidoId) {
      const pr = state.mundo.partidosRuntime?.[state.personagem.partidoId];
      if (pr) pr.apoioAoJogador = clamp(pr.apoioAoJogador + rng.range([1, 4]), 0, 100);
    }
    if (state.personagem.vida) state.personagem.vida.bemEstar = clamp((state.personagem.vida.bemEstar ?? 60) + (tipo === 'lazer' ? rng.range([5, 12]) : rng.range([0, 3])), 0, 100);
    resumo.push(nContatos ? `viagem — ${nContatos} novo(s) contato(s)` : 'viagem concluída');
  },

  // Etapa 6 — recurso conquistado entra no caixa do gabinete
  gabineteBonus({ state, ef, rng, mult, resumo }) {
    const v = Math.round(rng.range(ef.gabineteBonus) * mult);
    state.financas.gabinete += v;
    resumo.push(`+${brl(v)} no orçamento do gabinete`);
  },

  // Fase 8 — um gesto público sobre um tema mexe com os grupos daquele tema
  satisfacaoTema({ state, ef, rng, resumo }) {
    impactoDeTema(state, ef.satisfacaoTema, rng.range([2, 5]));
    resumo.push('repercutiu com o público da pauta');
  },

  // Item 3 — encontro/discurso direcionado a um grupo social escolhido
  cortejarGrupo({ state, ef, opts, rng, mult, resumo }) {
    const gid = opts.grupoId || GRUPOS_LISTA[0].id;
    const faixa = Array.isArray(ef.cortejarGrupo) ? ef.cortejarGrupo : [3, 6];
    const forca = rng.range(faixa) * mult;
    cortejarGrupo(state, gid, forca);
    resumo.push(`aproximou-se de ${(GRUPOS_LISTA.find((g) => g.id === gid) || {}).nome || gid}`);
  },

  // Etapa 6 — entrega concreta num bairro (obra do prefeito, emenda do deputado).
  // Território + aprovação + satisfação da pauta local + PROGRIDE PROMESSAS.
  entregaLocal({ state, ef, opts, rng, mult, resumo }) {
    const bid = opts.bairroId || neighborhoods.bairros[0].id;
    const bairro = neighborhoods.bairros.find((b) => b.id === bid);
    const bnome = bairro?.nome || bid;
    const tema = temaCanonico((bairro?.problemas || ['assistencia'])[0]);
    const t = (state.territorio.porBairro[bid] ||= { presenca: 0, penetracao: 0 });
    const dP = rng.range(ef.entregaLocal?.presenca || [3, 7]) * mult * multGabinete(state, 'territorio');
    t.presenca = clamp(t.presenca + dP, 0, 100);
    t.penetracao = clamp(t.penetracao + dP * 0.6, 0, 100);
    state.reputacao.aprovacao = clamp(state.reputacao.aprovacao + rng.range(ef.entregaLocal?.aprovacao || [0.5, 2]) * mult, 0, 100);
    impactoDeTema(state, tema, rng.range([3, 7]) * mult);
    cumprirPromessas(state, { tema, bairroId: bid });
    if (state.mandato) state.mandato.indicadores.obrasEntregues = (state.mandato.indicadores.obrasEntregues || 0) + 1;
    resumo.push(`entrega em ${bnome} (${tema}) — presença +${Math.round(dP)}`);
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
    // Etapa 8 — assessoria jurídica/comunicação ajuda a cortar a bola de neve
    const bonusGab = (multGabinete(state, 'fiscalizacao') + multGabinete(state, 'redes')) / 2 - 1;
    const forca = 1 + (rng.chance(0.4 + (mult - 1) + bonusGab + (state.personagem.atributos.comunicacao - 50) / 200) ? 1 : 0);
    conterCascata(state, alvo.id, forca);
    state.reputacao.confianca = clamp(state.reputacao.confianca + rng.range([0, 2]) * mult, 0, 100);
    resumo.push(`você respondeu à repercussão "${alvo.rótulo}" e reduziu o estrago`);
  },
};

// ordem de aplicação (algumas chaves não são efeitos — ignoradas)
const ORDEM_EFEITOS = [
  'energia', 'reputacao', 'ecoMidiatico', 'viral', 'debate', 'seguidores',
  'skillsAleatoria', 'treinarAtributo', 'relacionamentosNovos', 'relacionamentosContato',
  'territorioBairroAlvo', 'cultivarPolitico', 'tentarAlianca', 'fiscalizar',
  'registrarPromessa', 'impulsoTemaProjetos', 'cobrarSecretaria', 'freela',
  'pedirAumento', 'trocarEmprego', 'apoioPartido', 'conterCascata',
  'captarDoacao', 'recrutarMilitancia', 'cuidarDeSi', 'satisfacaoTema',
  'gravarPodcast', 'cultivarInfluenciador', 'colaborarInfluenciador', 'entregaLocal', 'gabineteBonus',
  'cortejarGrupo', 'cursoAtributo', 'bemEstar', 'viagem',
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

  // Etapa 10 — "prática": toda ação que depende de um atributo o treina de leve
  if (ef.atributoPeso && !ef.treinarAtributo && (acao.custo.tempo || 0) >= 2) {
    ganharXp(state, ef.atributoPeso, rng.int(2, 6));
  }

  state.meta.rngState = rng.state;
  // Agenda — registra a ação para o anti-repetição do leque
  (state.meta.acoesRecentes ||= []).unshift({ id: acaoId, mes });
  state.meta.acoesRecentes = state.meta.acoesRecentes.slice(0, 10);
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
  return !!(ef.territorioBairroAlvo || ef.recrutarMilitancia || ef.entregaLocal);
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
export function precisaAtributo(acaoId) {
  return !!acaoPorId(acaoId)?.efeitos?.alvoAtributo;
}
export function precisaPodcast(acaoId) {
  return !!acaoPorId(acaoId)?.efeitos?.gravarPodcast;
}
export function precisaGrupo(acaoId) {
  return !!acaoPorId(acaoId)?.efeitos?.cortejarGrupo;
}
export function precisaInfluenciador(acaoId) {
  const ef = acaoPorId(acaoId)?.efeitos || {};
  return !!(ef.cultivarInfluenciador || ef.colaborarInfluenciador);
}
export function apenasAliancaNaoFeita(acaoId, state) {
  const ef = acaoPorId(acaoId)?.efeitos || {};
  return ef.tentarAlianca ? state.personagem.grupoPolitico : null;
}
