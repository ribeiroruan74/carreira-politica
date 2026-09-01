// Item 7 — serviços de estilo de vida. Assinatura mensal do caixa pessoal que
// aumenta energia/saúde/bem-estar e reduz risco. Cancelar é imediato.

import lifestyleDef from '../content/lifestyle.json';
import { clamp } from './rng';

export const SERVICOS = lifestyleDef.servicos;
export const servicoDef = (id) => SERVICOS.find((s) => s.id === id) || null;

export function servicosAtivos(state) {
  const m = state.personagem?.servicos || {};
  return Object.entries(m)
    .map(([id, nivel]) => {
      const def = servicoDef(id);
      return def && def.niveis[nivel] ? { id, nivel, def, n: def.niveis[nivel] } : null;
    })
    .filter(Boolean);
}

export function assinarServico(state, id, nivel) {
  const def = servicoDef(id);
  if (!def || !def.niveis[nivel]) throw new Error('Serviço inválido.');
  const n = def.niveis[nivel];
  if (state.financas.pessoal < n.custoMes) throw new Error('Sem caixa para o primeiro mês.');
  (state.personagem.servicos ||= {})[id] = nivel;
  state.log.unshift({ mes: state.tempo.mes, tipo: 'FINANCAS', texto: `Assinou "${n.nome}" — ${n.custoMes.toLocaleString('pt-BR')}/mês.` });
  return { ok: true };
}

export function cancelarServico(state, id) {
  const at = servicosAtivos(state).find((x) => x.id === id);
  if (state.personagem.servicos) delete state.personagem.servicos[id];
  if (at) state.log.unshift({ mes: state.tempo.mes, tipo: 'FINANCAS', texto: `Cancelou "${at.n.nome}".` });
  return { ok: true };
}

export function custoServicosMensal(state) {
  return servicosAtivos(state).reduce((s, x) => s + x.n.custoMes, 0);
}

export function bonusServicos(state) {
  const b = { energiaMax: 0, saudeMes: 0, bemEstarMes: 0, notoriedadeMes: 0, riscoCriseReduz: 0 };
  for (const x of servicosAtivos(state)) {
    for (const [k, v] of Object.entries(x.n.efeitos || {})) b[k] = (b[k] || 0) + v;
  }
  b.energiaMax = Math.min(b.energiaMax, 5);
  b.riscoCriseReduz = Math.min(b.riscoCriseReduz, 0.28);
  return b;
}

// aplicado dentro de tickVidaPessoal (antes de recalcular energiaMax)
export function tickServicos(state) {
  const b = bonusServicos(state);
  const v = (state.personagem.vida ||= {});
  if (b.saudeMes) v.saude = clamp((v.saude ?? 100) + b.saudeMes, 8, 100);
  if (b.bemEstarMes) v.bemEstar = clamp((v.bemEstar ?? 60) + b.bemEstarMes, 0, 100);
  if (b.notoriedadeMes) state.reputacao.notoriedade = clamp(state.reputacao.notoriedade + b.notoriedadeMes, 0, 100);
  return { custo: custoServicosMensal(state) };
}
