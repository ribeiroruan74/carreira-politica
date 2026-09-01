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
export const TREINAVEIS_IDS = new Set([...TREINAVEIS.map((t) => t.id), 'inteligencia', 'improviso', 'coragem']);

const TETO = 92;

// Ajuste final — treino pago: R$ 2.000 + 1 energia = +1 ponto de atributo. Sem XP.
export const CUSTO_TREINO = { dinheiro: 2000, energia: 1 };
export function custoTreinoAtributo() {
  return CUSTO_TREINO;
}

export function treinarAtributoPago(state, attrId) {
  if (!TREINAVEIS_IDS.has(attrId)) throw new Error('Esse atributo não pode ser treinado.');
  const atr = state.personagem.atributos;
  if (atr[attrId] == null) atr[attrId] = 45;
  if (atr[attrId] >= TETO) throw new Error('Esse atributo já está no teto.');
  if (state.tempo.energia < CUSTO_TREINO.energia) throw new Error('Sem energia (custa 1).');
  if (state.financas.pessoal < CUSTO_TREINO.dinheiro) throw new Error('Dinheiro pessoal insuficiente (R$ 2.000).');
  state.tempo.energia -= CUSTO_TREINO.energia;
  state.financas.pessoal -= CUSTO_TREINO.dinheiro;
  atr[attrId] = Math.min(TETO, Math.floor(atr[attrId]) + 1);
  state.log.unshift({ mes: state.tempo.mes, tipo: 'PESSOAL', texto: `Treino particular — ${attrId}: +1 (agora ${atr[attrId]}).` });
  return { ganho: 1, valor: atr[attrId] };
}

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
