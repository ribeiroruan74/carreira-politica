import { createRng, clamp } from './rng';
import { gerarChapa } from './candidates';
import {
  estimarVotos, apurar, apurarMajoritario, jogadorComoCandidato,
} from './voteModel';
import { bonusDeAliancas } from './world';
import { iniciarMandato } from './mandate';
import { duracaoCampanhaSeLancar, proximaEleicao } from './calendar';
import { formarColigacoes } from './coalitions';
import {
  cargoPorId, cadeirasDoCargo, usaSegundoTurno, nomeCidade, eleitoradoApto,
} from './offices';
import partiesDef from '../content/parties.json';

function partido(id) {
  return partiesDef.partidos.find((p) => p.id === id) || partiesDef.partidos[0];
}

// Inicia a campanha para um cargo. Muta `state`.
export function iniciarEleicao(state, cargoId = 'VEREADOR') {
  const cargo = cargoPorId(cargoId);
  const rng = createRng(state.meta.seed, state.meta.rngState);
  const chapa = gerarChapa(state, cargoId);
  const pa = partido(state.personagem.partidoId);
  const proporcional = cargo.sistema === 'PROPORCIONAL';

  // aporte de campanha do partido — escala com o apoio interno e o porte do cargo
  const pr = state.mundo.partidosRuntime?.[state.personagem.partidoId];
  const apoio = pr ? pr.apoioAoJogador : 30;
  const fatorApoio = 0.4 + (apoio / 100) * 0.9;
  const porteCargo = cargo.circunscricao === 'ESTADO' ? 3.2 : (cargo.sistema === 'MAJORITARIO' ? 2.4 : 1);
  const aporte = Math.round(pa.tamanho * rng.range([400, 1100]) * fatorApoio * porteCargo);
  state.financas.campanha += aporte;

  const bonus = bonusDeAliancas(state);
  state.reputacao.ecoMidiatico = clamp(state.reputacao.ecoMidiatico + bonus.eco, -50, 100);
  state.reputacao.notoriedade = clamp(state.reputacao.notoriedade + bonus.noto, 0, 100);
  state.financas.campanha += bonus.caixa;
  for (const [bid, add] of Object.entries(bonus.territorio)) {
    const t = state.territorio.porBairro[bid] || { presenca: 0, penetracao: 0 };
    t.presenca = clamp(t.presenca + add, 0, 100);
    state.territorio.porBairro[bid] = t;
  }

  const tipoPleito = cargo.tipoPleito || 'MUNICIPAL';
  const totalMeses = duracaoCampanhaSeLancar(state, tipoPleito, cargo.mesesDeCampanha);
  const pleito = proximaEleicao(state, tipoPleito);

  state.personagem.fase = 'CANDIDATO';
  state.personagem.licenciado = true;
  state.eleicao = {
    id: `el_${cargoId}_${state.tempo.mes}_${rng.int(1000, 9999)}`,
    cargo: cargoId,
    cargoNome: cargo.nome,
    sistema: cargo.sistema,
    circunscricao: cargo.circunscricao,
    tipoPleito,
    cidade: cargo.circunscricao === 'ESTADO' ? nomeCidade(state.personagem.cidade) : nomeCidade(state.personagem.cidade),
    circunscricaoNome: cargo.circunscricao === 'ESTADO' ? 'Pernambuco' : nomeCidade(state.personagem.cidade),
    cadeiras: cadeirasDoCargo(state, cargoId),
    doisTurnos: usaSegundoTurno(state, cargoId),
    turno: 1,
    eleitoradoApto: eleitoradoApto(state, cargoId),
    mesInicio: state.tempo.mes,
    mesAtual: 0,
    totalMeses,
    mesPleito: pleito.mes,
    anoPleito: pleito.ano,
    status: 'CAMPANHA',
    candidatos: chapa,
    pesquisas: [],
    resultado: null,
    aporteInicial: aporte,
  };

  if (proporcional) {
    state.eleicao.coligacoes = formarColigacoes(state);
    const minhaCol = state.eleicao.coligacoes.deColigacao[state.personagem.partidoId];
    const nomeCol = state.eleicao.coligacoes.nomes[minhaCol];
    const membrosCol = state.eleicao.coligacoes.membros[minhaCol] || [state.personagem.partidoId];
    if (membrosCol.length > 1) {
      state.log.unshift({
        mes: state.tempo.mes, tipo: 'POLITICA',
        texto: `Coligação "${nomeCol}": ${membrosCol.join(' / ')}. Os votos de toda a coligação contam juntos para o quociente.`,
      });
    }
  }

  state.meta.rngState = rng.state;
  state.log.unshift({
    mes: state.tempo.mes, tipo: 'MARCO',
    texto: `Candidatura a ${cargo.nome} oficializada pelo ${pa.id} para a eleição de ${pleito.ano}. ${chapa.length} concorrentes, ${totalMeses} meses de campanha. Aporte: R$ ${aporte.toLocaleString('pt-BR')} (apoio interno ${Math.round(apoio)}%)${bonus.n ? `, ${bonus.n} apoio(s) do seu grupo` : ''}.`,
  });
  return state.eleicao;
}

