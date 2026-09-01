// Harness de simulação em lote — joga partidas inteiras com um "jogador-IA"
// para medir e calibrar a dificuldade. NÃO usa React/store: replica o pipeline
// de store.avancarMes e store.aplicar em funções puras.

import { novoJogo } from '../state/newGame.js';
import { runMonth } from './runMonth';
import { resolverEvento } from './events';
import { aplicarAcao, acoesDisponiveis } from './actions';
import { objetivoDaFase, aplicarObjetivo } from './career';
import { protocolarProjeto, negociarVotosProjeto, contratarAssessor, candidatosAssessor } from './mandate';
import { janelaCandidatura } from './calendar';
import { streamRng } from './rng';
import parties from '../content/parties.json';

// mesmo pipeline mensal do store (muta `s`).
function avancarMes(s) {
  if (s.eventoPendente) return s;
  runMonth(s);
  return s;
}

function aplicar(state, fn) {
  // clona antes de mutar: se a ação lançar no meio, o estado fica intacto
  const s = structuredClone(state);
  try { fn(s); return s; } catch { return state; }
}

// --- estratégia do jogador-IA ---
function escolherPartido(state, perfil) {
  // pega o partido mais forte no Recife dentro de uma faixa ideológica
  const alvo = perfil.eixo ?? -20;
  return [...parties.partidos]
    .filter((p) => Math.abs(p.eixo - alvo) < 45)
    .sort((a, b) => b.forcaRecife - a.forcaRecife)[0]?.id
    || 'PSB';
}

function resolverCrise(state) {
  // heurística: opção 0 costuma ser a "responsável"; evita a última se for a arriscada
  const ev = state.eventoPendente;
  const idx = ev.opcoes.length >= 2 ? 0 : 0;
  return aplicar(state, (s) => resolverEvento(s, idx));
}

