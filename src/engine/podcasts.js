// Fase 14 — podcasts / programas de longa duração + imagem pública.
// Um podcast é uma aposta grande: muito tempo e energia, mas alcance concentrado
// num nicho e efeito forte sobre a IMAGEM (personagem.imagem, 4 eixos 0-100),
// que por sua vez pesa no modelo de votos.

import podcastsDef from '../content/podcasts.json';
import partiesDef from '../content/parties.json';
import { createRng, clamp } from './rng';
import { registrarMarco } from './milestones';
import { ajustarImagem } from './image';

export const PODCASTS = podcastsDef.podcasts;
export const POSTURAS = podcastsDef.posturas;

export {
  IMAGEM_EIXOS, imagemAtual, imagemResumo, ajustarImagem,
} from './image';

export function podcastPorId(id) {
  return PODCASTS.find((p) => p.id === id) || null;
}
export function posturaPorId(id) {
  return POSTURAS.find((p) => p.id === id) || POSTURAS[0];
}

function partido(id) {
  return partiesDef.partidos.find((p) => p.id === id) || partiesDef.partidos[0];
}

export function podcastsDisponiveis(state) {
  const noto = state.reputacao.notoriedade;
  return PODCASTS
    .map((p) => ({ ...p, convida: noto >= p.alcance * 0.35 }))
    .filter((p) => p.convida || noto >= 12);
}

export function gravarPodcast(state, podcastId, posturaId, { cobrarCusto = true } = {}) {
  const pod = podcastPorId(podcastId);
  if (!pod) throw new Error('Podcast não encontrado.');
  const postura = posturaPorId(posturaId);

  const rng = createRng(state.meta.seed, state.meta.rngState);
  if (cobrarCusto) {
    if (state.tempo.pontosRestantes < pod.custo.tempo) throw new Error(`Sem tempo (custa ${pod.custo.tempo}).`);
    state.tempo.pontosRestantes -= pod.custo.tempo;
    state.tempo.energia = clamp(state.tempo.energia - pod.custo.energia, 0, state.tempo.energiaMax);
  }

  const a = state.personagem.atributos;
  const preparo = ((a.comunicacao + a.oratoria + a.inteligencia) / 3 - 50) / 100 * (postura.preparoPeso || 1)
    + (a.improviso - 50) / 200;
  const pa = partido(state.personagem.partidoId);
  const afinidadeHost = 1 - Math.abs((pa.eixo || 0) - pod.eixoHost) / 140; // ~0.3..1
  const desempenho = rng.gauss(
    preparo * (pod.rigor / 55) + (afinidadeHost - 0.6) * 0.6 + 0.05,
    0.26,
  );
  const alcance = pod.alcance / 100;
  const bom = desempenho > 0.28;
  const ruim = desempenho < -0.18;

  const resumo = [];

  // notoriedade — sempre relevante, escala com alcance
  const noto = rng.range([4, 9]) * (0.5 + alcance) * (bom ? 1.15 : ruim ? 0.7 : 1);
  state.reputacao.notoriedade = clamp(state.reputacao.notoriedade + noto, 0, 100);
  state.reputacao.ecoMidiatico = clamp(state.reputacao.ecoMidiatico + rng.range([3, 9]) * alcance * (ruim ? -0.6 : 1), -50, 100);
  const dSeg = Math.round(state.redes.seguidores * rng.range([0.01, 0.04]) * (0.6 + alcance) * (bom ? 1.4 : 1));
  state.redes.seguidores += dSeg;
  resumo.push(`notoriedade +${noto.toFixed(1)}`, `+${dSeg.toLocaleString('pt-BR')} seguidores`);

  // imagem — postura + amplificação nos eixos-foco do programa se foi bem
  const escalaImg = bom ? 1.25 : ruim ? 0.4 : 0.85;
  ajustarImagem(state, postura.imagem, escalaImg);
  for (const eixo of pod.imagemFoco || []) {
    ajustarImagem(state, { [eixo]: bom ? 3 : ruim ? -2 : 1 });
  }

  // grupos do nicho reagem
  const dGrupo = (bom ? rng.range([5, 11]) : ruim ? -rng.range([2, 6]) : rng.range([1, 4]));
  for (const gid of pod.publico) {
    // reaproveita o canal de satisfação de grupos (Fase 8) sem tema — direto
    state.mundo.satisfacaoGrupos ||= {};
    state.mundo.satisfacaoGrupos[gid] = clamp((state.mundo.satisfacaoGrupos[gid] || 0) + dGrupo, -100, 100);
  }
  resumo.push(bom ? `bem recebido pelo público de ${pod.nicho.toLowerCase()}` : ruim ? `público de ${pod.nicho.toLowerCase()} não curtiu` : 'recepção morna');

  // aprovação / rejeição
  if (bom) state.reputacao.aprovacao = clamp(state.reputacao.aprovacao + rng.range([1, 4]), 0, 100);
  const riscoRej = (postura.rejeicaoRisco || 1) * (ruim ? 1.8 : 1) * (afinidadeHost < 0.55 ? 1.5 : 1);
  if (rng.float() < 0.22 * riscoRej) {
    const dRej = rng.range([2, 6]) * (0.6 + alcance);
    state.reputacao.rejeicao = clamp(state.reputacao.rejeicao + dRej, 0, 100);
    resumo.push(`rejeição +${dRej.toFixed(1)} (um corte polêmico circulou)`);
  }

  // manchete + marco
  const manchete = bom
    ? `${state.personagem.nome} vai ao ${pod.nome} e agrada o público de ${pod.nicho.toLowerCase()}`
    : ruim
      ? `Participação de ${state.personagem.nome} no ${pod.nome} rende cortes ruins`
      : `${state.personagem.nome} participa do ${pod.nome}`;
  state.mundo.noticias.unshift({
    id: `nt_pod_${podcastId}_${state.tempo.mes}`, mes: state.tempo.mes, tipo: 'MIDIA', destaque: true, atores: [],
    texto: manchete + '.',
  });
  state.log.unshift({ mes: state.tempo.mes, tipo: bom ? 'MARCO' : 'ACAO', texto: `Podcast ${pod.nome} — ${resumo.join(', ')}.` });
  if (bom && alcance > 0.6) registrarMarco(state, 'MIDIA', `Boa aparição no ${pod.nome} (${pod.nicho}).`);

  state.meta.rngState = rng.state;
  return { manchete, resumo, bom, ruim };
}
