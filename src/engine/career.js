import { clamp } from './rng';
import partiesDef from '../content/parties.json';
import { iniciarEleicao } from './election';
import { janelaCandidatura } from './calendar';
import { todosOsCargos, cargoPorId } from './offices';
import { arquivarMandato, encerrarCarreira } from './endgame';

// Fase 30 — o jogador pode encerrar a carreira quando já é alguém na política.
export function podeEncerrarCarreira(state) {
  const p = state.personagem;
  if (state.fimDeJogo) return false;
  if (!['PARTIDO', 'MANDATO'].includes(p.fase)) return false;
  return (p.mandatosExercidos || []).length >= 1 || p.idade >= 50;
}

function nomeCargoCurto(id) {
  return (cargoPorId(id)?.nomeCurto || id.toLowerCase().replace(/_/g, ' '));
}

// Fase 25 — que cargos o jogador pode disputar, e o que falta para cada um.
export function cargosElegiveis(state) {
  const p = state.personagem;
  const exercidos = new Set(p.mandatosExercidos || []);
  return todosOsCargos().map((c) => {
    const el = c.elegibilidade || {};
    const tipoPleito = c.tipoPleito || 'MUNICIPAL';
    const jan = janelaCandidatura(state, tipoPleito);
    const faltas = [];
    if (el.idadeMin && p.idade < el.idadeMin) faltas.push(`idade mínima ${el.idadeMin}`);
    if (el.notoriedadeMin && state.reputacao.notoriedade < el.notoriedadeMin) {
      faltas.push(`notoriedade ${Math.round(state.reputacao.notoriedade)}/${el.notoriedadeMin}`);
    }
    if (el.exigeMandato && !el.exigeMandato.some((m) => exercidos.has(m))) {
      faltas.push(`já ter exercido: ${el.exigeMandato.map(nomeCargoCurto).join(' ou ')}`);
    }
    return {
      id: c.id,
      nome: c.nome,
      nomeCurto: c.nomeCurto,
      tipoPleito,
      sistema: c.sistema,
      ano: jan.ano,
      mesesAteAbrir: jan.mesesAteAbrir,
      janelaAberta: jan.aberta,
      requisitosOk: faltas.length === 0,
      faltaRequisito: faltas.join(' · ') || null,
      disponivel: faltas.length === 0 && jan.aberta,
    };
  });
}

// Ações de transição de fase. A Agenda mostra estas como cards fixos
// quando `disponivel` é true (ou como "objetivo bloqueado" com `motivo`).

function algumBairro(state, min) {
  return Object.values(state.territorio.porBairro).some((t) => t.presenca >= min);
}
function contatosFortes(state, min) {
  return Object.values(state.relacionamentos.pessoas)
    .filter((p) => ['CONTATO', 'AMIGO', 'ALIADO', 'PARCEIRO'].includes(p.nivel)).length >= min;
}

