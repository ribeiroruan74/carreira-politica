import { streamRng, clamp } from './rng';

// ============================================================
// FASE 2 — World Memory como MOTOR
// Fatos importantes são registrados com um gatilho. A cada mês,
// gatilhos maduros disparam eventos de retorno (crise, notícia,
// investigação, cobrança). "Uma promessa do ano 1 volta no ano 4."
// ============================================================

// Registra um fato. `gatilho` é opcional:
//   { aposMeses:[min,max], chance:0..1, condicao:(state)=>bool, disparo:'INVESTIGACAO'|'COBRANCA'|'NOTICIA' }
export function registrarFato(state, { tipo, texto, dados = {}, gatilho = null }) {
  const mes = state.tempo.mes;
  const id = `mem_${mes}_${tipo}_${Object.keys(state.mundo.memoria).length}_${(texto || '').length}`;
  const rng = streamRng(state.meta.seed, 'mem', id);
  let maturaEm = null;
  if (gatilho?.aposMeses) {
    maturaEm = mes + rng.rangeInt(gatilho.aposMeses);
  }
  state.mundo.memoria.push({
    id, mes, tipo, texto, dados,
    gatilho: gatilho ? { ...gatilho, maturaEm } : null,
    disparado: false,
    resolvido: !gatilho,
  });
  // poda: guarda no máximo 120 fatos, priorizando os não resolvidos
  if (state.mundo.memoria.length > 140) {
    const ativos = state.mundo.memoria.filter((f) => !f.resolvido);
    const velhos = state.mundo.memoria.filter((f) => f.resolvido).slice(-40);
    state.mundo.memoria = [...ativos, ...velhos].slice(-140);
  }
  return id;
}

// Chamado todo mês pelo runMonth.
export function tickMemoria(s) {
  const mes = s.tempo.mes;
  const eventos = [];
  const rng = streamRng(s.meta.seed, 'memtick', mes);

  for (const fato of s.mundo.memoria) {
    const g = fato.gatilho;
    if (!g || fato.disparado || fato.resolvido) continue;
    if (g.maturaEm == null || mes < g.maturaEm) continue;
    if (g.condicao && !safeCond(g.condicao, s)) continue;
    if (g.chance != null && !rng.chance(g.chance)) {
      // não disparou desta vez — tenta de novo daqui a alguns meses
      g.maturaEm = mes + rng.int(3, 8);
      continue;
    }

    fato.disparado = true;
    const efeito = dispararFato(s, fato, rng);
    if (efeito) eventos.push(efeito);
  }

  return { state: s, eventos };
}

function safeCond(fn, s) {
  try { return !!fn(s); } catch { return false; }
}

function dispararFato(s, fato, rng) {
  const mes = s.tempo.mes;
  const tipoDisparo = fato.gatilho.disparo || 'NOTICIA';

  if (tipoDisparo === 'INVESTIGACAO') {
    // vira uma crise de investigação (evento pendente com escolha)
    s.eventoPendente = {
      id: `mem_inv_${fato.id}`,
      cat: 'IMPRENSA',
      titulo: fato.dados.tituloInvestigacao || 'Uma reportagem reabre um caso antigo',
      contexto: `${fato.dados.contextoInvestigacao || fato.texto} — a imprensa quer explicações agora.`,
      opcoes: [
        { texto: 'Abrir tudo e responder ponto a ponto' },
        { texto: 'Minimizar e dizer que já foi esclarecido' },
        { texto: 'Acionar advogados e não comentar' },
      ],
      _memoriaId: fato.id,
      _investigacao: true,
    };
    noticia(s, mes, 'MIDIA', `Investigação: ${fato.dados.tituloInvestigacao || fato.texto}`, true);
    return { tipo: 'MEMORIA', texto: `Um caso antigo voltou: ${fato.texto}` };
  }

  if (tipoDisparo === 'COBRANCA') {
    s.reputacao.confianca = clamp(s.reputacao.confianca - rng.range([3, 8]), 0, 100);
    s.reputacao.rejeicao = clamp(s.reputacao.rejeicao + rng.range([1, 4]), 0, 100);
    noticia(s, mes, 'CIDADE', fato.dados.textoCobranca || `Cobrança: ${fato.texto}`, true);
    return { tipo: 'MEMORIA', texto: fato.dados.textoCobranca || `Voltaram a te cobrar: ${fato.texto}` };
  }

  // NOTICIA simples
  noticia(s, mes, 'MIDIA', fato.dados.textoNoticia || fato.texto, fato.dados.destaque ?? true);
  return { tipo: 'MEMORIA', texto: fato.texto };
}

