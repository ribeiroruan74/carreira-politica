// Item 1 — sem barra de XP. Treino/prática/discurso/entrevista sobem o atributo
// direto, com retorno decrescente perto do teto (fica mais lento no topo).

import { clamp } from './rng';

export const TREINAVEIS = [
  { id: 'carisma', nome: 'Carisma', metodo: 'eventos, contato, exposição' },
  { id: 'comunicacao', nome: 'Comunicação', metodo: 'entrevistas, redes, cursos' },
  { id: 'lideranca', nome: 'Liderança', metodo: 'mobilização, militância, mentoria' },
  { id: 'negociacao', nome: 'Negociação', metodo: 'articulação, alianças, cursos' },
  { id: 'estrategia', nome: 'Estratégia', metodo: 'planejamento, mentoria' },
  { id: 'oratoria', nome: 'Oratória', metodo: 'discursos, debates, podcasts' },
  { id: 'organizacao', nome: 'Gestão', metodo: 'gabinete, projetos, cursos' },
];
const TREINAVEIS_IDS = new Set([...TREINAVEIS.map((t) => t.id), 'inteligencia', 'improviso', 'coragem']);

const TETO = 92;

// Sobe o atributo direto. `xp` é a antiga "quantidade de treino" (~2..40);
// aqui vira ganho fracionário em pontos, menor quanto mais perto do teto.
export function ganharXp(state, attrId, xp) {
  if (!xp || xp <= 0 || !TREINAVEIS_IDS.has(attrId)) return { subiu: 0 };
  const atr = state.personagem.atributos;
  if (atr[attrId] == null) atr[attrId] = 45;
  const antes = Math.floor(atr[attrId]);
  const headroom = clamp((TETO - atr[attrId]) / 47, 0.12, 1);
  const ganho = (xp / 45) * headroom;
  atr[attrId] = Math.round(clamp(atr[attrId] + ganho, 5, TETO) * 10) / 10;
  return { subiu: Math.floor(atr[attrId]) - antes, valor: atr[attrId] };
}

export function progressoAtributo(state, attrId) {
  const v = state.personagem.atributos[attrId] ?? 50;
  return { valor: v, noTeto: v >= TETO };
}
