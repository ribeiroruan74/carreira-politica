// Item 10 — telefonemas. Ligar para jornalistas e famosos (fictícios). Cada
// ligação rola: não atende / pede pra ligar depois / conversa / encontro /
// oportunidade / esfria. Nada disso dá voto — dá relação, alcance, repercussão,
// e às vezes um convite de entrevista. Ninguém vira aliado fácil.

import famososDef from '../content/famosos.json';
import { JORNALISTAS, veiculo } from './press';
import { relevanciaMidiatica } from './social';
import { createRng, clamp } from './rng';

const FAMOSOS = famososDef.famosos;
export function famosoDef(id) { return FAMOSOS.find((f) => f.id === id) || null; }

function tel(state) {
  return (state.mundo.telefone ||= { relacoes: {}, cooldown: {} });
}
export function relTelefone(state, id) {
  return Math.round((tel(state).relacoes[id]) || 0);
}
function ajustarRel(state, id, d) {
  const t = tel(state);
  const atual = t.relacoes[id] || 0;
  // ganhos rendem menos quando a relação já está alta (não vira aliado fácil)
  const dEfetivo = d > 0 ? d * clamp(1 - atual / 110, 0.15, 1) : d;
  t.relacoes[id] = clamp(atual + dEfetivo, -100, 90);
}

function chanceAtender(state, acessibilidade, rel) {
  const rel0 = relevanciaMidiatica(state);
  return clamp(
    acessibilidade / 200 + rel / 150 + (state.reputacao.notoriedade - 32) / 240 + (rel0 - 30) / 300,
    0.05, 0.9,
  );
}

// lista de contatos telefonáveis, por categoria
export function contatosTelefone(state) {
  const m = state.tempo.mes;
  const mk = (id, nome, tipo, sub, alcance, acess) => ({
    id, nome, tipo, sub, alcance,
    rel: relTelefone(state, id),
    chance: Math.round(chanceAtender(state, acess, relTelefone(state, id)) * 100),
    cooldownAte: tel(state).cooldown[id] || 0,
    prontos: (tel(state).cooldown[id] || 0) <= m,
  });
  return {
    midia: JORNALISTAS.map((j) => {
      const v = veiculo(j.veiculo);
      return mk(j.id, j.nome, 'jornalista', `${v?.nome || 'imprensa'} · ${j.cargo}`, v?.alcance ?? 50, 100 - (j.rigor ?? 55) * 0.4);
    }),
    famosos: FAMOSOS.map((f) => mk(f.id, f.nome, f.tipo, f.genero, f.alcance, f.acessibilidade)),
  };
}

function acharContato(id) {
  const j = JORNALISTAS.find((x) => x.id === id);
  if (j) { const v = veiculo(j.veiculo); return { kind: 'jornalista', nome: j.nome, alcance: v?.alcance ?? 50, acess: 100 - (j.rigor ?? 55) * 0.4, ref: j }; }
  const f = famosoDef(id);
  if (f) return { kind: 'famoso', nome: f.nome, alcance: f.alcance, acess: f.acessibilidade, ref: f };
  return null;
}

// wrapper de UI: gerencia rng + custo de tempo
export function ligar(state, id) {
  if ((state.tempo.energia ?? 0) < 1) throw new Error('Sem tempo este mês.');
  const c = acharContato(id);
  if (!c) throw new Error('Contato não encontrado.');
  const t = tel(state);
  const m = state.tempo.mes;
  if ((t.cooldown[id] || 0) > m) throw new Error(`${c.nome} pediu para ligar depois — tente no mês ${t.cooldown[id]}.`);

  const rng = createRng(state.meta.seed, state.meta.rngState);
  state.tempo.energia -= 1;
  const rel = t.relacoes[id] || 0;

  let desfecho; let msg;
  if (!rng.chance(chanceAtender(state, c.acess, rel))) {
    if (rng.chance(0.5)) {
      t.cooldown[id] = m + rng.int(2, 4);
      desfecho = 'liga_depois';
      msg = `${c.nome} não pôde falar agora — "me liga depois". (indisponível até o mês ${t.cooldown[id]})`;
    } else {
      ajustarRel(state, id, rng.range([-2, 0]));
      desfecho = 'recusa';
      msg = `${c.nome} não atendeu.`;
    }
  } else {
    // atendeu — desfecho pesa com a relação atual
    const r = rng.float();
    const bom = clamp(0.2 + rel / 140, 0.1, 0.75);
    if (r < 0.12 && rel < 15) {
      ajustarRel(state, id, rng.range([-4, -1]));
      desfecho = 'fria';
      msg = `Ligação fria. ${c.nome} foi seco e cortou rápido.`;
    } else if (r < bom * 0.55) {
      ajustarRel(state, id, rng.range([3, 7]));
      desfecho = 'conversa';
      msg = `Boa conversa com ${c.nome}. Relação em ${relTelefone(state, id)}.`;
    } else if (r < bom) {
      ajustarRel(state, id, rng.range([7, 14]));
      state.reputacao.notoriedade = clamp(state.reputacao.notoriedade + rng.range([0.5, 2]), 0, 100);
      desfecho = 'encontro';
      msg = `${c.nome} topou marcar um encontro. Relação em ${relTelefone(state, id)}.`;
    } else {
      // oportunidade
      ajustarRel(state, id, rng.range([4, 9]));
      const alc = c.alcance / 100;
      if (c.kind === 'jornalista' && rng.chance(0.55)) {
        state.mundo.convitesMidia = state.mundo.convitesMidia || [];
        if (!state.mundo.convitesMidia.some((x) => x.refId === id)) {
          state.mundo.convitesMidia.push({ id: `cv_${id}_${m}`, tipo: 'entrevista', refId: id, criadoMes: m, expiraMes: m + 3 });
        }
        desfecho = 'entrevista';
        msg = `${c.nome} quer te entrevistar — convite na Imprensa.`;
      } else {
        const dSeg = Math.round(state.redes.seguidores * rng.range([0.004, 0.02]) * (0.5 + alc)) + rng.int(40, 200);
        state.redes.seguidores += dSeg;
        state.reputacao.ecoMidiatico = clamp(state.reputacao.ecoMidiatico + rng.range([3, 9]) * (0.5 + alc), -50, 100);
        state.reputacao.notoriedade = clamp(state.reputacao.notoriedade + rng.range([1, 3]) * (0.5 + alc), 0, 100);
        desfecho = 'oportunidade';
        msg = `${c.nome} te deu um espaço — +${dSeg} seguidores e repercussão.`;
        state.mundo.noticias.unshift({ id: `nt_tel_${id}_${m}`, mes: m, tipo: 'MIDIA', destaque: false, atores: [], texto: `${state.personagem.nome} apareceu com ${c.nome}.` });
      }
    }
  }

  state.meta.rngState = rng.state;
  state.log.unshift({ mes: m, tipo: 'ACAO', texto: `Ligação para ${c.nome} — ${desfecho.replace('_', ' ')}.` });
  return { ok: true, atendeu: !['recusa', 'liga_depois'].includes(desfecho), desfecho, msg };
}

// decaimento lento das relações + limpeza de cooldown
export function tickTelefone(s) {
  const t = s.mundo.telefone;
  if (!t) return;
  for (const k of Object.keys(t.relacoes)) {
    t.relacoes[k] *= 0.97;
    if (Math.abs(t.relacoes[k]) < 1) delete t.relacoes[k];
  }
  for (const k of Object.keys(t.cooldown)) {
    if (t.cooldown[k] <= s.tempo.mes) delete t.cooldown[k];
  }
}
