// Etapa 11 — Família.
// Vida pessoal jogável: pais, parceiro(a), namoro, casamento, filhos. Evolui com
// o tempo e afeta energia, bem-estar, saúde e — de leve — a imagem pública.
// Não é um simulador de relacionamento: tudo é derivado de poucos números.

import { createRng, streamRng, clamp } from './rng';
import { ajustarImagem } from './image';
import { registrarMarco } from './milestones';

const NOMES = ['Ana', 'Bruno', 'Carla', 'Diego', 'Elena', 'Fábio', 'Lia', 'Rafa', 'Sofia', 'Téo', 'Marina', 'Caio', 'Bia', 'Léo', 'Nina'];

export function estadoFamilia(state) {
  const v = state.personagem.vida || {};
  return {
    estadoCivil: v.estadoCivil || 'solteiro',
    conjuge: v.conjuge || null,
    filhos: v.filhos || 0,
    filhosDetalhe: v.filhosDetalhe || [],
    saude: v.saude ?? 100,
    bemEstar: Math.round(v.bemEstar ?? 60),
    paisRelacao: Math.round(v.paisRelacao ?? 55),
    paisVivos: v.paisVivos ?? true,
    hobby: v.hobby || null,
  };
}

function vida(state) {
  return (state.personagem.vida ||= { estadoCivil: 'solteiro', conjuge: null, filhos: 0, filhosDetalhe: [], saude: 100, bemEstar: 60, paisRelacao: 55, paisVivos: true });
}
function gasta(state, tempo, energia, dinheiro = 0) {
  if (state.tempo.pontosRestantes < tempo) throw new Error(`Sem tempo (custa ${tempo}).`);
  if (dinheiro > state.financas.pessoal) throw new Error('Dinheiro pessoal insuficiente.');
  state.tempo.pontosRestantes -= tempo;
  state.tempo.energia = clamp(state.tempo.energia - energia, 0, state.tempo.energiaMax);
  state.financas.pessoal -= dinheiro;
}
function log(state, texto) {
  state.log.unshift({ mes: state.tempo.mes, tipo: 'PESSOAL', texto });
}

// ── ações do jogador ────────────────────────────────────────────────────────
// Cada ação gerencia o próprio rng (padrão de world.acaoRelacao). A UI chama só
// com o state; `acaoFamilia(state, fn)` embrulha custo/rng/persistência.

export function acaoFamilia(state, nome) {
  const fn = ACOES[nome];
  if (!fn) throw new Error('Ação de família inválida.');
  const rng = createRng(state.meta.seed, state.meta.rngState);
  const r = fn(state, rng);
  state.meta.rngState = rng.state;
  return r;
}

export function visitarPais(state, rng) {
  const v = vida(state);
  if (!v.paisVivos) return { ok: false, msg: 'Seus pais já se foram.' };
  gasta(state, 1, 5);
  v.paisRelacao = clamp(v.paisRelacao + rng.range([4, 9]), 0, 100);
  v.bemEstar = clamp(v.bemEstar + rng.range([2, 5]), 0, 100);
  state.tempo.energia = clamp(state.tempo.energia + rng.range([2, 6]), 0, state.tempo.energiaMax);
  return { ok: true, msg: `Você visitou a família de origem. Relação com os pais: ${Math.round(v.paisRelacao)}.` };
}

export function conhecerAlguem(state, rng) {
  const v = vida(state);
  if (v.estadoCivil !== 'solteiro') return { ok: false, msg: 'Você não está solteiro(a).' };
  gasta(state, 2, 8, 150);
  const car = state.personagem.atributos.carisma || 50;
  if (!rng.chance(0.4 + (car - 50) / 200)) {
    return { ok: false, msg: 'Não rolou química desta vez.' };
  }
  v.estadoCivil = 'namorando';
  v.conjuge = { nome: rng.pick(NOMES), relacao: rng.int(30, 45), desdeMes: state.tempo.mes };
  v.bemEstar = clamp(v.bemEstar + rng.range([4, 9]), 0, 100);
  log(state, `Você começou a namorar ${v.conjuge.nome}.`);
  return { ok: true, msg: `Você e ${v.conjuge.nome} começaram a namorar.` };
}

