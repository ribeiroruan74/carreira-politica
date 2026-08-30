import { streamRng, clamp } from './rng';
import partiesDef from '../content/parties.json';

// ============================================================
// FASE 20 — Coligações e federações
// Federações andam sempre juntas. As demais siglas se agrupam por
// ideologia numa coligação por eleição. Isso muda o quociente: os
// votos de toda a coligação contam juntos, e um nanico entra "de
// carona" numa legenda forte.
// ============================================================

const PARTIDOS = partiesDef.partidos;
const P = (id) => PARTIDOS.find((x) => x.id === id) || PARTIDOS[0];

// Forma as coligações para uma eleição. Determinístico por eleição.
// Devolve { deColigacao:{ partidoId -> coligacaoId }, nomes:{ colId -> nome }, membros:{ colId -> [pid] } }.
export function formarColigacoes(state) {
  const rng = streamRng(state.meta.seed, 'colig', state.eleicao?.id || state.tempo.mes);
  const deColigacao = {};
  const membros = {};
  const nomes = {};

  // 1) federações são blocos fixos
  for (const f of partiesDef.federacoes || []) {
    const membrosFed = PARTIDOS.filter((p) => p.federacao === f.id).map((p) => p.id);
    if (membrosFed.length) {
      membros[f.id] = membrosFed;
      nomes[f.id] = f.nome;
      for (const pid of membrosFed) deColigacao[pid] = f.id;
    }
  }

  // 2) âncoras: os maiores partidos ainda sem coligação
  const livres = PARTIDOS.filter((p) => !deColigacao[p.id]);
  const ancoras = [...livres].sort((a, b) => (b.tamanho + b.forcaRecife) - (a.tamanho + a.forcaRecife))
    .slice(0, rng.int(4, 6));

  for (const a of ancoras) {
    const cid = `col_${a.id}`;
    membros[cid] = [a.id];
    deColigacao[a.id] = cid;
    nomes[cid] = null; // preenchido no fim
  }

  // 3) os pequenos se juntam à âncora ideologicamente mais próxima
  //    (às vezes sozinhos)
  for (const p of livres) {
    if (deColigacao[p.id]) continue;
    if (rng.chance(0.22)) { // corre isolado
      const cid = `col_solo_${p.id}`;
      membros[cid] = [p.id];
      deColigacao[p.id] = cid;
      nomes[cid] = `${p.nome} (isolado)`;
      continue;
    }
    let melhor = null; let melhorDist = Infinity;
    for (const a of ancoras) {
      const d = Math.abs(a.eixo - p.eixo) + Math.abs((a.eixoSocial ?? a.eixo) - (p.eixoSocial ?? p.eixo)) * 0.5;
      if (d < melhorDist && d < 90) { melhorDist = d; melhor = a; }
    }
    if (melhor) {
      const cid = deColigacao[melhor.id];
      membros[cid].push(p.id);
      deColigacao[p.id] = cid;
    } else {
      const cid = `col_solo_${p.id}`;
      membros[cid] = [p.id];
      deColigacao[p.id] = cid;
      nomes[cid] = `${p.nome} (isolado)`;
    }
  }

  // 4) nomes de coligação a partir das siglas
  for (const [cid, pids] of Object.entries(membros)) {
    if (nomes[cid]) continue;
    nomes[cid] = pids.length === 1 ? P(pids[0]).nome : pids.join(' / ');
  }

  return { deColigacao, nomes, membros };
}

export function coligacaoDoPartido(coligacoes, partidoId) {
  return coligacoes?.deColigacao?.[partidoId] || partidoId;
}

// força relativa da coligação do jogador (bônus leve no modelo de votos:
// eleitor de legenda tende a votar na coligação, não só no partido)
export function forcaColigacaoDoJogador(state) {
  const cs = state.eleicao?.coligacoes;
  const pid = state.personagem.partidoId;
  if (!cs || !pid) return 0;
  const cid = coligacaoDoPartido(cs, pid);
  const pids = cs.membros[cid] || [pid];
  const soma = pids.reduce((s, x) => s + P(x).forcaRecife + P(x).tamanho * 0.4, 0);
  return clamp((soma / pids.length - 40) / 100, -0.3, 0.5);
}
