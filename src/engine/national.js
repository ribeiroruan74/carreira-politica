// Fase 24 — cenário nacional.
// Um pano de fundo macro que o jogador não controla: eventos econômicos e
// políticos nacionais criam um "clima" (-100 vento de centro-esquerda ..
// +100 vento de centro-direita) que tempera o eleitorado (engine/electorate.js)
// e a popularidade dos partidos.

import nationalDef from '../content/national.json';
import { streamRng, clamp } from './rng';

const EVENTOS = nationalDef.eventos;

export function eventoNacionalAtual(state) {
  return state.mundo?.nacional?.evento || null;
}

export function climaNacional(state) {
  return Math.round(state.mundo?.nacional?.clima || 0);
}

export function rotuloClima(state) {
  const c = climaNacional(state);
  if (c <= -25) return 'Vento forte à esquerda';
  if (c <= -10) return 'Vento à esquerda';
  if (c < 10) return 'Cenário nacional equilibrado';
  if (c < 25) return 'Vento à direita';
  return 'Vento forte à direita';
}

export function tickNacional(s) {
  const eventos = [];
  const nac = (s.mundo.nacional ||= { evento: null, clima: 0, historico: [] });
  nac.historico ||= [];
  const rng = streamRng(s.meta.seed, 'nacional', s.tempo.mes);
  const ev = nac.evento;

  if (ev && s.tempo.mes < ev.fim) {
    // evento em curso: clima converge para o alvo
    nac.clima = clamp(nac.clima + (ev.climaAlvo - nac.clima) * 0.4, -100, 100);
  } else {
    if (ev) {
      nac.historico.unshift({ id: ev.id, mes: ev.mesInicio, fim: ev.fim });
      nac.historico = nac.historico.slice(0, 12);
      nac.evento = null;
    }
    // clima relaxa para zero enquanto não há fato novo
    nac.clima = clamp(nac.clima * 0.8, -100, 100);
    if (Math.abs(nac.clima) < 0.6) nac.clima = 0;

    // chance de um novo fato nacional
    if (rng.chance(0.2)) {
      const recentes = new Set(nac.historico.slice(0, 3).map((h) => h.id));
      const pool = EVENTOS.filter((e) => !recentes.has(e.id));
      const def = rng.pick(pool.length ? pool : EVENTOS);
      const dur = rng.int(def.duracaoMeses[0], def.duracaoMeses[1]);
      nac.evento = {
        id: def.id,
        texto: def.texto,
        climaAlvo: def.clima,
        antipolitica: !!def.antipolitica,
        mesInicio: s.tempo.mes,
        fim: s.tempo.mes + dur,
      };
      nac.clima = clamp(nac.clima + def.clima * 0.35, -100, 100);

      // efeitos imediatos de leve
      if (def.antipolitica) {
        for (const pr of Object.values(s.mundo.partidosRuntime || {})) {
          if (typeof pr.popularidade === 'number') pr.popularidade = clamp(pr.popularidade - rng.range([1, 3]), 0, 100);
        }
        if (s.mandato) s.reputacao.rejeicao = clamp(s.reputacao.rejeicao + rng.range([0.5, 2]), 0, 100);
      }
      if (def.aprovacaoGov) {
        const pref = s.mundo.politicos?.np_joao_campos;
        if (pref && typeof pref.aprovacao === 'number') {
          pref.aprovacao = clamp(pref.aprovacao + def.aprovacaoGov * 0.5, 0, 100);
        }
      }

      s.mundo.noticias.unshift({
        id: `nac_${def.id}_${s.tempo.mes}`, mes: s.tempo.mes, tipo: 'NACIONAL',
        destaque: true, atores: [], texto: def.texto,
      });
      eventos.push({ tipo: 'CIDADE', texto: `Cenário nacional: ${def.texto}` });
    }
  }
  return { eventos };
}
