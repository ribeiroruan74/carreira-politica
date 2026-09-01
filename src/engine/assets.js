// Itens 16/17 — patrimônio empresarial e projetos de legado.
// Empresas dão renda passiva mas oscilam e podem quebrar; setores sensíveis
// (construtora, mídia) geram conflito de interesse enquanto você tem mandato.
// Instituições NÃO dão voto — dão impacto social, reputação e legado, e custam
// manutenção todo mês. Tudo fictício.

import assetsDef from '../content/assets.json';
import { createRng, streamRng, clamp } from './rng';
import { climaNacional } from './national';
import { registrarFato } from './worldMemory';

export const TIPOS_EMPRESA = assetsDef.empresas;
export const TIPOS_INSTITUICAO = assetsDef.instituicoes;
export const empresaDef = (id) => TIPOS_EMPRESA.find((e) => e.id === id) || null;
export const instituicaoDef = (id) => TIPOS_INSTITUICAO.find((i) => i.id === id) || null;

function pagar(state, valor) {
  if (state.financas.pessoal >= valor) { state.financas.pessoal -= valor; return; }
  const resto = valor - state.financas.pessoal;
  state.financas.pessoal = 0;
  state.personagem.patrimonio = Math.max(0, state.personagem.patrimonio - resto);
}
function custoDisponivel(state) {
  return state.financas.pessoal + state.personagem.patrimonio;
}

// ---------- EMPRESAS ----------
export function criarEmpresa(state, tipoId, { comprar = true } = {}) {
  const def = empresaDef(tipoId);
  if (!def) throw new Error('Setor inválido.');
  // "criar" custa 45% do valor mas começa pequena e frágil; "comprar" custa cheio
  const custo = Math.round(def.custo * (comprar ? 1 : 0.45));
  if (custoDisponivel(state) < custo) throw new Error('Capital insuficiente.');
  const rng = createRng(state.meta.seed, state.meta.rngState);
  pagar(state, custo);
  const valor = comprar ? def.custo : Math.round(def.custo * 0.35);
  (state.personagem.empresas ||= []).push({
    id: `emp_${state.tempo.mes}_${rng.int(100, 999)}`,
    tipo: tipoId,
    nome: def.nome,
    valor,
    saude: comprar ? 70 : 55,
    mesInicio: state.tempo.mes,
  });
  state.meta.rngState = rng.state;
  state.personagem.patrimonio += valor; // entra no patrimônio
  state.log.unshift({ mes: state.tempo.mes, tipo: 'FINANCAS', texto: `Você ${comprar ? 'comprou' : 'abriu'} ${comprar ? 'uma' : 'uma pequena'} ${def.nome.toLowerCase()} (${brl(custo)}).` });
  return { ok: true };
}

export function investirEmpresa(state, id, valor) {
  const e = (state.personagem.empresas || []).find((x) => x.id === id);
  if (!e) throw new Error('Empresa não encontrada.');
  valor = Math.round(valor);
  if (valor <= 0) throw new Error('Valor inválido.');
  if (custoDisponivel(state) < valor) throw new Error('Capital insuficiente.');
  pagar(state, valor);
  e.valor += Math.round(valor * 0.9); // parte vira caixa de giro
  e.saude = clamp(e.saude + valor / (empresaDef(e.tipo).custo / 100) * 0.5, 0, 100);
  state.personagem.patrimonio += Math.round(valor * 0.9);
  state.log.unshift({ mes: state.tempo.mes, tipo: 'FINANCAS', texto: `Aporte de ${brl(valor)} em ${e.nome.toLowerCase()}.` });
  return { ok: true };
}