function noticia(s, mes, tipo, texto, destaque) {
  s.mundo.noticias.unshift({ id: `nt_mem_${mes}_${(texto || '').length}`, mes, tipo, destaque, atores: [], texto });
  s.mundo.noticias = s.mundo.noticias.slice(0, 80);
}

// helper p/ a UI: fatos ativos (gatilho pendente) — "riscos" que o jogador arrastou
export function riscosAbertos(state) {
  return (state.mundo.memoria || []).filter((f) => f.gatilho && !f.disparado && !f.resolvido);
}

// ============================================================
// FASE 10 — Investigações proativas da imprensa
// A imprensa vai atrás sozinha quando o estado tem cheiro de problema:
// caixa alta sem lastro, promessa furada com dinheiro gasto em outra
// coisa, ou um desafeto que "vaza".
// ============================================================
export function tickInvestigacaoProativa(s) {
  if (s.eventoPendente) return { state: s, eventos: [] };
  if (!['CANDIDATO', 'MANDATO', 'PARTIDO'].includes(s.personagem.fase)) return { state: s, eventos: [] };
  const mes = s.tempo.mes;
  s.flags = s.flags || {};
  if (mes - (s.flags.ultimaInvestigacaoProativa ?? -99) < 10) return { state: s, eventos: [] };

  const rng = streamRng(s.meta.seed, 'invproativa', mes);
  const jaTemGatilho = (s.mundo.memoria || []).some((f) => f.gatilho && !f.disparado && f.gatilho.disparo === 'INVESTIGACAO');
  if (jaTemGatilho) return { state: s, eventos: [] };

  let motivo = null; let chance = 0;
  const caixaTotal = s.financas.campanha + s.financas.gabinete;
  const promFurada = (s.mandato?.promessas || []).some((p) => !p.cumprida && mes > p.prazo);
  const desafeto = Object.values(s.mundo.politicos || {})
    .find((p) => p.ativo && p.relacaoJogador < -35 && p.influencia > 45);

  if (caixaTotal > 130000 && s.reputacao.notoriedade < 45) {
    motivo = 'volume de recursos incompatível com o tamanho da sua operação';
    chance = 0.35;
  } else if (promFurada && caixaTotal > 60000) {
    motivo = 'você não cumpriu uma promessa mas continuou gastando em outras frentes';
    chance = 0.3;
  } else if (desafeto && rng.chance(0.5)) {
    motivo = `um interlocutor de ${desafeto.nome} passou informações para um jornalista`;
    chance = 0.4;
  } else if (s.reputacao.rejeicao > 45 && s.reputacao.ecoMidiatico < -8) {
    motivo = 'a maré virou e a imprensa foi remexer no seu passado';
    chance = 0.25;
  }

  if (!motivo || !rng.chance(chance)) return { state: s, eventos: [] };

  s.flags.ultimaInvestigacaoProativa = mes;
  registrarFato(s, {
    tipo: 'INVESTIGACAO_PROATIVA',
    texto: `Reportagem em apuração: ${motivo}.`,
    dados: {
      tituloInvestigacao: 'Uma reportagem foi atrás da sua vida pública',
      contextoInvestigacao: `Motivo: ${motivo}`,
    },
    gatilho: { aposMeses: [1, 3], chance: 0.9, disparo: 'INVESTIGACAO' },
  });
  return { state: s, eventos: [{ tipo: 'MIDIA', texto: `Você soube que uma reportagem está sendo apurada: ${motivo}.` }] };
}
