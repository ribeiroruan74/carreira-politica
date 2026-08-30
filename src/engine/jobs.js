import { clamp } from './rng';
import jobsDef from '../content/jobs.json';
import { cargoPorId } from './offices';

const CARGOS_ELETIVOS = ['VEREADOR', 'PREFEITO', 'DEPUTADO_ESTADUAL', 'DEPUTADO_FEDERAL', 'SENADOR', 'GOVERNADOR'];
function temMandatoEletivo(state) {
  return CARGOS_ELETIVOS.includes(state.personagem.cargoAtual);
}

export const EMPREGOS = jobsDef.empregos;

export function empregoPorId(id) {
  return EMPREGOS.find((e) => e.id === id) || null;
}

function atende(req, state) {
  for (const [k, min] of Object.entries(req || {})) {
    const v = (state.personagem.skills[k] ?? 0) || (state.personagem.atributos[k] ?? 0);
    if (v < min) return false;
  }
  return true;
}

// Empregos que o jogador pode assumir agora (qualificado, e não é o atual).
export function empregosDisponiveis(state) {
  const atualId = state.personagem.emprego?.id;
  const salAtual = state.personagem.emprego?.salario || 0;
  return EMPREGOS
    .filter((e) => e.id !== atualId && e.id !== 'legado' && atende(e.req, state))
    .map((e) => ({ ...e, salarioMedio: Math.round((e.salario[0] + e.salario[1]) / 2) }))
    .filter((e) => e.salarioMedio >= salAtual * 0.92)
    .sort((a, b) => b.salarioMedio - a.salarioMedio);
}

// salário efetivo do mês (metade se licenciado; subsídio se tem mandato)
export function rendaEfetiva(state) {
  if (temMandatoEletivo(state)) {
    const subsidio = cargoPorId(state.personagem.cargoAtual).subsidioMensal || 21000;
    // vereador (legislativo municipal) pode acumular meio período; executivo/estadual não
    const podeAcumular = state.personagem.cargoAtual === 'VEREADOR';
    const extra = podeAcumular && !state.personagem.licenciado && state.personagem.emprego
      ? Math.round((state.personagem.emprego.salario || 0) * 0.35)
      : 0;
    return subsidio + extra;
  }
  if (!state.personagem.emprego) return 0;
  const base = state.personagem.emprego.salario || 0;
  return state.personagem.licenciado ? Math.round(base * 0.5) : base;
}

export function horasEmprego(state) {
  if (state.personagem.licenciado) return 0;
  if (temMandatoEletivo(state)) return 0;
  return state.personagem.emprego?.horas || 0;
}

// aplica renda ao balance (chamado pelo tick e por newGame)
export function sincronizarRenda(state) {
  state.financas.rendaMensal = rendaEfetiva(state);
}

export function assumirEmprego(state, empregoId, rng, forcar = false) {
  const e = empregoPorId(empregoId);
  if (!e) throw new Error('Vaga inexistente.');
  if (!forcar && !atende(e.req, state)) throw new Error('Você ainda não tem o perfil para essa vaga.');
  const salario = rng ? rng.rangeInt(e.salario) : Math.round((e.salario[0] + e.salario[1]) / 2);
  state.personagem.emprego = {
    id: e.id, titulo: e.titulo, setor: e.setor, salario, horas: e.horas, mesInicio: state.tempo.mes,
  };
  state.personagem.licenciado = false;
  sincronizarRenda(state);
  state.personagem.historicoProfissional.push({
    mes: state.tempo.mes, texto: `Assumiu a posição de ${e.titulo} (R$ ${salario.toLocaleString('pt-BR')}/mês).`,
  });
  return salario;
}

// pedir aumento: chance depende de negociação + tempo de casa
export function pedirAumento(state, rng) {
  const emp = state.personagem.emprego;
  if (!emp) return { ok: false, msg: 'Você não tem emprego.' };
  const meses = state.tempo.mes - (emp.mesInicio ?? 0);
  const chance = clamp(0.15 + (state.personagem.atributos.negociacao - 50) / 160 + meses / 40, 0.05, 0.75);
  if (rng.float() < chance) {
    const g = rng.range([0.06, 0.2]);
    emp.salario = Math.round(emp.salario * (1 + g));
    sincronizarRenda(state);
    return { ok: true, msg: `Aumento aprovado: agora R$ ${emp.salario.toLocaleString('pt-BR')}/mês (+${Math.round(g * 100)}%).` };
  }
  return { ok: false, msg: 'Pedido de aumento negado desta vez.' };
}

// freela / bico: dinheiro na hora
export function freela(state, rng) {
  const base = 400 + (state.personagem.emprego?.salario || 2000) * rng.range([0.15, 0.4]);
  const bonus = 1 + (state.personagem.atributos.disciplina - 50) / 200;
  const valor = Math.round(base * bonus);
  state.financas.pessoal += valor;
  return valor;
}