// IA dos adversários: cada candidato faz um "movimento" no mês.
function moverAdversarios(el, rng) {
  for (const c of el.candidatos) {
    if (c.eliminado) continue;
    c.ecoMidiatico = +(c.ecoMidiatico * 0.55).toFixed(2);

    const investe = rng.chance(0.55 + (c.forca / 300));
    if (investe && c.caixaCampanha > 3000) {
      const gasto = Math.min(c.caixaCampanha, rng.int(3000, 22000));
      c.caixaCampanha -= gasto;
      const impacto = Math.log10(1 + gasto / 3000);
      if (c.estilo === 'TERRITORIO') {
        for (const bid of Object.keys(c.bairrosBase)) {
          c.bairrosBase[bid] = clamp(c.bairrosBase[bid] + impacto * rng.range([0.01, 0.04]), 0, 1);
        }
      } else if (c.estilo === 'REDES') {
        c.notoriedade = clamp(c.notoriedade + impacto * rng.range([1.5, 4]), 0, 100);
        c.ecoMidiatico = clamp(c.ecoMidiatico + impacto * rng.range([1, 4]), -20, 60);
      } else {
        c.notoriedade = clamp(c.notoriedade + impacto * rng.range([0.8, 2.5]), 0, 100);
        for (const bid of Object.keys(c.bairrosBase)) {
          c.bairrosBase[bid] = clamp(c.bairrosBase[bid] + impacto * rng.range([0.005, 0.02]), 0, 1);
        }
      }
    }

    if (rng.chance(0.05)) {
      if (rng.chance(0.6)) {
        c.notoriedade = clamp(c.notoriedade + rng.range([6, 18]), 0, 100);
        c.ecoMidiatico = clamp(c.ecoMidiatico + rng.range([8, 25]), -20, 80);
        el._eventoMundo = `${c.nome} (${c.partidoId}) viralizou e disparou nas buscas.`;
      } else {
        c.rejeicao = clamp(c.rejeicao + rng.range([5, 20]), 0, 100);
        c.ecoMidiatico = clamp(c.ecoMidiatico - rng.range([3, 12]), -30, 60);
        el._eventoMundo = `${c.nome} (${c.partidoId}) se envolveu numa polêmica.`;
      }
    }
  }
}

function gerarPesquisa(el, votos, totalNominal, state, rng) {
  const jogadorVotos = votos.JOGADOR || 0;
  const lista = el.candidatos
    .map((c) => ({ id: c.id, nome: c.nome, partidoId: c.partidoId, votos: votos[c.id] || 0 }))
    .concat([{ id: 'JOGADOR', nome: `${state.personagem.nome} (você)`, partidoId: state.personagem.partidoId, votos: jogadorVotos, jogador: true }])
    .sort((a, b) => b.votos - a.votos);

  // ruído de pesquisa: sobretudo multiplicativo (erro relativo), com um piso
  // absoluto pequeno — assim um nanico não "salta" 100 posições por acaso.
  const pisoAbs = el.sistema === 'MAJORITARIO' ? 0.02 : 0.006;
  const comMargem = lista.map((c) => {
    const frac = totalNominal ? c.votos / totalNominal : 0;
    const fracPesq = clamp(frac * (1 + rng.gauss(0, 0.11)) + rng.gauss(0, pisoAbs), 0, 1);
    return { ...c, pct: +(fracPesq * 100).toFixed(1), votosPesq: Math.round(fracPesq * totalNominal) };
  }).sort((a, b) => b.pct - a.pct);

  return {
    mes: el.mesAtual,
    turno: el.turno,
    margemErro: 3,
    validos: totalNominal,
    linhas: comMargem.slice(0, el.sistema === 'MAJORITARIO' ? 8 : 14),
    posicaoJogador: comMargem.findIndex((c) => c.jogador) + 1,
  };
}