function agirMes(state, perfil) {
  let s = state;
  const fase = s.personagem.fase;
  const b1 = perfil.bairro1;
  const b2 = perfil.bairro2;

  // jogador casual: fora de campanha, ~40% dos meses ele mal age
  if (perfil.esforco === 'casual' && fase !== 'CANDIDATO') {
    const r = streamRng(s.meta.seed, 'casual', s.tempo.mes);
    if (r.chance(0.4)) return s;
    if (r.chance(0.5)) s.tempo.energia = Math.min(s.tempo.energia, 4);
  }

  // objetivo de fase
  const obj = objetivoDaFase(s);
  if (obj?.disponivel) {
    if (obj.id === 'assumir_vida_publica') s = aplicar(s, (x) => aplicarObjetivo(x, obj.id, {}));
    else if (obj.id === 'filiar_partido') s = aplicar(s, (x) => aplicarObjetivo(x, 'filiar_partido', { partidoId: escolherPartido(s, perfil) }));
    else if (obj.id === 'lancar_candidatura') {
      // a janela já está aberta (obj.disponivel) — lança logo que der,
      // porque perder o ciclo custa 4 anos.
      const jan = janelaCandidatura(s);
      const ultimaChance = s.tempo.mes >= jan.fecha - 1;
      const temMandato = !!s.mandato;
      const limiar = perfil.esforco === 'casual' ? 14 : 20;
      if (temMandato || s.reputacao.notoriedade >= limiar || ultimaChance) {
        s = aplicar(s, (x) => aplicarObjetivo(x, 'lancar_candidatura', { cargoId: obj.cargoPadrao || 'VEREADOR' }));
      }
    }
  }

  // ações do mês conforme a fase
  let guard = 0;
  while (s.tempo.energia >= 2 && guard++ < 8) {
    const antes = s.tempo.energia;
    if (fase === 'VIDA') {
      const acts = acoesDisponiveis(s).map((a) => a.id);
      const pick = s.reputacao.notoriedade < 9
        ? (acts.includes('carta_jornal') ? 'carta_jornal' : acts.includes('post_redes') ? 'post_redes' : acts[0])
        : (acts.includes('organizar_mutirao') ? 'organizar_mutirao' : acts.includes('visitar_bairro') ? 'visitar_bairro' : acts[0]);
      s = aplicar(s, (x) => aplicarAcao(x, pick, { bairroId: b1 }));
    } else if (fase === 'VIDA_PUBLICA' || fase === 'PARTIDO') {
      const acts = acoesDisponiveis(s).map((a) => a.id);
      const order = ['reforcar_indicacao', 'almoco_lideranca', 'carta_jornal', 'organizar_mutirao', 'conversar_politico', 'post_redes'];
      const pick = order.find((id) => acts.includes(id)) || acts[0];
      const opts = { bairroId: b1 };
      if (pick === 'almoco_lideranca' || pick === 'conversar_politico') {
        opts.politicoId = Object.values(s.mundo.politicos).find((p) => p.partidoId === s.personagem.partidoId)?.id;
      }
      s = aplicar(s, (x) => aplicarAcao(x, pick, opts));
    } else if (fase === 'CANDIDATO') {
      if (s.financas.campanha < 12000) { s = aplicar(s, (x) => aplicarAcao(x, 'captacao_campanha', {})); continue; }
      const acts = acoesDisponiveis(s).map((a) => a.id);
      const order = ['porta_a_porta_time', 'caminhada', 'propaganda_digital', 'comicio', 'panfletagem', 'visita_associacao'];
      const pick = order.find((id) => acts.includes(id)) || acts[0];
      s = aplicar(s, (x) => aplicarAcao(x, pick, { bairroId: guard % 2 ? b1 : b2 }));
    } else if (fase === 'MANDATO' && s.mandato) {
      const foco = s.mandato.projetos.find((p) => p.status === 'TRAMITANDO' && p.precisaMaioria && p.apoio < 56);
      if (foco && s.tempo.energia >= 2) { s = aplicar(s, (x) => negociarVotosProjeto(x, foco.id)); continue; }
      const nTram = s.mandato.projetos.filter((p) => p.status === 'TRAMITANDO').length;
      if (nTram < 2 && s.tempo.energia >= 3) {
        const temas = ['saneamento', 'saude', 'educacao', 'mobilidade', 'seguranca'];
        s = aplicar(s, (x) => protocolarProjeto(x, { tema: temas[s.tempo.mes % 5], tipo: s.tempo.mes % 3 === 0 ? 'indicacao' : 'projeto_lei', bairroId: b1 }));
        continue;
      }
      const acts = acoesDisponiveis(s).map((a) => a.id);
      const pick = ['atender_demanda', 'fiscalizar_obra', 'discurso_plenario', 'trabalhar_base'].find((id) => acts.includes(id)) || acts[0];
      s = aplicar(s, (x) => aplicarAcao(x, pick, { bairroId: b2 }));
    } else break;
    if (s.tempo.energia === antes) break; // ação falhou, evita loop
  }

  // monta o gabinete ao longo do mandato (respeita a verba)
  if (fase === 'MANDATO' && s.mandato) {
    for (const cargo of ['chefe_gabinete', 'assessor_parlamentar', 'assessor_comunicacao', 'assessor_territorial', 'assessor_politico']) {
      if (s.mandato.gabinete.contratados[cargo]) continue;
      const r = streamRng(s.meta.seed, 'hire', cargo, s.tempo.mes);
      const c = candidatosAssessor(s, cargo, r).sort((a, b) => b.competencia - a.competencia)[0];
      if (!c) continue;
      const antes = Object.keys(s.mandato.gabinete.contratados).length;
      s = aplicar(s, (x) => contratarAssessor(x, c));
      if (Object.keys(s.mandato.gabinete.contratados).length === antes) break; // verba estourou
    }
  }

  return s;
}

