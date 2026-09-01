// Item 3 — mini-jogos. Sequência curta de escolhas antes de resolver uma ação.
// Reusa o mesmo padrão da entrevista: passos com opções pontuadas, placar médio +
// atributo governante definem um tier que multiplica os efeitos reais da ação.

import { createRng, clamp } from './rng';
import { aplicarAcao } from './actions';
import { resolverNegociacaoProjeto } from './mandate';
import def from '../content/minigames.json';

// ação da Agenda -> modelo de mini-jogo
export const MINIGAME_DE_ACAO = {
  discurso_plenario: 'discurso', discurso_grupo: 'discurso',
  pronunciamento_estadual: 'discurso', pronunciamento_nacional: 'discurso',

  debate: 'debate',

  comicio: 'comicio', comicio_segmento: 'comicio', caminhada: 'comicio',
  porta_a_porta_time: 'comicio',

  reuniao_liderancas: 'reuniao', reuniao_partidaria: 'reuniao',
  reuniao_comunitaria: 'reuniao', reuniao_associacao: 'reuniao',
  reuniao_privada: 'reuniao', almoco_lideranca: 'reuniao',
  jantar_lideranca_privado: 'reuniao', jantar_networking: 'reuniao',
  networking_evento: 'reuniao',

  cerimonia_oficial: 'evento', evento_empresarial: 'evento', evento_academico: 'evento',
  evento_cultural: 'evento', evento_esportivo: 'evento', evento_influenciador: 'evento',
  evento_nacional: 'evento', palestra_faculdade: 'evento', audiencia_publica: 'evento',

  negociar_apoio: 'negociacao', negociar_votos: 'negociacao',
  articular_bancada: 'negociacao', articular_camara: 'negociacao',
  articular_bastidor: 'negociacao', articular_assembleia: 'negociacao',
  articular_senado: 'negociacao',
};

export function modeloMinigame(tipo) {
  return def.modelos[tipo] || null;
}

// Monta o mini-jogo. `origem` = { acaoId, opts } ou { projetoId } (negociação de projeto).
export function montarMinigame(state, tipo, origem = {}) {
  const m = modeloMinigame(tipo);
  if (!m) return null;
  return {
    tipo,
    titulo: m.titulo,
    atributo: m.atributo,
    passos: m.passos.map((p) => ({ prompt: p.prompt, opcoes: p.opcoes.map((o) => ({ texto: o.texto, score: o.score })) })),
    idx: 0,
    score: 0,
    escolhas: [],
    origem,
  };
}

function tierDoScore(state, mg) {
  const m = modeloMinigame(mg.tipo);
  const preparo = state.personagem.atributos[m.atributo] ?? 50;
  const medio = mg.score / Math.max(1, mg.passos.length);
  const t = medio + (preparo - 50) / 80;
  const ordem = ['otimo', 'bom', 'neutro', 'ruim'];
  return ordem.find((id) => t >= def.tiers[id].min) || 'ruim';
}

// Aplica a escolha do passo atual. Muta state.minigameAtivo. No último passo, resolve.
export function responderMinigamePasso(state, opcaoIdx) {
  const mg = state.minigameAtivo;
  if (!mg || mg.concluido) return null;
  const passo = mg.passos[mg.idx];
  const opc = passo?.opcoes[opcaoIdx] ?? passo?.opcoes[1] ?? passo?.opcoes[0];
  if (!opc) throw new Error('Escolha inválida.');
  mg.score += opc.score;
  mg.escolhas.push(opcaoIdx);
  mg.idx += 1;
  if (mg.idx < mg.passos.length) return { fim: false };
  return finalizarMinigame(state);
}

function finalizarMinigame(state) {
  const mg = state.minigameAtivo;
  const tierId = tierDoScore(state, mg);
  const tier = def.tiers[tierId] || def.tiers.neutro;
  const rng = createRng(state.meta.seed, state.meta.rngState);

  // empurrão de reputação do tier
  for (const [k, faixa] of Object.entries(tier.rep || {})) {
    const min = k === 'ecoMidiatico' ? -50 : 0;
    state.reputacao[k] = clamp((state.reputacao[k] ?? 0) + rng.range(faixa), min, 100);
  }
  state.meta.rngState = rng.state;

  let resumo;
  if (mg.origem.acaoId) {
    // re-executa a ação com os efeitos escalados pelo desempenho (custos já cobrados)
    const r = aplicarAcao(state, mg.origem.acaoId, {
      ...(mg.origem.opts || {}), _minigameFeito: true, _tierMult: tier.mult,
    });
    resumo = Array.isArray(r) ? r.join(', ') : '';
  } else if (mg.origem.projetoId) {
    try {
      const g = resolverNegociacaoProjeto(state, mg.origem.projetoId, tier.mult, rng);
      resumo = `apoio ao projeto +${g}%`;
    } catch (e) { resumo = e.message; }
    state.meta.rngState = rng.state;
  }

  const label = { otimo: 'Você mandou muito bem', bom: 'Saiu bem', neutro: 'Cumpriu o protocolo', ruim: 'Não foi o seu dia' }[tierId];
  const resultado = { fim: true, tier: tierId, titulo: `${mg.titulo}: ${label}`, resumo };
  mg.concluido = resultado;
  return resultado;
}
