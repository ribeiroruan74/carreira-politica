// Fase 15/16 — influenciadores + mercado de influência.
// O roster de influencers.json vira um runtime vivo em mundo.influenciadores:
// alcance oscila, o "cache" (preço) sobe com o alcance e o momento (humor),
// rivais capturam influenciadores, contratos vencem, aliados dão empurrões de
// graça e hostis atacam.

import influDef from '../content/influencers.json';
import electorateDef from '../content/electorate.json';
import partiesDef from '../content/parties.json';
import { streamRng, clamp } from './rng';
import { semear } from './cascade';

const ROSTER = influDef.influenciadores;
const GRUPO = Object.fromEntries(electorateDef.grupos.map((g) => [g.id, g]));

function partido(id) {
  return partiesDef.partidos.find((p) => p.id === id) || null;
}

export function custoInfluenciador(inf) {
  // cache mensal: alcance é o grosso; humor quente encarece; já contratado por
  // outro encarece pra "roubar".
  const base = 1200 + inf.alcance * 260;
  const heat = 1 + Math.max(0, inf.humor || 0) / 60;
  const disputado = inf.aliadoDe && inf.aliadoDe !== 'JOGADOR' ? 1.6 : 1;
  return Math.round(base * heat * disputado / 100) * 100;
}

export function inicializarInfluenciadores(state) {
  const rng = streamRng(state.meta.seed, 'influinit');
  state.mundo.influenciadores = ROSTER.map((r) => ({
    ...r,
    alcance: clamp(r.alcanceBase + rng.int(-8, 8), 15, 98),
    relacao: 0,
    humor: rng.int(-10, 15),
    aliadoDe: null,
    contratadoAte: 0,
  }));
  for (const inf of state.mundo.influenciadores) inf.cache = custoInfluenciador(inf);
  state.mundo.influInicializado = true;
}

export function garantirInfluenciadores(state) {
  if (!state.mundo.influInicializado || !(state.mundo.influenciadores || []).length) {
    inicializarInfluenciadores(state);
  }
}

export function influenciadorPorId(state, id) {
  return (state.mundo.influenciadores || []).find((i) => i.id === id) || null;
}

export function influenciadoresDisponiveis(state) {
  garantirInfluenciadores(state);
  return (state.mundo.influenciadores || []).map((i) => ({
    ...i,
    cache: custoInfluenciador(i),
    contratado: i.aliadoDe === 'JOGADOR' && state.tempo.mes < i.contratadoAte,
    capturado: i.aliadoDe && i.aliadoDe !== 'JOGADOR',
    afinidade: afinidadeJogador(state, i),
  })).sort((a, b) => b.alcance - a.alcance);
}

function afinidadeJogador(state, inf) {
  const pa = partido(state.personagem.partidoId);
  const eixoJ = pa?.eixo ?? 0;
  return Math.round(clamp(100 - Math.abs(eixoJ - inf.eixo) * 0.9 + inf.relacao * 0.4, -100, 100));
}

// distribui satisfação aos grupos do influenciador (canal da Fase 8)
function mexerGrupos(state, inf, valor) {
  state.mundo.satisfacaoGrupos ||= {};
  (inf.publico || []).forEach((gid, i) => {
    if (!GRUPO[gid]) return;
    const v = i === 0 ? valor : valor * 0.6;
    state.mundo.satisfacaoGrupos[gid] = clamp((state.mundo.satisfacaoGrupos[gid] || 0) + v, -100, 100);
  });
}

// --- ações do jogador ---

export function cultivarInfluenciador(state, id, rng) {
  garantirInfluenciadores(state);
  const inf = influenciadorPorId(state, id);
  if (!inf) throw new Error('Influenciador não encontrado.');
  const g = rng.range([6, 13]) + (state.personagem.atributos.carisma - 50) / 12;
  inf.relacao = clamp(inf.relacao + g, -100, 100);
  inf.humor = clamp(inf.humor + rng.range([0, 3]), -50, 60);
  return { nome: inf.nome, relacao: Math.round(inf.relacao) };
}

