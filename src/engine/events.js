import { createRng, streamRng, clamp } from './rng';
import { semear, nomeBairro } from './cascade';
import { registrarFato } from './worldMemory';
import { resolverCobrancaDoador } from './donors';
import crisesDef from '../content/crises.json';
import neighborhoods from '../content/neighborhoods/recife.json';

const BAIRROS = neighborhoods.bairros;

// meses de maior chuva no Recife (mai-ago)
function mesChuvaBR(state) {
  const mesAno = (state.tempo.mes % 12);
  return mesAno >= 4 && mesAno <= 7;
}

function passaCondicoes(ev, state) {
  const c = ev.quando || {};
  const p = state.personagem;
  if (c.fase && p.fase !== c.fase) return false;
  if (c.faseIn && !c.faseIn.includes(p.fase)) return false;
  if (c.temMandato && !state.mandato) return false;
  if (c.temGrupoPolitico && p.grupoPolitico.length === 0) return false;
  if (c.notoriedadeMin != null && state.reputacao.notoriedade < c.notoriedadeMin) return false;
  if (c.aprovacaoMin != null && state.reputacao.aprovacao < c.aprovacaoMin) return false;
  if (c.seguidoresMin != null && state.redes.seguidores < c.seguidoresMin) return false;
  if (c.energiaMax != null && state.tempo.energia > c.energiaMax) return false;
  if (c.projetosAprovadosMin != null && (state.mandato?.indicadores.projetosAprovados || 0) < c.projetosAprovadosMin) return false;
  if (c.mesChuvaBR && !mesChuvaBR(state)) return false;
  for (const [k, v] of Object.entries(c.atributoMin || {})) if ((p.atributos[k] ?? 50) < v) return false;
  for (const [k, v] of Object.entries(c.atributoMax || {})) if ((p.atributos[k] ?? 50) > v) return false;
  return true;
}

// Sorteia um evento para o mês, ou null. Determinístico.
export function sortearEvento(state) {
  if (state.eventoPendente) return null;
  const rng = streamRng(state.meta.seed, "evsort", state.tempo.mes);

  const historico = state.mundo.crisesHistorico || {};
  const elegiveis = crisesDef.eventos.filter((ev) => {
    if (!passaCondicoes(ev, state)) return false;
    const ultimo = historico[ev.id];
    if (ultimo != null && state.tempo.mes - ultimo < (ev.cooldown || 6)) return false;
    return true;
  });
  if (elegiveis.length === 0) return null;

  // chance base de acontecer algo num mês
  const chanceBase = state.personagem.fase === 'CANDIDATO' ? 0.55
    : state.personagem.fase === 'MANDATO' ? 0.4 : 0.3;
  if (!rng.chance(chanceBase)) return null;

  const ev = rng.weighted(elegiveis, (e) => e.peso ?? 1);
  // materializa (bairro se fizer sentido no texto)
  const bairro = rng.pick(BAIRROS);
  return {
    id: ev.id,
    cat: ev.cat,
    titulo: ev.titulo.replace('{bairro}', bairro.nome),
    contexto: ev.contexto.replace('{bairro}', bairro.nome),
    opcoes: ev.opcoes.map((o) => ({ texto: o.texto })),
    _bairroId: bairro.id,
  };
}

// Eventos disparados pela World Memory (investigação de caso antigo) —
// resolvidos aqui, sem entrada no crises.json.
function resolverInvestigacao(state, opcaoIndex) {
  const pend = state.eventoPendente;
  const rng = createRng(state.meta.seed, state.meta.rngState);
  const fato = (state.mundo.memoria || []).find((f) => f.id === pend._memoriaId);
  const r = state.reputacao;
  let txt;
  if (opcaoIndex === 0) { // abrir tudo
    r.confianca = clamp(r.confianca + rng.range([1, 5]), 0, 100);
    r.rejeicao = clamp(r.rejeicao + rng.range([1, 4]), 0, 100);
    r.notoriedade = clamp(r.notoriedade + rng.range([2, 5]), 0, 100);
    txt = 'Você abriu os documentos. Desgaste, mas o assunto perde força.';
    if (fato) fato.resolvido = true;
  } else if (opcaoIndex === 1) { // minimizar
    r.rejeicao = clamp(r.rejeicao + rng.range([3, 9]), 0, 100);
    r.confianca = clamp(r.confianca - rng.range([2, 6]), 0, 100);
    r.ecoMidiatico = clamp(r.ecoMidiatico + rng.range([3, 8]), -50, 100);
    txt = 'Minimizar não colou — a imprensa foi atrás e o caso rendeu dias.';
  } else { // advogados / silêncio
    r.rejeicao = clamp(r.rejeicao + rng.range([2, 6]), 0, 100);
    r.ecoMidiatico = clamp(r.ecoMidiatico + rng.range([4, 10]), -50, 100);
    txt = 'O silêncio virou manchete: "Vereador se recusa a explicar".';
    // pode voltar mais uma vez
    if (fato) { fato.disparado = false; fato.gatilho.maturaEm = state.tempo.mes + rng.int(6, 14); fato.gatilho.chance = 0.7; }
  }
  state.mundo.noticias.unshift({ id: `nt_invres_${state.tempo.mes}`, mes: state.tempo.mes, tipo: 'MIDIA', destaque: true, atores: [], texto: txt });
  state.log.unshift({ mes: state.tempo.mes, tipo: 'CRISE', texto: `Investigação: ${txt}` });
  state.eventoPendente = null;
  state.meta.rngState = rng.state;
  return [txt];
}