// Avança 1 mês de campanha. Recebe estado já clonado; muta e devolve.
export function tickEleicao(s) {
  if (s.eleicao?.status !== 'CAMPANHA') return { state: s, eventos: [] };
  const el = s.eleicao;
  const rng = createRng(s.meta.seed, s.meta.rngState);
  const eventos = [];
  el._eventoMundo = null;

  moverAdversarios(el, rng);
  el.mesAtual += 1;

  const campo = [...el.candidatos, jogadorComoCandidato(s, el.cargo)];
  const { votos, totalNominal } = estimarVotos(campo, s, el.cargo);

  for (const c of el.candidatos) {
    c.votosEstimados = votos[c.id] || 0;
    c.historicoVotos.push(c.votosEstimados);
  }
  el.jogadorVotosHist = [...(el.jogadorVotosHist || []), votos.JOGADOR || 0];

  const pesquisa = gerarPesquisa(el, votos, totalNominal, s, rng);
  el.pesquisas.push(pesquisa);

  if (el._eventoMundo) eventos.push({ tipo: 'CAMPANHA', texto: el._eventoMundo });
  eventos.push({
    tipo: 'PESQUISA',
    texto: `Nova pesquisa (${el.turno > 1 ? '2º turno, ' : ''}${el.mesAtual}º mês): você aparece em ${pesquisa.posicaoJogador}º com ${pesquisa.linhas.find((l) => l.jogador)?.pct ?? 0}%.`,
  });

  s.meta.rngState = rng.state;

  if (el.mesAtual >= el.totalMeses) {
    const transicao = finalizarTurno(s);
    if (transicao === 'SEGUNDO_TURNO') {
      eventos.push({
        tipo: 'MARCO',
        texto: `1º turno encerrado: ${el.resumoPrimeiroTurno}. Você vai ao 2º turno.`,
      });
    } else {
      eventos.push({ tipo: 'MARCO', texto: mensagemResultado(s) });
    }
  }
  for (const ev of eventos) s.log.unshift({ mes: s.tempo.mes, tipo: ev.tipo, texto: ev.texto });
  s.log = s.log.slice(0, 200);

  return { state: s, eventos };
}

function mensagemResultado(s) {
  const r = s.eleicao.resultado;
  const cargoNome = s.eleicao.cargoNome;
  if (r.eleito) {
    return s.eleicao.sistema === 'MAJORITARIO'
      ? `APURAÇÃO: você foi eleito(a) ${cargoNome} com ${r.pctJogador}% dos votos válidos.`
      : `APURAÇÃO: você foi eleito(a) ${cargoNome} com ${r.votosJogador.toLocaleString('pt-BR')} votos.`;
  }
  return `APURAÇÃO: você não se elegeu (${r.posicaoJogador}º, ${r.votosJogador.toLocaleString('pt-BR')} votos).`;
}