export function venderEmpresa(state, id) {
  const arr = state.personagem.empresas || [];
  const i = arr.findIndex((x) => x.id === id);
  if (i < 0) throw new Error('Empresa não encontrada.');
  const e = arr[i];
  const rng = createRng(state.meta.seed, state.meta.rngState);
  // preço de venda: valor × múltiplo de saúde (0.7–1.05), menos imposto ~6%
  const mult = 0.7 + (e.saude / 100) * 0.35;
  const bruto = Math.round(e.valor * mult);
  const liquido = Math.round(bruto * 0.94);
  arr.splice(i, 1);
  state.personagem.patrimonio = Math.max(0, state.personagem.patrimonio - e.valor);
  state.financas.pessoal += liquido;
  state.meta.rngState = rng.state;
  state.log.unshift({ mes: state.tempo.mes, tipo: 'FINANCAS', texto: `Vendeu ${e.nome.toLowerCase()} por ${brl(liquido)}${liquido < e.valor ? ' (no prejuízo)' : ''}.` });
  return { ok: true, liquido };
}

// ---------- INSTITUIÇÕES ----------
export function fundarInstituicao(state, tipoId, nome) {
  const def = instituicaoDef(tipoId);
  if (!def) throw new Error('Tipo inválido.');
  if (custoDisponivel(state) < def.custo) throw new Error('Capital insuficiente para fundar.');
  pagar(state, def.custo);
  const nomeFinal = (nome || '').trim() || `${def.nome} ${state.personagem.nome}`;
  (state.personagem.instituicoes ||= []).push({
    id: `inst_${state.tempo.mes}_${Math.round(state.tempo.mes * 7 + def.custo % 97)}`,
    tipo: tipoId,
    nome: nomeFinal,
    tema: def.tema,
    nivel: 1,
    impacto: 0, // acumulado de impacto social
    reconhecimento: 5,
    mesFundacao: state.tempo.mes,
    saude: 100, // cai se a manutenção não é paga
  });
  (state.personagem.legado ||= {}).institutosFundados = (state.personagem.legado.institutosFundados || 0) + 1;
  state.reputacao.confianca = clamp(state.reputacao.confianca + 2, 0, 100);
  state.mundo.noticias.unshift({ id: `nt_inst_${state.tempo.mes}`, mes: state.tempo.mes, tipo: 'MIDIA', destaque: true, atores: [], texto: `${state.personagem.nome} fundou o(a) ${nomeFinal}.` });
  state.log.unshift({ mes: state.tempo.mes, tipo: 'MARCO', texto: `Você fundou o(a) ${nomeFinal} (${brl(def.custo)}). Custo de manutenção: ${brl(def.manutencao)}/mês.` });
  return { ok: true };
}

export function ampliarInstituicao(state, id) {
  const inst = (state.personagem.instituicoes || []).find((x) => x.id === id);
  if (!inst) throw new Error('Instituição não encontrada.');
  const def = instituicaoDef(inst.tipo);
  const custo = Math.round(def.custo * 0.6 * inst.nivel);
  if (custoDisponivel(state) < custo) throw new Error('Capital insuficiente para ampliar.');
  pagar(state, custo);
  inst.nivel += 1;
  inst.reconhecimento = clamp(inst.reconhecimento + 8, 0, 100);
  state.log.unshift({ mes: state.tempo.mes, tipo: 'MARCO', texto: `${inst.nome} ampliado(a) para o nível ${inst.nivel}.` });
  return { ok: true };
}

export function fecharInstituicao(state, id) {
  const arr = state.personagem.instituicoes || [];
  const i = arr.findIndex((x) => x.id === id);
  if (i < 0) return { ok: false };
  const inst = arr[i];
  arr.splice(i, 1);
  state.reputacao.rejeicao = clamp(state.reputacao.rejeicao + 2, 0, 100);
  state.mundo.noticias.unshift({ id: `nt_instfim_${state.tempo.mes}`, mes: state.tempo.mes, tipo: 'MIDIA', destaque: false, atores: [], texto: `${inst.nome} encerrou as atividades.` });
  return { ok: true };
}

