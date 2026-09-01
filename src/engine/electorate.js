// Fase 8 — eleitorado dinâmico.
// state.mundo.satisfacaoGrupos[gid] guarda -100..100 de quão satisfeito um grupo
// social está com o jogador. Persiste entre meses, decai devagar para 0 e
// alimenta o modelo de votos (voteModel.propensao, só para o jogador).

import electorateDef from '../content/electorate.json';
import lawsDef from '../content/laws.json';
import partiesDef from '../content/parties.json';
import { clamp, streamRng } from './rng';

const GRUPOS = electorateDef.grupos;
const GRUPO_POR_ID = Object.fromEntries(GRUPOS.map((g) => [g.id, g]));
const TEMA_POR_ID = Object.fromEntries(lawsDef.temas.map((t) => [t.id, t]));

export function nomeGrupo(id) {
  return GRUPO_POR_ID[id]?.nome || id;
}

// Item 3 — lista {id, nome, eixo} para seletores de UI (Agenda, Inteligência).
export const GRUPOS_LISTA = GRUPOS.map((g) => ({ id: g.id, nome: g.nome, eixo: g.eixo }));

// Item 3 — encontro/discurso direcionado a um grupo social. O grupo-alvo sente o
// efeito cheio; grupos ideologicamente próximos sentem um respingo; os opostos
// podem até esfriar um pouco (você "se marcou"). Não dá voto — mexe em satisfação.
export function cortejarGrupo(state, gid, forca) {
  const alvo = GRUPO_POR_ID[gid];
  if (!alvo || !forca) return;
  ajustarSatisfacao(state, gid, forca);
  for (const g of GRUPOS) {
    if (g.id === gid) continue;
    const prox = 1 - Math.abs(g.eixo - alvo.eixo) / 120; // 1 = colado, <0 = oposto
    if (prox > 0.35) ajustarSatisfacao(state, g.id, forca * prox * 0.4);
    else if (prox < -0.2) ajustarSatisfacao(state, g.id, forca * prox * 0.18);
  }
}

export function satisfacaoDe(state, gid) {
  return state.mundo?.satisfacaoGrupos?.[gid] || 0;
}

export function ajustarSatisfacao(state, gid, delta) {
  if (!GRUPO_POR_ID[gid] || !delta) return;
  const mapa = (state.mundo.satisfacaoGrupos ||= {});
  mapa[gid] = clamp((mapa[gid] || 0) + delta, -100, 100);
}

// Uma entrega/gesto sobre um tema mexe com os grupos que aquele tema mobiliza.
// O primeiro grupo listado sente o efeito cheio; os demais, parcial.
export function impactoDeTema(state, temaId, forca) {
  const tema = TEMA_POR_ID[temaId];
  if (!tema || !forca) return;
  (tema.grupos || []).forEach((gid, i) => {
    ajustarSatisfacao(state, gid, i === 0 ? forca : forca * 0.55);
  });
}

// Efeito difuso (aprovação alta agrada em geral, escândalo desagrada).
export function impactoGeral(state, forca) {
  for (const g of GRUPOS) ajustarSatisfacao(state, g.id, forca * (0.6 + 0.4 * (1 - g.volatilidade)));
}

function partidoDoJogador(state) {
  return partiesDef.partidos.find((p) => p.id === state.personagem.partidoId) || null;
}

// Tick mensal: decaimento + deriva ideológica + humor nacional.
export function tickEleitorado(s) {
  const eventos = [];
  const mapa = (s.mundo.satisfacaoGrupos ||= {});
  const pa = partidoDoJogador(s);
  // clima nacional: > 0 = vento de centro-direita; < 0 = vento de centro-esquerda.
  const clima = s.mundo?.nacional?.clima || 0;
  // sintonia do jogador com o vento: +1 se o partido está do lado favorecido.
  const sintonia = pa && clima ? clamp((-(pa.eixo || 0) / 100) * (-clima / 100) * 4, -1, 1) : 0;

  for (const g of GRUPOS) {
    let v = mapa[g.id] || 0;
    // 1) regressão à média — grupos voláteis esquecem mais rápido
    v *= (1 - (0.04 + g.volatilidade * 0.04));
    if (Math.abs(v) < 0.4) v = 0;

    // 2) deriva ideológica: partido do jogador longe do grupo corrói devagar
    if (pa) {
      const dEixo = Math.abs((pa.eixo || 0) - g.eixo) / 100;
      const dSoc = Math.abs((pa.eixoSocial ?? pa.eixo ?? 0) - g.eixoSocial) / 100;
      const desalinho = dEixo * 0.9 + dSoc * 0.5;
      if (desalinho > 0.55) v -= (desalinho - 0.55) * 3;
    }

    // 3) humor nacional: se o jogador está em sintonia com o vento, todos os
    //    grupos esquentam um pouco; contra o vento, esfriam. Grupos alinhados
    //    ideologicamente ao jogador sentem menos o efeito negativo.
    if (sintonia) {
      const afinidade = pa ? 1 - Math.abs((pa.eixo || 0) - g.eixo) / 200 : 1;
      v += sintonia * 1.6 * (sintonia > 0 ? 1 : afinidade);
    }

    mapa[g.id] = clamp(v, -100, 100);
  }

  // alerta quando um grupo relevante vira contra
  const ord = resumoSatisfacao(s);
  const pior = ord[0];
  if (pior && pior.valor <= -35 && s.tempo.mes % 3 === 0) {
    eventos.push({ tipo: 'ALERTA', texto: `${pior.nome} estão descontentes com você (${pior.valor}).` });
  }

  // Item 3 — o nível do grupo abre ou fecha portas
  const melhor = ord[ord.length - 1];
  const rg = streamRng(s.meta.seed, 'grupos_oport', s.tempo.mes);
  if (melhor && melhor.valor >= 58 && rg.chance(0.26)) {
    if (rg.chance(0.5)) {
      const d = Math.round(s.redes.seguidores * rg.range([0.004, 0.014])) + rg.int(30, 120);
      s.redes.seguidores += d;
      eventos.push({ tipo: 'INFO', texto: `${melhor.nome} andam divulgando seu nome — +${d} seguidores.` });
    } else {
      s.reputacao.notoriedade = clamp(s.reputacao.notoriedade + rg.range([0.5, 1.6]), 0, 100);
      s.reputacao.ecoMidiatico = clamp(s.reputacao.ecoMidiatico + rg.int(2, 6), -50, 100);
      eventos.push({ tipo: 'INFO', texto: `${melhor.nome} te colocaram num palanque importante.` });
    }
  }
  if (pior && pior.valor <= -50 && rg.chance(0.3)) {
    s.reputacao.ecoMidiatico = clamp(s.reputacao.ecoMidiatico + rg.int(3, 8), -50, 100);
    s.reputacao.rejeicao = clamp(s.reputacao.rejeicao + rg.range([0.4, 1.5]), 0, 100);
    eventos.push({ tipo: 'ALERTA', texto: `${pior.nome} organizaram um ato público contra você.` });
  }
  return { eventos };
}

// Para telas: lista ordenada do mais insatisfeito ao mais satisfeito.
export function resumoSatisfacao(state) {
  const mapa = state.mundo?.satisfacaoGrupos || {};
  return GRUPOS
    .map((g) => ({ id: g.id, nome: g.nome, valor: Math.round(mapa[g.id] || 0) }))
    .sort((a, b) => a.valor - b.valor);
}