export function colaborarInfluenciador(state, id, rng) {
  garantirInfluenciadores(state);
  const inf = influenciadorPorId(state, id);
  if (!inf) throw new Error('Influenciador não encontrado.');
  if (inf.relacao < 15) throw new Error(`${inf.nome} ainda não topa uma collab — cultive a relação primeiro.`);
  if (inf.aliadoDe && inf.aliadoDe !== 'JOGADOR') throw new Error(`${inf.nome} está fechado com outra campanha.`);

  const alcance = inf.alcance / 100;
  const q = 0.5 + (state.personagem.atributos.comunicacao - 50) / 160 + inf.relacao / 260;
  const viral = rng.chance(0.12 + Math.max(0, inf.humor) / 200);
  const views = Math.round(rng.rangeInt([8000, 90000]) * (0.5 + alcance) * (0.6 + q) * (viral ? rng.range([4, 14]) : 1));

  const dNoto = clamp((Math.log10(Math.max(10, views)) - 3.2) * rng.range([1.6, 3]), 0.5, 12);
  state.reputacao.notoriedade = clamp(state.reputacao.notoriedade + dNoto, 0, 100);
  state.reputacao.ecoMidiatico = clamp(state.reputacao.ecoMidiatico + dNoto * 0.6, -50, 100);
  const dSeg = Math.round(views * rng.range([0.004, 0.015]));
  state.redes.seguidores += dSeg;
  mexerGrupos(state, inf, rng.range([4, 9]) * (viral ? 1.5 : 1));
  inf.humor = clamp(inf.humor + rng.range([2, 8]), -50, 60);
  inf.alcance = Math.round(clamp(inf.alcance + (viral ? rng.range([1, 4]) : rng.range([0, 1])), 15, 98));

  const txt = `Collab com ${inf.nome} (${inf.nicho}): ${fmtViews(views)} views${viral ? ' — VIRALIZOU' : ''}, notoriedade +${dNoto.toFixed(1)}, +${dSeg.toLocaleString('pt-BR')} seguidores.`;
  state.mundo.noticias.unshift({ id: `nt_collab_${id}_${state.tempo.mes}`, mes: state.tempo.mes, tipo: 'MIDIA', destaque: viral, atores: [], texto: `${state.personagem.nome} e ${inf.nome} publicam vídeo juntos.` });
  state.log.unshift({ mes: state.tempo.mes, tipo: viral ? 'MARCO' : 'ACAO', texto: txt });
  return { views, viral, dNoto, dSeg, resumo: txt };
}

// contrato: paga cache*meses da caixa de campanha, tranca o influenciador com você
export function contratarInfluenciador(state, id, meses = 3) {
  garantirInfluenciadores(state);
  const inf = influenciadorPorId(state, id);
  if (!inf) throw new Error('Influenciador não encontrado.');
  const total = custoInfluenciador(inf) * meses;
  if (state.financas.campanha < total) throw new Error(`Caixa de campanha insuficiente (custa R$ ${total.toLocaleString('pt-BR')}).`);
  if (inf.aliadoDe && inf.aliadoDe !== 'JOGADOR') {
    // roubar de um rival: custa o sobrepreço já embutido no cache
    inf.aliadoDe = 'JOGADOR';
  }
  state.financas.campanha -= total;
  inf.aliadoDe = 'JOGADOR';
  inf.contratadoAte = state.tempo.mes + meses;
  inf.relacao = clamp(inf.relacao + 12, -100, 100);
  state.log.unshift({ mes: state.tempo.mes, tipo: 'ACAO', texto: `${inf.nome} fechou contrato com sua campanha por ${meses} mês(es) — R$ ${total.toLocaleString('pt-BR')}.` });
  return { nome: inf.nome, total, ate: inf.contratadoAte };
}

