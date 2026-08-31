import { createRng, clamp } from './rng';
import { semear } from './cascade';
import { multGabinete } from './mandate';

export const FORMATOS = [
  { id: 'post', nome: 'Post no feed', tempo: 1, energia: 3, base: [200, 3000], viralMax: 0.06, rejeicaoRisco: 0.15 },
  { id: 'story', nome: 'Sequência de stories', tempo: 1, energia: 2, base: [500, 6000], viralMax: 0.04, rejeicaoRisco: 0.1 },
  { id: 'reels', nome: 'Reels', tempo: 1, energia: 6, base: [800, 12000], viralMax: 0.25, rejeicaoRisco: 0.35 },
  { id: 'carrossel', nome: 'Carrossel explicativo', tempo: 2, energia: 6, base: [400, 5000], viralMax: 0.05, rejeicaoRisco: 0.05 },
  { id: 'live', nome: 'Live', tempo: 2, energia: 12, base: [1000, 9000], viralMax: 0.08, rejeicaoRisco: 0.2 },
];

export const PAUTAS = [
  { id: 'pessoal', nome: 'Bastidor / pessoal', carismaPeso: 1.2, aprovacao: [0, 2], rejeicao: 0.6 },
  { id: 'proposta', nome: 'Proposta / pauta séria', carismaPeso: 0.8, comunicacaoPeso: 1.2, aprovacao: [1, 4], confianca: [1, 3], rejeicao: 0.5 },
  { id: 'denuncia', nome: 'Denúncia / crítica', carismaPeso: 0.9, coragemPeso: 1.1, aprovacao: [-1, 3], rejeicao: 1.6, ecoBonus: 1.5 },
  { id: 'territorio', nome: 'Vídeo territorial (um bairro)', empatiaPeso: 1.2, aprovacao: [1, 3], confianca: [1, 2], rejeicao: 0.7 },
  { id: 'humor', nome: 'Humor / meme', improvisoPeso: 1.3, aprovacao: [-1, 2], rejeicao: 1.2, ecoBonus: 1.3 },
];

// Etapa 3 — relevância midiática (0-100): o quanto o jogador "existe" na mídia.
// Combina notoriedade + tamanho de audiência (log) + repercussão + peso do cargo.
// NÃO é aprovação nem intenção de voto — é presença/alcance público.
const PESO_CARGO_MIDIA = {
  PREFEITO: 12, DEPUTADO_FEDERAL: 10, DEPUTADO_ESTADUAL: 7, VEREADOR: 4,
};
export function relevanciaMidiatica(state) {
  const r = state.reputacao;
  const seg = state.redes?.seguidores || 0;
  const audiencia = clamp((Math.log10(1 + seg) - 3) * 11, 0, 30); // 10k≈11 · 100k≈22 · 1M≈33→30
  const eco = Math.max(0, r.ecoMidiatico) * 0.22;
  const cargo = PESO_CARGO_MIDIA[state.personagem.cargoAtual] || 0;
  const gCom = multGabinete(state, 'midia'); // assessoria de comunicação
  return Math.round(clamp((r.notoriedade * 0.5 + audiencia + eco + cargo) * gCom, 0, 100));
}

export function estimarAlcance(state) {
  const seg = state.redes.seguidores;
  const engaj = state.redes.engajamento;
  const noto = state.reputacao.notoriedade / 100;
  // Fase 14 — imagem de proximidade/renovação puxa o alcance orgânico
  const img = state.personagem.imagem || {};
  const bonusImg = (((img.proximidade ?? 50) + (img.renovacao ?? 50)) / 2 - 50) / 50 * 0.15;
  return Math.round(seg * (0.2 + engaj * 3 + noto * 0.4) * (1 + bonusImg));
}

