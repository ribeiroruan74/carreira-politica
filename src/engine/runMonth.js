import { runTick } from './tick';
import { worldTick } from './world';
import { mandateTick } from './mandate';
import { tickEleicao } from './election';
import { sortearEvento } from './events';
import { tickMemoria, tickInvestigacaoProativa } from './worldMemory';
import { tickCascatas } from './cascade';
import { tickCalendario } from './calendar';
import { tickNacional } from './national';
import { tickEleitorado } from './electorate';
import { tickDoadores } from './donors';
import { tickMilitancia } from './militancy';
import { tickVidaPessoal } from './personal';
import { tickInfluenciadores } from './influencers';
import { tickMarcos } from './milestones';
import { checarConquistas } from './achievements';

// Roda 1 mês sobre `s` (MUTA o objeto). É a única definição do pipeline mensal —
// usada tanto pelo store (com clone antes) quanto pelo harness de simulação.
export function runMonth(s) {
  const eventos = [];
  const push = (r) => { if (r?.eventos?.length) eventos.push(...r.eventos); };

  push(runTick(s));
  push(worldTick(s));
  push(tickCalendario(s));          // Fase 6 — o ciclo eleitoral acontece à revelia do jogador
  push(tickInvestigacaoProativa(s)); // Fase 10 — a imprensa vai atrás sozinha
  push(tickMemoria(s));             // Fase 2 — fatos antigos que voltam
  push(tickCascatas(s));            // Fase 31 — cascatas de narrativa em andamento
  push(tickNacional(s));            // Fase 24 — cenário nacional
  push(tickEleitorado(s));          // Fase 8 — satisfação dos grupos sociais
  push(tickDoadores(s));            // Fase 17 — financiamento rastreado
  push(tickMilitancia(s));          // Fase 23 — militância por bairro
  push(tickVidaPessoal(s));         // Fase 22 — vida pessoal
  push(tickInfluenciadores(s));     // Fase 15/16 — mercado de influência
  push(mandateTick(s));
  push(tickEleicao(s));

  // uma crise/oportunidade para o mês (não durante a apuração)
  let crise = null;
  if (s.eleicao?.status !== 'APURADO' && !s.eventoPendente) {
    crise = sortearEvento(s);
    if (crise) s.eventoPendente = crise;
  }

  push(tickMarcos(s));              // Fase 28 — anota marcos derivados do log
  push(checarConquistas(s));        // Fase 27 — desbloqueia conquistas

  return { state: s, eventos, crise };
}