export function objetivoDaFase(state) {
  const f = state.personagem.fase;

  if (f === 'VIDA') {
    const okNoto = state.reputacao.notoriedade >= 8;
    const okBase = algumBairro(state, 12) || contatosFortes(state, 2);
    return {
      id: 'assumir_vida_publica',
      titulo: 'Assumir protagonismo público',
      desc: 'Passar de cidadão comum a nome conhecido: encabeçar uma pauta, liderar um movimento, virar referência local.',
      disponivel: okNoto && okBase,
      motivo: [
        okNoto ? null : `notoriedade ${Math.round(state.reputacao.notoriedade)}/8`,
        okBase ? null : 'uma base: presença 12+ num bairro OU 2+ contatos sólidos',
      ].filter(Boolean).join(' · '),
    };
  }

  if (f === 'VIDA_PUBLICA') {
    return {
      id: 'filiar_partido',
      titulo: 'Filiar-se a um partido',
      desc: 'Sem legenda não se disputa eleição. Escolha um partido — a afinidade ideológica afeta como sua base reage.',
      disponivel: true,
      precisaPartido: true,
    };
  }

  if (f === 'MANDATO') {
    if (!state.mandato?.encerrando) return null;
    const cargoAtual = state.mandato.cargo || 'VEREADOR';
    const ind = state.mandato.indicadores;
    const balanco = `Balanço: ${ind.projetosAprovados} projeto(s) aprovado(s), ${ind.fiscalizacoes} fiscalização(ões), ${state.mandato.promessas.filter((p) => p.cumprida).length}/${state.mandato.promessas.length} promessa(s) cumprida(s). Aprovação ${Math.round(state.reputacao.aprovacao)}%.`;
    const elegiveis = cargosElegiveis(state);
    const reele = elegiveis.find((c) => c.id === cargoAtual);
    // opções: reeleição ao cargo atual + cargos superiores com requisitos ok
    const opcoes = elegiveis.filter((c) => c.id === cargoAtual || (c.requisitosOk && c.id !== cargoAtual));
    const algumaDisponivel = opcoes.some((c) => c.disponivel || c.janelaAberta);
    return {
      id: 'lancar_candidatura',
      titulo: 'Disputar uma eleição',
      desc: `Seu mandato está no fim. ${balanco}`,
      cargos: opcoes,
      cargoPadrao: reele?.janelaAberta ? cargoAtual : (opcoes.find((c) => c.disponivel)?.id || cargoAtual),
      disponivel: algumaDisponivel,
      motivo: algumaDisponivel ? null : 'nenhuma janela de candidatura aberta agora',
      recomendado: (reele?.janelaAberta) && state.reputacao.aprovacao >= 45,
      aviso: state.reputacao.aprovacao < 40 ? 'Aprovação baixa no fim do mandato — a disputa vai ser dura.' : null,
    };
  }

  if (f === 'PARTIDO') {
    const pr = state.mundo.partidosRuntime?.[state.personagem.partidoId];
    const apoio = pr ? Math.round(pr.apoioAoJogador) : 30;
    const elegiveis = cargosElegiveis(state);
    // mostra: cargos com requisitos ok (vereador é sempre elegível)
    const opcoes = elegiveis.filter((c) => c.requisitosOk);
    const algumaDisponivel = opcoes.some((c) => c.janelaAberta);
    const proxima = [...opcoes].sort((a, b) => a.mesesAteAbrir - b.mesesAteAbrir)[0];
    const avisos = [];
    if (apoio < 30) avisos.push(`Apoio interno só ${apoio}% — o aporte de campanha vai ser magro. Cultive as lideranças.`);
    return {
      id: 'lancar_candidatura',
      titulo: 'Lançar candidatura',
      desc: algumaDisponivel
        ? `Há eleição na janela. Apoio interno no partido: ${apoio}%.`
        : proxima
          ? `Próxima janela: ${proxima.nome} em ${proxima.mesesAteAbrir} mês(es). Construa base até lá.`
          : 'Sem janelas próximas.',
      cargos: opcoes,
      cargoPadrao: opcoes.find((c) => c.janelaAberta)?.id || 'VEREADOR',
      disponivel: state.personagem.partidoId != null && algumaDisponivel,
      motivo: !state.personagem.partidoId ? 'filie-se a um partido'
        : !algumaDisponivel ? (proxima ? `janela de candidatura de ${proxima.nome} abre em ${proxima.mesesAteAbrir} mês(es)` : 'sem eleição próxima')
          : null,
      recomendado: algumaDisponivel && state.reputacao.notoriedade >= 15 && apoio >= 35,
      aviso: algumaDisponivel ? (avisos.join(' ') || null) : null,
    };
  }

  return null;
}