// --- tick mensal ---
export function tickInfluenciadores(s) {
  garantirInfluenciadores(s);
  const eventos = [];
  const rng = streamRng(s.meta.seed, 'inftick', s.tempo.mes);
  const pa = partido(s.personagem.partidoId);
  const eixoJ = pa?.eixo ?? 0;
  const emDisputa = ['CANDIDATO', 'PARTIDO'].includes(s.personagem.fase) || !!s.eleicao;

  for (const inf of s.mundo.influenciadores) {
    // alcance random-walk + reversão à base; humor esfria
    inf.alcance = Math.round(clamp(inf.alcance + rng.range([-3, 3]) + (inf.alcanceBase - inf.alcance) * 0.06, 12, 99));
    inf.humor = clamp((inf.humor || 0) * 0.85, -50, 60);
    inf.relacao = clamp(inf.relacao * 0.99, -100, 100);

    // contrato venceu
    if (inf.aliadoDe === 'JOGADOR' && s.tempo.mes >= inf.contratadoAte) {
      inf.aliadoDe = null;
      eventos.push({ tipo: 'MIDIA', texto: `Acabou o contrato com ${inf.nome}.` });
    }

    // contratado seu: empurrão passivo mensal ao público dele
    if (inf.aliadoDe === 'JOGADOR') {
      mexerGrupos(s, inf, rng.range([1.5, 3.5]));
      s.reputacao.notoriedade = clamp(s.reputacao.notoriedade + rng.range([0.2, 0.8]) * (inf.alcance / 100), 0, 100);
    }

    // rival captura um influenciador alinhado a ele (não o seu contratado)
    if (emDisputa && !inf.aliadoDe && rng.chance(0.04)
        && Math.abs(inf.eixo - eixoJ) > 45 && inf.relacao < 20) {
      inf.aliadoDe = 'RIVAL';
      inf.contratadoAte = s.tempo.mes + rng.int(3, 8);
      eventos.push({ tipo: 'ALERTA', texto: `${inf.nome} (${inf.nicho}) fechou com uma campanha rival.` });
    } else if (inf.aliadoDe === 'RIVAL' && s.tempo.mes >= inf.contratadoAte) {
      inf.aliadoDe = null;
    }

    // aliado espontâneo: relação alta + ideologia próxima → empurrão de graça
    if (inf.relacao > 45 && Math.abs(inf.eixo - eixoJ) < 35 && rng.chance(0.12)) {
      mexerGrupos(s, inf, rng.range([2, 5]));
      s.reputacao.notoriedade = clamp(s.reputacao.notoriedade + rng.range([0.5, 2]), 0, 100);
      eventos.push({ tipo: 'MIDIA', texto: `${inf.nome} te citou espontaneamente e o vídeo rendeu.` });
    }

    // hostil: relação ruim + ideologia oposta → ataque (pode virar cascata)
    if (inf.relacao < -25 && Math.abs(inf.eixo - eixoJ) > 50 && rng.chance(0.06)) {
      s.reputacao.rejeicao = clamp(s.reputacao.rejeicao + rng.range([1, 4]) * (inf.alcance / 90), 0, 100);
      mexerGrupos(s, inf, -rng.range([2, 5]));
      if (inf.alcance > 60 && rng.chance(0.4)) {
        semear(s, 'polemica_viral', { tema: `vídeo de ${inf.nome}` });
      }
      eventos.push({ tipo: 'ALERTA', texto: `${inf.nome} fez um vídeo te atacando (${fmtAlc(inf.alcance)}).` });
    }

    inf.cache = custoInfluenciador(inf);
  }
  return { eventos };
}

function fmtViews(v) {
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)} mi`;
  if (v >= 1e3) return `${Math.round(v / 1e3)} mil`;
  return `${v}`;
}
function fmtAlc(a) {
  return a >= 70 ? 'alcance grande' : a >= 45 ? 'alcance médio' : 'alcance pequeno';
}
