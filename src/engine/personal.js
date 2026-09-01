// Fase 22 — saúde e energia. (Relacionamentos, filhos e eventos de família
// vivem em family.js — Etapa 11.)
// A saúde acompanha o ritmo de trabalho; junto com o bem-estar, define a
// energia máxima.

import { streamRng, clamp } from './rng';
import { tickServicos, bonusServicos } from './lifestyle';

const HOBBIES = ['corrida', 'música', 'culinária', 'leitura', 'futebol', 'jardinagem', 'pesca', 'cinema'];

export function estadoVida(state) {
  return state.personagem.vida || { estadoCivil: 'solteiro', conjuge: null, filhos: 0, hobby: null, saude: 100, bemEstar: 60 };
}

export function cuidarDeSi(state, rng) {
  const v = (state.personagem.vida ||= estadoVida(state));
  v.saude = clamp(v.saude + rng.range([8, 16]), 0, 100);
  v.bemEstar = clamp((v.bemEstar ?? 60) + rng.range([2, 6]), 0, 100);
  state.tempo.energia = clamp(state.tempo.energia + rng.range([2, 5]), 0, state.tempo.energiaMax + 2);
  state.reputacao.rejeicao = clamp(state.reputacao.rejeicao - rng.range([0, 1]), 0, 100);
  if (!v.hobby && rng.chance(0.5)) {
    v.hobby = rng.pick(HOBBIES);
    return `Você tirou um tempo para si e reencontrou o gosto por ${v.hobby}. Saúde recuperada.`;
  }
  return 'Você desacelerou por uns dias. Saúde e energia recuperadas.';
}

export function tickVidaPessoal(s) {
  const eventos = [];
  const v = (s.personagem.vida ||= estadoVida(s));
  const rng = streamRng(s.meta.seed, 'vida', s.tempo.mes);

  // Item 7 — serviços de estilo de vida: aplica saúde/bem-estar/notoriedade do mês
  tickServicos(s);

  // saúde segue o ritmo: mês puxado (pouca energia sobrando) desgasta; folga recompõe.
  // o peso da idade só entra a partir dos ~58 e cresce devagar.
  const folga = s.tempo.energia / Math.max(1, s.tempo.energiaMax);
  let dSaude = (folga - 0.45) * 6 - Math.max(0, s.personagem.idade - 58) * 0.055;
  if (v.hobby) dSaude += 0.6;
  v.saude = clamp(v.saude + dSaude, 8, 100);

  // Item 1 — energia máxima (recurso único do mês) modulada por saúde e bem-estar.
  // Item 7 — serviços de estilo de vida somam por cima (teto +5).
  const bem = v.bemEstar ?? 60;
  const baseMax = clamp(10 + v.saude / 18 + (bem - 55) / 28, 9, 16);
  s.tempo.energiaMax = Math.round(clamp(baseMax + bonusServicos(s).energiaMax, 9, 21));

  if (v.saude <= 30 && s.tempo.mes % 2 === 0) {
    eventos.push({ tipo: 'ALERTA', texto: `Sua saúde está no limite (${Math.round(v.saude)}). Considere desacelerar.` });
  }

  // problema de saúde esporádico
  if (s.personagem.fase !== 'VIDA' && rng.chance(0.02)) {
    v.saude = clamp(v.saude - rng.range([6, 14]), 12, 100);
    s.tempo.energia = Math.max(0, s.tempo.energia - rng.range([1, 3]));
    const txt = 'Um problema de saúde tirou você de circulação por alguns dias.';
    eventos.push({ tipo: 'CIDADE', texto: txt });
    s.log.unshift({ mes: s.tempo.mes, tipo: 'PESSOAL', texto: txt });
  }
  return { eventos };
}
