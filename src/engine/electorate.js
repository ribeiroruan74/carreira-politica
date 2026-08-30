// Fase 8 — eleitorado dinâmico.
// state.mundo.satisfacaoGrupos[gid] guarda -100..100 de quão satisfeito um grupo
// social está com o jogador. Persiste entre meses, decai devagar para 0 e
// alimenta o modelo de votos (voteModel.propensao, só para o jogador).

import electorateDef from '../content/electorate.json';
import lawsDef from '../content/laws.json';
import partiesDef from '../content/parties.json';
import { clamp } from './rng';

const GRUPOS = electorateDef.grupos;
const GRUPO_POR_ID = Object.fromEntries(GRUPOS.map((g) => [g.id, g]));
const TEMA_POR_ID = Object.fromEntries(lawsDef.temas.map((t) => [t.id, t]));

export function nomeGrupo(id) {
  return GRUPO_POR_ID[id]?.nome || id;
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
  const pior = resumoSatisfacao(s)[0];
  if (pior && pior.valor <= -35 && s.tempo.mes % 3 === 0) {
    eventos.push({ tipo: 'ALERTA', texto: `${pior.nome} estão descontentes com você (${pior.valor}).` });
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