// Fecha o turno atual. Devolve 'SEGUNDO_TURNO' se a disputa continua, senão null.
function finalizarTurno(s) {
  const el = s.eleicao;
  const campo = [...el.candidatos, jogadorComoCandidato(s, el.cargo)];
  const { votos } = estimarVotos(campo, s, el.cargo);

  if (el.sistema === 'MAJORITARIO') {
    const comSegundoTurno = el.doisTurnos && el.turno === 1;
    const ap = apurarMajoritario(campo, votos, { comSegundoTurno });
    const linhaJogador = ap.ranking.find((r) => r.jogador);

    if (ap.segundoTurno) {
      const [a, b] = ap.segundoTurno;
      const nomes = ap.segundoTurno.map((id) => ap.ranking.find((r) => r.id === id));
      el.resumoPrimeiroTurno = nomes.map((n) => `${n.nome} ${n.pct}%`).join(' x ');
      if (ap.segundoTurno.includes('JOGADOR')) {
        // segue para o 2º turno: só os dois primeiros
        el.turno = 2;
        el.candidatos = el.candidatos.filter((c) => a === c.id || b === c.id);
        for (const c of el.candidatos) { c.eliminado = false; c.historicoVotos = []; }
        el.mesAtual = 0;
        el.totalMeses = 2;
        el.jogadorVotosHist = [];
        el.pesquisas = [];
        el.primeiroTurno = { ranking: ap.ranking.slice(0, 8) };
        return 'SEGUNDO_TURNO';
      }
      // jogador ficou fora do 2º turno → acabou para ele
      el.status = 'APURADO';
      el.resultado = {
        sistema: 'MAJORITARIO',
        ranking: ap.ranking,
        validos: ap.validos,
        cadeiras: 1,
        votosJogador: linhaJogador?.votos || 0,
        pctJogador: linhaJogador?.pct || 0,
        posicaoJogador: ap.ranking.findIndex((r) => r.jogador) + 1,
        eleito: false,
        segundoTurnoEntre: nomes.map((n) => `${n.nome} (${n.partidoId})`),
      };
      return aplicarDesfecho(s, false);
    }

    el.status = 'APURADO';
    const eleito = ap.vencedor === 'JOGADOR';
    el.resultado = {
      sistema: 'MAJORITARIO',
      ranking: ap.ranking,
      validos: ap.validos,
      cadeiras: 1,
      vencedorNome: ap.ranking.find((r) => r.id === ap.vencedor)?.nome,
      votosJogador: linhaJogador?.votos || 0,
      pctJogador: linhaJogador?.pct || 0,
      pctVencedor: ap.pctVencedor,
      posicaoJogador: ap.ranking.findIndex((r) => r.jogador) + 1,
      eleito,
    };
    return aplicarDesfecho(s, eleito);
  }

  // PROPORCIONAL
  const apuracao = apurar(campo, votos, el.coligacoes, el.cadeiras);
  const linhaJogador = apuracao.ranking.find((r) => r.jogador);
  const eleito = !!linhaJogador?.eleito;
  el.status = 'APURADO';
  el.resultado = {
    ...apuracao,
    votosJogador: linhaJogador?.votos || 0,
    posicaoJogador: apuracao.ranking.findIndex((r) => r.jogador) + 1,
    eleito,
  };
  return aplicarDesfecho(s, eleito);
}

function aplicarDesfecho(s, eleito) {
  const el = s.eleicao;
  const cargoId = el.cargo;
  const cargoNome = el.cargoNome;

  s.personagem.historicoPolitico.push({
    mes: s.tempo.mes,
    texto: eleito
      ? `Eleito(a) ${cargoNome} (${el.circunscricaoNome}) com ${el.resultado.votosJogador.toLocaleString('pt-BR')} votos.`
      : `Não eleito para ${cargoNome} (${el.resultado.posicaoJogador}º lugar, ${el.resultado.votosJogador.toLocaleString('pt-BR')} votos).`,
  });

  if (eleito) {
    s.personagem.fase = 'MANDATO';
    s.personagem.cargoAtual = cargoId;
    s.personagem.licenciado = true;
    s.personagem.derrotasSeguidas = 0; // Fase 30
    const leg = (s.personagem.legado ||= {});
    leg.eleicoesVencidas = (leg.eleicoesVencidas || 0) + 1;
    leg.melhorVotacao = Math.max(leg.melhorVotacao || 0, el.resultado.votosJogador || 0);
    s.personagem.mandatosExercidos = Array.from(
      new Set([...(s.personagem.mandatosExercidos || []), cargoId]),
    );
    s.reputacao.aprovacao = clamp(s.reputacao.aprovacao + 4, 0, 100);
    iniciarMandato(s, cargoId);
  } else {
    s.personagem.fase = 'PARTIDO';
    s.personagem.cargoAtual = 'NENHUM';
    s.personagem.licenciado = false;
    s.personagem.derrotasSeguidas = (s.personagem.derrotasSeguidas || 0) + 1; // Fase 30
    const leg = (s.personagem.legado ||= {});
    leg.eleicoesPerdidas = (leg.eleicoesPerdidas || 0) + 1;
    s.reputacao.aprovacao = clamp(s.reputacao.aprovacao - 3, 0, 100);
    s.reputacao.rejeicao = clamp(s.reputacao.rejeicao + 2, 0, 100);
  }
  return null;
}

// compat: alguns lugares chamavam finalizarEleicao diretamente
function finalizarEleicao(s) { return finalizarTurno(s); }
export { finalizarEleicao };

// Chamado quando o jogador fecha a tela de resultado.
export function encerrarEleicao(state) {
  state.eleicao = null;
}
