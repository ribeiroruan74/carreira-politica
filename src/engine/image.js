// Fase 14 — imagem pública (personagem.imagem, 4 eixos 0-100).
// Módulo puro: sem efeitos colaterais, sem ciclos de import. Consumido por
// podcasts.js (que a movimenta) e voteModel.js (que a lê).

import { clamp } from './rng';

export const IMAGEM_EIXOS = [
  { id: 'competencia', alto: 'preparado(a) e técnico(a)', baixo: 'despreparado(a)' },
  { id: 'proximidade', alto: 'próximo(a) do povo', baixo: 'distante' },
  { id: 'combatividade', alto: 'combativo(a) e firme', baixo: 'conciliador(a)' },
  { id: 'renovacao', alto: 'renovação', baixo: 'da velha política' },
];

export function imagemAtual(state) {
  return state.personagem.imagem
    || { competencia: 50, proximidade: 50, combatividade: 50, renovacao: 50 };
}

export function ajustarImagem(state, delta, escala = 1) {
  const img = (state.personagem.imagem ||= imagemAtual(state));
  for (const [k, v] of Object.entries(delta || {})) {
    if (img[k] == null) continue;
    img[k] = clamp(img[k] + v * escala, 0, 100);
  }
}

export function imagemResumo(state) {
  const img = imagemAtual(state);
  return IMAGEM_EIXOS
    .map((e) => ({
      id: e.id,
      valor: Math.round(img[e.id]),
      frase: img[e.id] >= 50 ? e.alto : e.baixo,
      forca: Math.abs(img[e.id] - 50),
    }))
    .sort((a, b) => b.forca - a.forca);
}

// Preferência de imagem de um grupo social (heurística das propriedades do grupo).
export function preferenciaImagem(grupo) {
  const int = grupo.interesses || {};
  return {
    competencia: clamp(0.35 + (int.gestao || 0) * 0.4 + (int.impostos || 0) * 0.2 + (grupo.eixo > 10 ? 0.15 : 0), 0, 1),
    proximidade: clamp(0.35 + (int.assistencia || 0) * 0.4 + (int.saneamento || 0) * 0.3 + (grupo.eixo < 0 ? 0.15 : 0), 0, 1),
    combatividade: clamp(0.3 + (int.seguranca || 0) * 0.4 + (grupo.eixoSocial > 20 ? 0.25 : 0) + (grupo.volatilidade < 0.4 ? 0.1 : 0), 0, 1),
    renovacao: clamp(0.3 + (grupo.volatilidade || 0) * 0.5 + (int.digital || 0) * 0.3, 0, 1),
  };
}

// Termo de imagem para voteModel.propensao (só o jogador). ~ -0.6 .. +0.6
export function bonusImagemGrupo(imagem, grupo) {
  if (!imagem) return 0;
  const pref = preferenciaImagem(grupo);
  let soma = 0; let peso = 0;
  for (const e of IMAGEM_EIXOS) {
    const w = pref[e.id];
    soma += ((imagem[e.id] ?? 50) - 50) / 50 * w;
    peso += w;
  }
  return peso ? (soma / peso) * 0.6 : 0;
}