export function tempoComParceiro(state, rng) {
  const v = vida(state);
  if (!v.conjuge) return { ok: false, msg: 'Você não tem parceiro(a).' };
  gasta(state, 1, 4);
  v.conjuge.relacao = clamp(v.conjuge.relacao + rng.range([4, 9]), 0, 100);
  v.bemEstar = clamp(v.bemEstar + rng.range([3, 6]), 0, 100);
  state.tempo.energia = clamp(state.tempo.energia + rng.range([2, 5]), 0, state.tempo.energiaMax);
  return { ok: true, msg: `${v.conjuge.nome}: relação ${Math.round(v.conjuge.relacao)}.` };
}

export function casar(state) {
  const v = vida(state);
  if (v.estadoCivil !== 'namorando' || !v.conjuge) return { ok: false, msg: 'Você precisa estar namorando.' };
  if (v.conjuge.relacao < 58) return { ok: false, msg: `A relação com ${v.conjuge.nome} ainda não está madura (${Math.round(v.conjuge.relacao)}/58).` };
  gasta(state, 2, 10, 4000);
  v.estadoCivil = 'casado';
  v.conjuge.relacao = clamp(v.conjuge.relacao + 6, 0, 100);
  v.conjuge.casadoDesdeMes = state.tempo.mes;
  v.bemEstar = clamp(v.bemEstar + 12, 0, 100);
  ajustarImagem(state, { proximidade: 4 });
  registrarMarco(state, 'CARREIRA', `Casou-se com ${v.conjuge.nome}.`);
  log(state, `Você se casou com ${v.conjuge.nome}. A imagem de vida estável ajuda.`);
  return { ok: true, msg: `Você se casou com ${v.conjuge.nome}.` };
}

export function tentarFilho(state, rng) {
  const v = vida(state);
  if (v.estadoCivil !== 'casado') return { ok: false, msg: 'Ter filho biológico pede um casamento.' };
  if (v.filhos >= 4) return { ok: false, msg: 'A família já está grande.' };
  gasta(state, 1, 6);
  const chance = clamp(0.35 - v.filhos * 0.05 - Math.max(0, state.personagem.idade - 38) * 0.02, 0.08, 0.4);
  if (!rng.chance(chance)) return { ok: true, msg: 'Ainda não desta vez.' };
  nascerFilho(state, rng, 'biológico');
  return { ok: true, msg: 'Vocês vão ter um bebê!' };
}

export function adotar(state, rng) {
  const v = vida(state);
  if (v.estadoCivil === 'solteiro') return { ok: false, msg: 'Adoção pede pelo menos um relacionamento estável.' };
  if (v.filhos >= 4) return { ok: false, msg: 'A família já está grande.' };
  gasta(state, 2, 8, 2000);
  nascerFilho(state, rng, 'adoção');
  return { ok: true, msg: 'O processo de adoção foi concluído. Bem-vindo à família!' };
}

function nascerFilho(state, rng, via) {
  const v = vida(state);
  v.filhos += 1;
  v.filhosDetalhe = [...(v.filhosDetalhe || []), { nome: rng.pick(NOMES), nascidoMes: state.tempo.mes, via }];
  v.bemEstar = clamp(v.bemEstar + rng.range([8, 14]), 0, 100);
  state.tempo.energia = clamp(state.tempo.energia - rng.range([8, 16]), 0, state.tempo.energiaMax);
  ajustarImagem(state, { proximidade: 3 });
  registrarMarco(state, 'CARREIRA', via === 'adoção' ? 'Adotou uma criança.' : 'Teve um filho.');
  log(state, via === 'adoção' ? 'Sua família cresceu por adoção.' : 'Nasceu mais um filho. Noites mal dormidas — e uma foto de família que rende bem.');
}

export function tempoEmFamilia(state, rng) {
  const v = vida(state);
  if (!v.conjuge && !v.filhos && (!v.paisVivos)) return { ok: false, msg: 'Você não tem com quem passar esse tempo agora.' };
  gasta(state, 2, 4);
  v.bemEstar = clamp(v.bemEstar + rng.range([5, 10]), 0, 100);
  v.saude = clamp(v.saude + rng.range([2, 5]), 0, 100);
  state.tempo.energia = clamp(state.tempo.energia + rng.range([5, 12]), 0, state.tempo.energiaMax);
  if (v.conjuge) v.conjuge.relacao = clamp(v.conjuge.relacao + rng.range([2, 5]), 0, 100);
  if (v.paisVivos) v.paisRelacao = clamp(v.paisRelacao + rng.range([1, 3]), 0, 100);
  return { ok: true, msg: 'Um tempo bom longe da política. Bem-estar recuperado.' };
}

