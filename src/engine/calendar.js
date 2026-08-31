import balance from '../content/balance.json';
import { clamp } from './rng';
import { arquivarMandato } from './endgame';

// ============================================================
// FASE 6 — Calendário eleitoral
// Eleições municipais em ciclo fixo de 4 anos. O jogador NÃO
// escolhe quando se candidatar: se não estiver pronto na janela,
// perde o ciclo e espera o próximo.
// ============================================================

const CAL = balance.calendario;

// mês base da primeira eleição de cada tipo de pleito
function mesBase(tipo) {
  return tipo === 'GERAL'
    ? (CAL.mesPrimeiraEleicaoGeral ?? CAL.mesPrimeiraEleicaoMunicipal - 24)
    : CAL.mesPrimeiraEleicaoMunicipal;
}

// mês da n-ésima eleição de um tipo (n=0 é a primeira disputável)
export function mesEleicao(n = 0, tipo = 'MUNICIPAL') {
  return mesBase(tipo) + n * CAL.cicloMeses;
}

export function anoDeMes(state, mes) {
  return state.tempo.anoInicial + Math.floor(mes / 12);
}

// próxima eleição de um tipo a partir do mês atual (inclusive)
export function proximaEleicao(state, tipo = 'MUNICIPAL') {
  const m = state.tempo.mes;
  let n = 0;
  while (mesEleicao(n, tipo) < m) n += 1;
  return { n, tipo, mes: mesEleicao(n, tipo), ano: anoDeMes(state, mesEleicao(n, tipo)) };
}

export function eleicaoAtualOuProxima(state) {
  return proximaEleicao(state);
}

// janela em que dá pra lançar candidatura para a próxima eleição de um tipo
export function janelaCandidatura(state, tipo = 'MUNICIPAL') {
  const prox = proximaEleicao(state, tipo);
  const abre = prox.mes - CAL.janelaCandidaturaMeses;
  const fecha = prox.mes - CAL.campanhaMin; // precisa de campanha mínima
  return {
    ...prox,
    abre,
    fecha,
    aberta: state.tempo.mes >= abre && state.tempo.mes <= fecha,
    mesesAteAbrir: Math.max(0, abre - state.tempo.mes),
    mesesAteEleicao: prox.mes - state.tempo.mes,
  };
}

// quantos meses de campanha o jogador terá se lançar candidatura AGORA
export function duracaoCampanhaSeLancar(state, tipo = 'MUNICIPAL', maxCampanha = CAL.campanhaMax) {
  const prox = proximaEleicao(state, tipo);
  return clamp(prox.mes - state.tempo.mes, CAL.campanhaMin, maxCampanha);
}

// mês em que um mandato conquistado nesta eleição termina (próxima eleição do mesmo tipo)
export function fimDoMandato(state, tipo = 'MUNICIPAL') {
  const prox = proximaEleicao(state, tipo);
  return prox.mes + CAL.cicloMeses;
}

// Chamado todo mês: detecta o fim de uma janela de candidatura sem o jogador
// ter concorrido, e o pleito acontecendo à revelia dele.
// cargos cujo mandato é renovado em cada tipo de pleito
const CARGOS_POR_PLEITO = {
  MUNICIPAL: ['VEREADOR', 'PREFEITO'],
  GERAL: ['DEPUTADO_ESTADUAL', 'DEPUTADO_FEDERAL', 'SENADOR', 'GOVERNADOR'],
};

export function tickCalendario(s) {
  const eventos = [];
  const m = s.tempo.mes;
  s.flags = s.flags || {};

  for (const tipo of ['MUNICIPAL', 'GERAL']) {
    for (let n = 0; n <= 10; n++) {
      if (mesEleicao(n, tipo) !== m) continue;
      const chave = `${tipo}_${m}`;
      if ((s.flags.eleicoesRealizadas || []).includes(chave)) continue;
      s.flags.eleicoesRealizadas = [...(s.flags.eleicoesRealizadas || []), chave];

      const naEleicaoPropria = s.eleicao && s.eleicao.status !== 'APURADO'
        && (s.eleicao.tipoPleito || 'MUNICIPAL') === tipo;
      const faseAntes = s.personagem.fase;
      const ano = anoDeMes(s, m);
      const rotulo = tipo === 'GERAL' ? 'eleição geral' : 'eleição municipal';

      // titular cujo mandato é deste pleito e que não disputou: mandato encerra
      const mandatoDestePleito = !!s.mandato
        && CARGOS_POR_PLEITO[tipo].includes(s.mandato.cargo || 'VEREADOR');
      if (!naEleicaoPropria && faseAntes === 'MANDATO' && mandatoDestePleito) {
        const nomeCargo = (s.mandato.cargo || 'VEREADOR').toLowerCase().replace(/_/g, ' ');
        s.personagem.fase = 'PARTIDO';
        s.personagem.cargoAtual = 'NENHUM';
        s.personagem.licenciado = false;
        s.personagem.historicoPolitico.push({ mes: m, texto: `Não disputou a reeleição de ${ano}. Fim do mandato de ${nomeCargo}.` });
        arquivarMandato(s); // Fase 30
        s.mandato = null;
        s.log.unshift({ mes: m, tipo: 'MARCO', texto: `Seu mandato terminou — você não disputou a reeleição de ${ano}.` });
        eventos.push({ tipo: 'CALENDARIO', texto: `Fim do mandato: você não disputou a reeleição de ${ano}.` });
      }

      if (!naEleicaoPropria && ['VIDA', 'VIDA_PUBLICA', 'PARTIDO'].includes(faseAntes)) {
        s.mundo.noticias.unshift({
          id: `nt_pleito_${chave}`, mes: m, tipo: 'CIDADE', destaque: true, atores: [],
          texto: `${rotulo[0].toUpperCase()}${rotulo.slice(1)} de ${ano} realizada. Você ficou de fora deste ciclo — o próximo é só daqui a 4 anos.`,
        });
        s.log.unshift({ mes: m, tipo: 'MARCO', texto: `Passou a ${rotulo} de ${ano}. Você não concorreu.` });
        if (s.personagem.fase === 'PARTIDO' && tipo === 'MUNICIPAL') {
          const pr = s.mundo.partidosRuntime?.[s.personagem.partidoId];
          if (pr) pr.apoioAoJogador = Math.max(0, pr.apoioAoJogador - 8);
          s.reputacao.aprovacao = Math.max(0, s.reputacao.aprovacao - 2);
        }
        eventos.push({ tipo: 'CALENDARIO', texto: `A ${rotulo} de ${ano} passou sem você.` });
      }
    }
  }
  return { state: s, eventos };
}