export function aplicarObjetivo(state, objetivoId, opts = {}) {
  const mes = state.tempo.mes;

  if (objetivoId === 'assumir_vida_publica') {
    state.personagem.fase = 'VIDA_PUBLICA';
    state.reputacao.notoriedade = clamp(state.reputacao.notoriedade + 4, 0, 100);
    state.personagem.historicoPolitico.push({ mes, texto: 'Passou a atuar publicamente como liderança.' });
    state.log.unshift({ mes, tipo: 'MARCO', texto: 'Você entrou na vida pública. Um partido agora é o próximo passo.' });
    return;
  }

  if (objetivoId === 'filiar_partido') {
    const pid = opts.partidoId;
    const partido = partiesDef.partidos.find((p) => p.id === pid);
    if (!partido) throw new Error('Partido inválido.');
    state.personagem.partidoId = pid;
    state.personagem.fase = 'PARTIDO';
    (state.personagem.partidoHistorico ||= []).push({
      partidoId: pid, mesEntrada: mes, mesSaida: null, motivo: null,
      cargoNaEpoca: state.personagem.cargoAtual || 'NENHUM',
    });
    // aporte inicial simbólico de estrutura partidária
    state.financas.partidaria += Math.round(partido.tamanho * 120);
    state.personagem.historicoPolitico.push({ mes, texto: `Filiou-se ao ${partido.nome} (${pid}).` });
    state.log.unshift({ mes, tipo: 'MARCO', texto: `Filiação ao ${pid} confirmada. Agora é construir base para uma candidatura.` });
    return;
  }

  if (objetivoId === 'lancar_candidatura' || objetivoId === 'disputar_reeleicao') {
    if (!state.personagem.partidoId) throw new Error('É preciso estar filiado a um partido.');
    const cargoId = opts.cargoId || 'VEREADOR';
    const alvo = cargoPorId(cargoId);
    if (!alvo) throw new Error('Cargo inválido.');

    // validação de elegibilidade (defensiva — a UI já filtra)
    const info = cargosElegiveis(state).find((c) => c.id === cargoId);
    if (info && !info.requisitosOk) throw new Error(`Inelegível para ${alvo.nome}: falta ${info.faltaRequisito}.`);
    if (info && !info.janelaAberta) throw new Error(`A janela de candidatura para ${alvo.nome} não está aberta.`);

    if (state.mandato) {
      const eraReeleicao = state.mandato.cargo === cargoId;
      if (eraReeleicao) {
        // Fase 33 — a reeleição é um referendo: o impulso de quem está no cargo
        // escala com o desempenho (aprovação + promessas cumpridas). Mandato
        // fraco vira lastro, não trampolim.
        const proms = state.mandato.promessas || [];
        const taxaProm = proms.length ? proms.filter((x) => x.cumprida).length / proms.length : 0.5;
        // Etapa 13 — referendo mais duro: centro em ~50 de aprovação e desgaste
        // de incumbência fixo (máquina cansada, oposição unida). Só mandato
        // claramente bom rende saldo positivo; o mediano vira lastro.
        const desempenho = clamp((state.reputacao.aprovacao - 52) / 32 + (taxaProm - 0.45) * 0.9, -1.2, 1.2);
        const desgaste = 0.5;
        state.reputacao.notoriedade = Math.min(100, state.reputacao.notoriedade + 2 + 5 * Math.max(0, desempenho));
        state.reputacao.rejeicao = clamp(state.reputacao.rejeicao + 3 - 4 * desempenho, 0, 100);
        const pr = state.mundo.partidosRuntime?.[state.personagem.partidoId];
        if (pr) pr.apoioAoJogador = clamp(pr.apoioAoJogador + (desempenho - desgaste) * 13, 0, 100);
      }
      state.personagem.historicoPolitico.push({
        mes: state.tempo.mes,
        texto: eraReeleicao
          ? `Encerrou o mandato e partiu para a reeleição a ${alvo.nome}.`
          : `Deixou o mandato de ${(state.mandato.cargoNome || 'vereador')} para disputar ${alvo.nome}.`,
      });
      arquivarMandato(state); // Fase 30 — soma o mandato ao legado
      state.mandato = null;
    }
    iniciarEleicao(state, cargoId);
    return;
  }

  if (objetivoId === 'encerrar_carreira') {
    if (!podeEncerrarCarreira(state)) throw new Error('Ainda não há carreira para encerrar.');
    encerrarCarreira(state);
    return;
  }

  throw new Error('Objetivo desconhecido.');
}

export function afinidadePartido(state, partidoId) {
  const p = partiesDef.partidos.find((x) => x.id === partidoId);
  if (!p) return 0;
  // usa o eixo do personagem via traço/atributos como proxy — aqui simples:
  // afinidade cai com |eixo do partido| se o personagem for "de centro" por padrão.
  const eixoPersonagem = (state.personagem.atributos.ambicao - 50) * 0.4; // placeholder leve
  return Math.round(100 - Math.abs(p.eixo - eixoPersonagem) / 2);
}