// ---------- TICK MENSAL ----------
export function tickAssets(s) {
  const eventos = [];
  const p = s.personagem;
  const rng = streamRng(s.meta.seed, 'assets', s.tempo.mes);
  const clima = climaNacional(s) / 100; // -1..1
  const emMandato = !!s.mandato;

  // empresas: valor oscila, paga dividendo, pode quebrar
  for (const e of p.empresas || []) {
    const def = empresaDef(e.tipo);
    if (!def) continue;
    const macro = clima * 0.004 * (def.volat > 0.08 ? 1.4 : 1); // ciclo econômico
    const ruido = rng.gauss(0, def.volat);
    const cresc = def.retornoMensal + macro + ruido - 0.004; // custo estrutural
    const antes = e.valor;
    e.valor = Math.max(0, Math.round(e.valor * (1 + cresc)));
    // saúde reverte devagar para um alvo (55 + 30·retornoRelativo), cai em prejuízo
    const alvo = 50 + (def.retornoMensal - 0.006) / 0.012 * 30;
    e.saude = clamp(e.saude + (alvo - e.saude) * 0.08 + (cresc > 0 ? 1 : -2.2), 0, 100);
    p.patrimonio += e.valor - antes;

    // dividendo escala suave com a saúde
    const fatorDiv = clamp((e.saude - 25) / 75, 0, 1);
    if (fatorDiv > 0) {
      s.financas.pessoal += Math.round(e.valor * def.retornoMensal * 0.55 * fatorDiv);
    }
    // quebra
    if (e.saude <= 3 || e.valor < def.custo * 0.12) {
      p.patrimonio = Math.max(0, p.patrimonio - e.valor);
      eventos.push({ tipo: 'ALERTA', texto: `${e.nome} quebrou. Você perdeu o que tinha nela.` });
      e._morta = true;
    }
    // conflito de interesse enquanto no mandato
    if (emMandato && def.conflito && rng.chance(0.02 + e.valor / def.custo * 0.01)) {
      registrarFato(s, {
        tipo: 'CONFLITO_INTERESSE',
        texto: `${p.nome} mantém ${e.nome.toLowerCase()} enquanto exerce mandato — possível conflito com ${def.conflito}.`,
        gatilho: 'imprensa',
      });
      s.reputacao.rejeicao = clamp(s.reputacao.rejeicao + rng.range([1, 3]), 0, 100);
      eventos.push({ tipo: 'ALERTA', texto: `A imprensa começou a olhar para ${e.nome.toLowerCase()} e seu mandato.` });
    }
  }
  if (p.empresas) p.empresas = p.empresas.filter((e) => !e._morta);

  // instituições: manutenção sai do bolso; se paga, cresce impacto/reconhecimento
  for (const inst of p.instituicoes || []) {
    const def = instituicaoDef(inst.tipo);
    if (!def) continue;
    const manut = def.manutencao * inst.nivel;
    if (s.financas.pessoal >= manut) {
      s.financas.pessoal -= manut;
      inst.saude = clamp(inst.saude + 1.5, 0, 100);
      const dImp = def.impactoBase * inst.nivel * (0.7 + inst.saude / 300) * 4;
      inst.impacto += dImp;
      inst.reconhecimento = clamp(inst.reconhecimento + 0.4 + inst.nivel * 0.1, 0, 100);
      (p.legado ||= {}).impactoSocial = (p.legado.impactoSocial || 0) + dImp;
      // reputação: confiança sobe devagar; nunca vira voto direto
      if (rng.chance(0.5)) s.reputacao.confianca = clamp(s.reputacao.confianca + rng.range([0.1, 0.4]), 0, 100);
      // notícia ocasional
      if (rng.chance(0.06)) {
        eventos.push({ tipo: 'INFO', texto: `${inst.nome} vem entregando resultado — bom para a sua imagem de longo prazo.` });
      }
    } else {
      inst.saude = clamp(inst.saude - rng.range([4, 9]), 0, 100);
      if (inst.saude <= 0) {
        eventos.push({ tipo: 'ALERTA', texto: `${inst.nome} fechou por falta de recursos.` });
        inst._morta = true;
      } else if (rng.chance(0.2)) {
        eventos.push({ tipo: 'ALERTA', texto: `${inst.nome} está sem verba de manutenção — a qualidade caiu.` });
      }
    }
  }
  if (p.instituicoes) {
    const fechadas = p.instituicoes.filter((x) => x._morta).length;
    if (fechadas) s.reputacao.rejeicao = clamp(s.reputacao.rejeicao + fechadas * rng.range([1, 3]), 0, 100);
    p.instituicoes = p.instituicoes.filter((x) => !x._morta);
  }

  tickInvestimento(p, rng);

  return { eventos };
}

