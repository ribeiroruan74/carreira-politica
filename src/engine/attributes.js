// Item 1 — sem barra de XP. Treino/prática/discurso/entrevista sobem o atributo
// direto, com retorno decrescente perto do teto (fica mais lento no topo).

import { clamp, createRng } from './rng';

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

// Item 6 — treino pago: dinheiro + energia compram ponto de atributo direto (sem XP),
// com retorno decrescente e custo que sobe com o nível.
export function custoTreinoAtributo(state, attrId) {
  const v = state.personagem.atributos[attrId] ?? 45;
  const emCargo = state.personagem.cargoAtual && state.personagem.cargoAtual !== 'NENHUM';
  const base = 1800 + Math.round((v ** 3) / 220);
  return { dinheiro: Math.round((base * (emCargo ? 1.35 : 1)) / 100) * 100, energia: 2 };
}

export function treinarAtributoPago(state, attrId) {
  if (!TREINAVEIS_IDS.has(attrId)) throw new Error('Esse atributo não pode ser treinado.');
  const atr = state.personagem.atributos;
  if (atr[attrId] == null) atr[attrId] = 45;
  if (atr[attrId] >= TETO) throw new Error('Esse atributo já está no teto.');
  const c = custoTreinoAtributo(state, attrId);
  if (state.tempo.energia < c.energia) throw new Error(`Sem energia (custa ${c.energia}).`);
  if (state.financas.pessoal < c.dinheiro) throw new Error('Dinheiro pessoal insuficiente.');
  const rng = createRng(state.meta.seed, state.meta.rngState);
  state.tempo.energia -= c.energia;
  state.financas.pessoal -= c.dinheiro;
  const headroom = clamp((TETO - atr[attrId]) / 47, 0.12, 1);
  const ganho = rng.range([0.9, 1.7]) * headroom;
  atr[attrId] = Math.round(clamp(atr[attrId] + ganho, 5, TETO) * 10) / 10;
  state.meta.rngState = rng.state;
  state.log.unshift({ mes: state.tempo.mes, tipo: 'PESSOAL', texto: `Treino particular — ${attrId}: +${ganho.toFixed(1)} (agora ${Math.round(atr[attrId])}).` });
  return { ganho: +ganho.toFixed(1), valor: atr[attrId] };
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