const ACOES = {
  visitarPais, conhecerAlguem, tempoComParceiro, casar, tentarFilho, adotar, tempoEmFamilia,
};

// ── tick mensal ─────────────────────────────────────────────────────────────

export function tickFamilia(s) {
  const eventos = [];
  const v = vida(s);
  const rng = streamRng(s.meta.seed, 'familia', s.tempo.mes);

  // relação com parceiro esfria sem atenção; bem-estar converge para um alvo
  // que depende da situação familiar
  if (v.conjuge) {
    v.conjuge.relacao = clamp(v.conjuge.relacao - rng.range([0.6, 1.6]), 0, 100);
  }
  if (v.paisVivos) v.paisRelacao = clamp(v.paisRelacao - rng.range([0.3, 0.9]), 0, 100);

  let alvoBem = 45;
  if (v.estadoCivil === 'casado') alvoBem += 12 + (v.conjuge.relacao - 50) * 0.25;
  else if (v.estadoCivil === 'namorando') alvoBem += 6 + (v.conjuge.relacao - 40) * 0.2;
  alvoBem += Math.min(3, v.filhos) * 3;
  alvoBem += (v.paisRelacao - 50) * 0.08;
  alvoBem += (v.saude - 60) * 0.15;
  alvoBem += v.hobby ? 3 : 0;
  v.bemEstar = clamp(v.bemEstar + (alvoBem - v.bemEstar) * 0.12 + rng.range([-1, 1]), 0, 100);
  // (energiaMax é calculado em personal.js a partir de saúde + bem-estar)

  // vida em frangalhos vaza para a imagem pública
  if (v.bemEstar < 22 && s.tempo.mes % 3 === 0) {
    s.reputacao.aprovacao = clamp(s.reputacao.aprovacao - rng.range([0.5, 1.5]), 0, 100);
    eventos.push({ tipo: 'ALERTA', texto: `Sua vida pessoal está em crise (bem-estar ${Math.round(v.bemEstar)}). Isso começa a aparecer.` });
  } else if (v.bemEstar > 78 && v.estadoCivil === 'casado' && s.tempo.mes % 6 === 0) {
    ajustarImagem(s, { proximidade: 1 });
  }

  // eventos de família — raros
  if (rng.chance(0.05)) {
    const ev = sortearEvento(s, v, rng);
    if (ev) {
      eventos.push({ tipo: ev.marco ? 'MARCO' : 'CIDADE', texto: ev.texto });
      log(s, ev.texto);
    }
  }
  return { eventos };
}

function sortearEvento(s, v, rng) {
  const pool = [];

  if (v.paisVivos && s.personagem.idade >= 50 && rng.chance(0.15)) {
    pool.push(() => {
      v.paisVivos = false;
      v.bemEstar = clamp(v.bemEstar - rng.range([12, 22]), 0, 100);
      return { texto: 'Você perdeu um dos seus pais. Um baque.', marco: true };
    });
  }
  if (v.conjuge && v.conjuge.relacao < 30 && rng.chance(0.4)) {
    pool.push(() => {
      const q = v.estadoCivil === 'casado';
      const nome = v.conjuge.nome;
      v.estadoCivil = 'solteiro';
      v.conjuge = null;
      v.bemEstar = clamp(v.bemEstar - rng.range([10, 20]), 0, 100);
      if (q) ajustarImagem(s, { proximidade: -3 });
      return { texto: q ? `Seu casamento com ${nome} chegou ao fim.` : `Você e ${nome} terminaram.`, marco: q };
    });
  }
  if (v.filhos > 0 && rng.chance(0.5)) {
    pool.push(() => {
      const bom = rng.chance(0.6);
      if (bom) { v.bemEstar = clamp(v.bemEstar + rng.range([3, 8]), 0, 100); return { texto: 'Um marco bom na vida de um dos seus filhos.' }; }
      v.saude = clamp(v.saude - rng.range([4, 9]), 0, 100);
      return { texto: 'Um problema com um dos filhos consumiu seu tempo e sua cabeça.' };
    });
  }
  pool.push(() => {
    v.saude = clamp(v.saude - rng.range([5, 12]), 0, 100);
    return { texto: 'Um problema de saúde na família tirou você de circulação por uns dias.' };
  });

  return pool.length ? rng.pick(pool)() : null;
}
