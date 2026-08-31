// Etapa 10 — evolução de atributos por XP.
// Nada de "ação → +10". Cada treino/prática/discurso/entrevista dá XP; ao
// acumular o custo do nível atual, o atributo sobe 1 ponto. Fica caro no topo.

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

// custo (em XP) para sair do valor `n` para `n+1`. Cresce com o nível.
export function custoNivel(n) {
  return Math.round(14 + (Math.max(1, n) ** 1.32) / 3.4);
}

// Adiciona XP a um atributo. Sobe pontos enquanto houver XP acumulado suficiente.
export function ganharXp(state, attrId, xp) {
  if (!xp || xp <= 0 || !TREINAVEIS_IDS.has(attrId)) return { subiu: 0 };
  const xpm = (state.personagem.xpAtributos ||= {});
  const atr = state.personagem.atributos;
  if (atr[attrId] == null) atr[attrId] = 45;
  let acc = (xpm[attrId] || 0) + xp;
  let subiu = 0;
  while (atr[attrId] < 92) {
    const custo = custoNivel(atr[attrId]);
    if (acc < custo) break;
    acc -= custo;
    atr[attrId] += 1;
    subiu += 1;
  }
  xpm[attrId] = Math.round(acc);
  return { subiu, valor: atr[attrId] };
}

export function progressoAtributo(state, attrId) {
  const v = state.personagem.atributos[attrId] ?? 50;
  const acc = state.personagem.xpAtributos?.[attrId] || 0;
  const custo = custoNivel(v);
  return { valor: v, xp: acc, custo, pct: Math.round(clamp((acc / custo) * 100, 0, 100)), noTeto: v >= 92 };
}