// ---------- Item 21 — INVESTIMENTO FINANCEIRO PASSIVO ----------
// Complementa as empresas: não precisa administrar, só escolhe o perfil de
// risco. Conservador rende pouco e quase não oscila; agressivo rende mais mas
// pode perder dinheiro de verdade em mês ruim. Sem magia: teto de retorno baixo.
export const PERFIS_INVESTIMENTO = [
  { id: 'conservador', nome: 'Conservador', retorno: 0.006, volat: 0.006 },
  { id: 'moderado', nome: 'Moderado', retorno: 0.009, volat: 0.02 },
  { id: 'agressivo', nome: 'Agressivo', retorno: 0.013, volat: 0.045 },
];
export function perfilInvestimento(id) {
  return PERFIS_INVESTIMENTO.find((p) => p.id === id) || PERFIS_INVESTIMENTO[0];
}

function investState(state) {
  return (state.personagem.investimentos ||= { valor: 0, perfil: 'conservador' });
}

export function aportarInvestimento(state, valor) {
  valor = Math.round(valor);
  if (valor <= 0) throw new Error('Valor inválido.');
  if (state.financas.pessoal < valor) throw new Error('Saldo pessoal insuficiente.');
  state.financas.pessoal -= valor;
  investState(state).valor += valor;
  state.personagem.patrimonio += valor;
  state.log.unshift({ mes: state.tempo.mes, tipo: 'FINANCAS', texto: `Aportou ${brl(valor)} em investimentos.` });
  return { ok: true };
}

export function resgatarInvestimento(state, valor) {
  const inv = investState(state);
  valor = Math.round(valor);
  if (valor <= 0 || valor > inv.valor) throw new Error('Valor inválido.');
  inv.valor -= valor;
  state.personagem.patrimonio = Math.max(0, state.personagem.patrimonio - valor);
  state.financas.pessoal += valor;
  state.log.unshift({ mes: state.tempo.mes, tipo: 'FINANCAS', texto: `Resgatou ${brl(valor)} dos investimentos.` });
  return { ok: true };
}

export function definirPerfilInvestimento(state, perfilId) {
  if (!PERFIS_INVESTIMENTO.some((p) => p.id === perfilId)) throw new Error('Perfil inválido.');
  investState(state).perfil = perfilId;
  return { ok: true };
}

function tickInvestimento(p, rng) {
  const inv = p.investimentos;
  if (!inv || inv.valor <= 0) return;
  const perfil = perfilInvestimento(inv.perfil);
  const variacao = perfil.retorno + rng.gauss(0, perfil.volat);
  const antes = inv.valor;
  inv.valor = Math.max(0, Math.round(inv.valor * (1 + variacao)));
  p.patrimonio += inv.valor - antes;
}

// leitura para UI
export function resumoPatrimonio(state) {
  const emp = state.personagem.empresas || [];
  const inst = state.personagem.instituicoes || [];
  return {
    valorEmpresas: emp.reduce((s, e) => s + e.valor, 0),
    rendaPassivaEst: emp.reduce((s, e) => {
      const d = empresaDef(e.tipo);
      return s + (e.saude > 45 && d ? Math.round(e.valor * d.retornoMensal * 0.6 * (e.saude / 100)) : 0);
    }, 0),
    manutencaoInst: inst.reduce((s, i) => s + (instituicaoDef(i.tipo)?.manutencao || 0) * i.nivel, 0),
    impactoSocial: Math.round(state.personagem.legado?.impactoSocial || 0),
    valorInvestido: state.personagem.investimentos?.valor || 0,
  };
}

function brl(v) {
  return `R$ ${Math.round(v).toLocaleString('pt-BR')}`;
}