// Publica um conteúdo. Muta state. Retorna { views, resumo }.
export function postar(state, formatoId, pautaId) {
  const f = FORMATOS.find((x) => x.id === formatoId) || FORMATOS[0];
  const pauta = PAUTAS.find((x) => x.id === pautaId) || PAUTAS[0];
  if (state.tempo.pontosRestantes < f.tempo) throw new Error(`Sem tempo (custa ${f.tempo}).`);

  const rng = createRng(state.meta.seed, state.meta.rngState);
  state.tempo.pontosRestantes -= f.tempo;
  state.tempo.energia = clamp(state.tempo.energia - f.energia, 0, state.tempo.energiaMax);

  const a = state.personagem.atributos;
  const skillMidia = state.personagem.skills.midia || 0;
  const q = 0.5
    + ((a.carisma - 50) / 200) * (pauta.carismaPeso || 0)
    + ((a.comunicacao - 50) / 200) * (pauta.comunicacaoPeso || 0)
    + ((a.coragem - 50) / 200) * (pauta.coragemPeso || 0)
    + ((a.empatia - 50) / 200) * (pauta.empatiaPeso || 0)
    + ((a.improviso - 50) / 200) * (pauta.improvisoPeso || 0)
    + skillMidia / 300;

  // Etapa 8 — assessoria de comunicação amplia alcance e chance viral
  const gCom = multGabinete(state, 'redes');
  // alcance base + cauda longa de viralização
  let views = rng.rangeInt(f.base) * (0.6 + q) * gCom;
  const rollViral = rng.float();
  const chanceViral = clamp((f.viralMax * (0.5 + q) + (pauta.ecoBonus ? 0.03 : 0)) * gCom, 0, 0.45);
  let viralizou = false;
  if (rollViral < chanceViral) {
    viralizou = true;
    const mult = rng.range([8, 60]) * (rng.chance(0.15) ? rng.range([3, 12]) : 1);
    views *= mult;
  }
  views = Math.round(views);

  const escala = Math.max(0, Math.log10(Math.max(10, views)) - 2.4); // ~0..4

  // seguidores
  const dSeg = Math.round(views * rng.range([0.004, 0.02]) * (0.7 + q));
  state.redes.seguidores = Math.max(0, state.redes.seguidores + dSeg);
  state.redes.alcanceMedio = Math.round((state.redes.alcanceMedio * 2 + views) / 3);

  // reputação
  const noto = escala * rng.range([0.8, 1.6]);
  state.reputacao.notoriedade = clamp(state.reputacao.notoriedade + noto, 0, 100);
  const eco = escala * rng.range([0.6, 1.4]) * (pauta.ecoBonus || 1);
  state.reputacao.ecoMidiatico = clamp(state.reputacao.ecoMidiatico + eco, -50, 100);

  if (pauta.aprovacao) {
    state.reputacao.aprovacao = clamp(state.reputacao.aprovacao + rng.range(pauta.aprovacao) * (viralizou ? 1.5 : 1), 0, 100);
  }
  if (pauta.confianca) {
    state.reputacao.confianca = clamp(state.reputacao.confianca + rng.range(pauta.confianca), 0, 100);
  }
  // risco de rejeição: some com viralização e pauta polêmica
  const rejRoll = rng.float();
  let rejTxt = '';
  let virouPolemica = false;
  if (rejRoll < f.rejeicaoRisco * pauta.rejeicao * (viralizou ? 1.6 : 1)) {
    const dRej = escala * rng.range([0.8, 2.2]);
    state.reputacao.rejeicao = clamp(state.reputacao.rejeicao + dRej, 0, 100);
    rejTxt = `, rejeição +${dRej.toFixed(1)}`;
    // FASE 12 — se viralizou negativo e forte, vira uma cascata de polêmica
    if (viralizou && escala > 2 && dRej > 3) {
      semear(state, 'polemica_viral', { tema: pauta.nome.toLowerCase() });
      virouPolemica = true;
    }
  }

  state.meta.rngState = rng.state;

  const resumo = `${f.nome} (${pauta.nome}): ${fmtViews(views)} visualizações${viralizou ? ' — VIRALIZOU' : ''}${virouPolemica ? ' — E VIROU POLÊMICA' : ''}, +${dSeg} seguidores, notoriedade +${noto.toFixed(1)}${rejTxt}`;
  state.log.unshift({ mes: state.tempo.mes, tipo: viralizou ? 'CRISE' : 'ACAO', texto: resumo });
  if (viralizou) {
    state.mundo.noticias.unshift({
      id: `nt_viral_${state.tempo.mes}_${state.log.length}`, mes: state.tempo.mes, tipo: 'MIDIA', destaque: true, atores: [],
      texto: `Um ${f.nome.toLowerCase()} seu viralizou (${fmtViews(views)} views).`,
    });
  }
  return { views, viralizou, dSeg, resumo };
}

function fmtViews(v) {
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)} mi`;
  if (v >= 1e3) return `${Math.round(v / 1e3)} mil`;
  return `${v}`;
}