export function simularPartida(seed, perfil = {}) {
  const p = {
    profissaoId: perfil.profissaoId || 'jornalista',
    traçoId: perfil.traçoId ?? 'midiatico',
    dificuldade: perfil.dificuldade || 'NORMAL',
    eixo: perfil.eixo ?? -20,
    bairro1: perfil.bairro1 || 'ibura',
    bairro2: perfil.bairro2 || 'casa_amarela',
    maxMeses: perfil.maxMeses || 90,
    // 'otimo' (default): aproveita cada mês. 'casual': pula meses, age menos.
    esforco: perfil.esforco || 'otimo',
  };
  let s = novoJogo({ nome: 'Sim', profissaoId: p.profissaoId, traçoId: p.traçoId, dificuldade: p.dificuldade, seed });

  const r = { seed, eleito: false, reeleito: false, posicao: null, votos: 0, mesEleicao: null, projetosAprovados: 0 };
  let crisesResolvidas = 0;

  let iter = 0;
  while (s.tempo.mes < p.maxMeses && iter++ < p.maxMeses * 3) {
    if (s.eventoPendente) {
      s = resolverCrise(s);
      crisesResolvidas++;
      s.eventoPendente = null; // garante que não trava
      continue;
    }
    s = agirMes(s, p);
    // registra resultado de eleição
    if (s.eleicao?.status === 'APURADO' && r.mesEleicao == null) {
      r.mesEleicao = s.tempo.mes;
      r.eleito = s.eleicao.resultado.eleito;
      r.posicao = s.eleicao.resultado.posicaoJogador;
      r.votos = s.eleicao.resultado.votosJogador;
      s = aplicar(s, (x) => { x.eleicao = null; });
      if (!r.eleito) break; // parou de simular após derrota (1 tentativa)
    } else if (s.eleicao?.status === 'APURADO') {
      // reeleição
      r.reeleito = s.eleicao.resultado.eleito;
      s = aplicar(s, (x) => { x.eleicao = null; });
      break;
    }
    s = avancarMes(s);
    if (s.personagem.fase === 'MANDATO' && s.mandato) r.projetosAprovados = s.mandato.indicadores.projetosAprovados;
    if (s.fimDeJogo) { r.fimDeJogo = s.fimDeJogo.tipo; break; } // Fase 30
  }

  r.aprovacaoFinal = Math.round(s.reputacao.aprovacao);
  r.rejeicaoFinal = Math.round(s.reputacao.rejeicao);
  r.dinheiroFinal = s.financas.pessoal;
  r.crises = crisesResolvidas;
  r.faseFinal = s.personagem.fase;
  return r;
}

// roda um lote e agrega
export function rodarLote(n = 100, perfil = {}) {
  const res = [];
  for (let i = 0; i < n; i++) res.push(simularPartida(`lote-${perfil.tag || 'x'}-${i}`, perfil));
  const elegeu = res.filter((r) => r.eleito);
  const naoChegou = res.filter((r) => r.mesEleicao == null);
  const reeleitos = res.filter((r) => r.reeleito);
  const media = (arr, f) => (arr.length ? Math.round(arr.reduce((s, r) => s + f(r), 0) / arr.length) : 0);
  return {
    n,
    taxaEleicao: +(elegeu.length / n).toFixed(2),
    naoChegouAConcorrer: naoChegou.length,
    votosMedios: media(elegeu, (r) => r.votos),
    posicaoMedia: +(elegeu.reduce((s, r) => s + (r.posicao || 0), 0) / (elegeu.length || 1)).toFixed(1),
    mesEleicaoMedio: media(res.filter((r) => r.mesEleicao != null), (r) => r.mesEleicao),
    taxaReeleicao: elegeu.length ? +(reeleitos.length / elegeu.length).toFixed(2) : 0,
    projetosMedios: +(elegeu.reduce((s, r) => s + r.projetosAprovados, 0) / (elegeu.length || 1)).toFixed(1),
    aprovMedia: media(res, (r) => r.aprovacaoFinal),
    rejMedia: media(res, (r) => r.rejeicaoFinal),
    dinheiroMedio: media(res, (r) => r.dinheiroFinal),
    crisesMedias: +(res.reduce((s, r) => s + r.crises, 0) / n).toFixed(1),
  };
}
