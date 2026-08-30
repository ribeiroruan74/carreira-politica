// Fase 23 — militância por bairro.
// personagem.militancia = { bairroId: nVoluntarios }. Voluntários mantêm a sua
// presença viva num bairro mesmo quando você não está lá, e ampliam o efeito de
// campanha. Sem cuidado, o núcleo esvazia.

import neighborhoods from '../content/neighborhoods/recife.json';
import { streamRng, clamp } from './rng';

const BAIRROS = neighborhoods.bairros;
const nomeBairro = (id) => BAIRROS.find((b) => b.id === id)?.nome || id;

export function totalMilitantes(state) {
  return Object.values(state.personagem?.militancia || {}).reduce((s, n) => s + n, 0);
}

export function militanciaResumo(state) {
  return Object.entries(state.personagem?.militancia || {})
    .filter(([, n]) => n >= 1)
    .map(([id, n]) => ({ id, nome: nomeBairro(id), voluntarios: Math.round(n) }))
    .sort((a, b) => b.voluntarios - a.voluntarios);
}

// Recrutamento ativo (chamado por um efeito de ação).
export function recrutarMilitancia(state, rng, bairroId) {
  const bid = bairroId || bairroForte(state);
  if (!bid) return { bid: null, ganho: 0 };
  const p = state.personagem;
  const car = p.atributos.carisma || 50;
  const lid = p.atributos.lideranca || 50;
  const presenca = state.territorio.porBairro[bid]?.presenca || 0;
  const aprov = state.reputacao.aprovacao || 50;
  const ganho = clamp(
    2 + (car - 50) / 18 + (lid - 50) / 22 + presenca / 30 + (aprov - 50) / 25 + rng.range([-1, 2]),
    0, 14,
  );
  const mil = (p.militancia ||= {});
  mil[bid] = (mil[bid] || 0) + ganho;
  return { bid, ganho: Math.round(ganho) };
}

function bairroForte(state) {
  let melhor = null; let val = -1;
  for (const [bid, t] of Object.entries(state.territorio.porBairro)) {
    if (t.presenca > val) { val = t.presenca; melhor = bid; }
  }
  return melhor;
}

// Multiplicador de campanha/território por causa da militância local (1.0 a ~1.6).
export function bonusMilitancia(state, bairroId) {
  const n = state.personagem?.militancia?.[bairroId] || 0;
  return 1 + clamp(n / 40, 0, 0.6);
}

export function tickMilitancia(s) {
  const eventos = [];
  const mil = s.personagem?.militancia;
  if (!mil) return { eventos };
  const rng = streamRng(s.meta.seed, 'militancia', s.tempo.mes);
  const emCampanha = s.personagem.fase === 'CANDIDATO';
  const aprov = s.reputacao.aprovacao || 50;

  for (const bid of Object.keys(mil)) {
    let n = mil[bid];
    if (n < 1) { delete mil[bid]; continue; }

    // presença passiva sustentada pelos voluntários
    const t = (s.territorio.porBairro[bid] ||= { presenca: 0, penetracao: 0 });
    const empurrao = n * (emCampanha ? 0.09 : 0.05);
    t.presenca = clamp(t.presenca + empurrao, 0, 100);
    if (rng.chance(0.3)) t.penetracao = clamp(t.penetracao + n * 0.02, 0, 100);

    // dinâmica do núcleo: cresce com aprovação alta, encolhe por atrito
    n *= 0.97;
    if (aprov > 55 && rng.chance(0.25)) n += rng.range([0.5, 2]);
    if (aprov < 38 && rng.chance(0.3)) n -= rng.range([0.5, 2.5]);
    mil[bid] = clamp(n, 0, 200);
  }

  const total = totalMilitantes(s);
  if (total >= 60 && s.tempo.mes % 6 === 0) {
    eventos.push({ tipo: 'MARCO', texto: `Sua militância já soma ${Math.round(total)} voluntários ativos nos bairros.` });
  }
  return { eventos };
}