// Aplica a escolha do jogador. Muta state.
export function resolverEvento(state, opcaoIndex) {
  const pend = state.eventoPendente;
  if (!pend) return null;
  if (pend._investigacao) return resolverInvestigacao(state, opcaoIndex);
  if (pend._cobrancaDoador) { resolverCobrancaDoador(state, opcaoIndex); return null; }
  const def = crisesDef.eventos.find((e) => e.id === pend.id);
  const opc = def?.opcoes[opcaoIndex];
  if (!opc) throw new Error('Escolha inválida.');

  const rng = createRng(state.meta.seed, state.meta.rngState);
  const resumo = [];
  const mult = opc.usaImproviso
    ? 0.7 + (state.personagem.atributos.improviso / 100) * 0.8
    : 1;

  for (const [k, faixa] of Object.entries(opc.rep || {})) {
    let d = rng.range(faixa);
    if (['aprovacao', 'notoriedade', 'confianca'].includes(k)) d *= mult;
    d = Math.round(d * 10) / 10;
    state.reputacao[k] = clamp((state.reputacao[k] ?? 0) + d, k === 'ecoMidiatico' ? -50 : 0, 100);
    if (Math.abs(d) >= 0.5) resumo.push(`${k} ${d > 0 ? '+' : ''}${d}`);
  }
  if (opc.dinheiroPessoal) {
    const v = rng.rangeInt(opc.dinheiroPessoal);
    state.financas.pessoal = Math.max(0, state.financas.pessoal + v);
    resumo.push(`pessoal ${v > 0 ? '+' : ''}${brl(v)}`);
  }
  if (opc.campanha) {
    const v = rng.rangeInt(opc.campanha);
    state.financas.campanha += v;
    resumo.push(`campanha +${brl(v)}`);
  }
  if (opc.energia) {
    const v = rng.rangeInt(opc.energia);
    state.tempo.energia = clamp(state.tempo.energia + v, 0, state.tempo.energiaMax);
    resumo.push(`energia ${v > 0 ? '+' : ''}${v}`);
  }
  if (opc.seguidoresPct) {
    const d = Math.round(state.redes.seguidores * rng.range(opc.seguidoresPct));
    state.redes.seguidores += d;
    resumo.push(`+${d} seguidores`);
  }
  if (opc.apoioPartido && state.personagem.partidoId) {
    const pr = state.mundo.partidosRuntime?.[state.personagem.partidoId];
    if (pr) { pr.apoioAoJogador = clamp(pr.apoioAoJogador + rng.rangeInt(opc.apoioPartido), 0, 100); resumo.push('apoio interno mexeu'); }
  }
  if (opc.relacaoPrefeitura && state.mandato) {
    state.mandato.relacaoPrefeitura = clamp(state.mandato.relacaoPrefeitura + rng.rangeInt(opc.relacaoPrefeitura), -100, 100);
  }
  if (opc.territorioTodos || opc.territorioTodos === 0) {
    const add = rng.range(opc.territorioTodos);
    for (const b of BAIRROS) {
      const t = state.territorio.porBairro[b.id];
      if (t && t.presenca > 0) t.presenca = clamp(t.presenca + add, 0, 100);
    }
  }
  if (opc.demiteAssessorAleatorio && state.mandato) {
    const chaves = Object.keys(state.mandato.gabinete.contratados);
    if (chaves.length) { delete state.mandato.gabinete.contratados[rng.pick(chaves)]; resumo.push('um assessor foi desligado'); }
  }
  if (opc.rompeAliadoAleatorio && state.personagem.grupoPolitico.length) {
    const id = rng.pick(state.personagem.grupoPolitico);
    state.personagem.grupoPolitico = state.personagem.grupoPolitico.filter((x) => x !== id);
    const pol = state.mundo.politicos[id];
    if (pol) pol.relacaoJogador = clamp(pol.relacaoJogador - 30, -100, 100);
    resumo.push('rompimento com um aliado');
  }
  // FASE 2 — a escolha vira um fato que pode voltar a te cobrar
  if (opc.memoria) {
    registrarFato(state, {
      tipo: 'ESCOLHA',
      texto: opc.memoria,
      dados: opc.memoriaDados || {},
      gatilho: opc.gatilho || (opc.memoriaDados?.investigavel
        ? { aposMeses: [14, 28], chance: 0.55, disparo: 'INVESTIGACAO' }
        : null),
    });
    resumo.push('isso pode voltar');
  }

  // FASE 31 — a escolha pode plantar uma cascata de repercussão
  if (opc.cascata) {
    const bid = pend._bairroId;
    semear(state, opc.cascata, bid ? { bairroId: bid, bairroNome: nomeBairro(bid) } : {});
  }

  // registra cooldown + notícia
  state.mundo.crisesHistorico = state.mundo.crisesHistorico || {};
  state.mundo.crisesHistorico[pend.id] = state.tempo.mes;
  state.mundo.noticias.unshift({
    id: `nt_ev_${state.tempo.mes}_${pend.id}`, mes: state.tempo.mes, tipo: pend.cat === 'IMPRENSA' || pend.cat === 'REDES' ? 'MIDIA' : 'CIDADE',
    destaque: true, atores: [], texto: `${pend.titulo} — sua resposta: "${opc.texto}".`,
  });
  state.log.unshift({ mes: state.tempo.mes, tipo: 'CRISE', texto: `${pend.titulo}: ${opc.texto} (${resumo.join(', ') || 'sem grandes efeitos'}).` });

  state.eventoPendente = null;
  state.meta.rngState = rng.state;
  return resumo;
}

function brl(v) { return `R$ ${Math.round(Math.abs(v)).toLocaleString('pt-BR')}`; }
