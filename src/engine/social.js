import { createRng, streamRng, clamp } from './rng';
import { semear } from './cascade';
import { multGabinete } from './mandate';
import { bairrosDaCidade } from './offices';

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

  // Item 22 — engajamento era fixo desde a criação do personagem (nunca lido em lugar
  // nenhum como consequência). Conteúdo consistentemente bom/ruim agora o desloca aos poucos.
  state.redes.engajamento = clamp(state.redes.engajamento + (q - 0.5) * 0.006, 0.01, 0.15);

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

// ============================================================
// Item 9 — LIVES e CAIXA DE PERGUNTAS
// ============================================================

// Gera 3 perguntas para a caixa, puxando o histórico real do personagem.
export function perguntasCaixa(state) {
  const rng = streamRng(state.meta.seed, 'caixa', state.tempo.mes);
  const p = state.personagem;
  const pool = [];

  const promAberta = (state.mandato?.promessas || []).find((x) => !x.cumprida && state.tempo.mes > (x.mesFeita ?? 0) + 4);
  if (promAberta) pool.push({ id: 'promessa', peso: 2, texto: 'E aquela promessa que você fez e não saiu do papel?', tons: [
    { id: 'assume', texto: 'Assumir o atraso e dar um prazo real', dRep: { confianca: [1, 3] }, score: 1 },
    { id: 'desvia', texto: '"Tá em andamento" e seguir', dRep: { confianca: [-2, 0], rejeicao: [1, 3] }, score: -1 },
  ] });

  const proj = (state.mandato?.projetos || []).find((x) => x.status === 'APROVADO');
  if (proj) pool.push({ id: 'projeto', peso: 1.4, texto: `Seu projeto "${proj.titulo}" já mudou alguma coisa na prática?`, tons: [
    { id: 'mostra', texto: 'Mostrar o resultado concreto', dRep: { notoriedade: [1, 3], confianca: [1, 2] }, score: 1 },
    { id: 'vago', texto: 'Responder no genérico', dRep: {}, score: 0 },
  ] });

  const cascata = (state.mundo?.cascatas || []).find((c) => !c.encerrada);
  if (cascata) pool.push({ id: 'polemica', peso: 1.8, texto: 'Todo mundo tá comentando aquela polêmica. Sua versão?', tons: [
    { id: 'esclarece', texto: 'Esclarecer com calma e fatos', dRep: { rejeicao: [-2, 1], confianca: [0, 2] }, score: 1 },
    { id: 'ataca', texto: 'Dizer que é perseguição', dRep: { rejeicao: [2, 5], ecoMidiatico: [2, 5] }, score: -1 },
  ] });

  if ((p.partidoHistorico || []).length >= 2) pool.push({ id: 'partido', peso: 1.2, texto: 'Por que você trocou de partido?', tons: [
    { id: 'principio', texto: 'Explicar a divergência de rumo', dRep: { confianca: [0, 2] }, score: 1 },
    { id: 'ironia', texto: 'Responder com deboche', dRep: { rejeicao: [1, 4] }, score: -1 },
  ] });

  if ((p.instituicoes || []).length) pool.push({ id: 'instituicao', peso: 1, texto: `Como anda o(a) ${p.instituicoes[0].nome}?`, tons: [
    { id: 'orgulho', texto: 'Contar o impacto com números', dRep: { confianca: [1, 3], notoriedade: [0, 2] }, score: 1 },
    { id: 'promo', texto: 'Usar só pra autopromoção', dRep: { rejeicao: [0, 2] }, score: 0 },
  ] });

  // sempre disponíveis
  pool.push({ id: 'cargo', peso: 0.9, texto: p.cargoAtual && p.cargoAtual !== 'NENHUM' ? 'O que você já conseguiu no mandato até agora?' : 'Por que a gente deveria votar em você?', tons: [
    { id: 'claro', texto: 'Resposta direta e honesta', dRep: { confianca: [1, 3], notoriedade: [0, 2] }, score: 1 },
    { id: 'discurso', texto: 'Discurso pronto de campanha', dRep: { rejeicao: [0, 2] }, score: 0 },
  ] });
  pool.push({ id: 'pessoal', peso: 0.8, texto: 'Uma pergunta pessoal: o que te tira o sono?', tons: [
    { id: 'humano', texto: 'Abrir de verdade', dRep: { confianca: [1, 3], rejeicao: [-2, 0] }, score: 1 },
    { id: 'fecha', texto: 'Desconversar', dRep: {}, score: 0 },
  ] });
  pool.push({ id: 'critica', peso: 1, texto: 'Tem muita gente aqui te xingando. O que responde?', tons: [
    { id: 'serena', texto: 'Responder sem se alterar', dRep: { confianca: [1, 2], rejeicao: [-1, 1] }, score: 1 },
    { id: 'bate', texto: 'Bater de frente com os haters', dRep: { rejeicao: [2, 5], notoriedade: [1, 3] }, score: -1 },
  ] });

  const especificas = pool.filter((q) => ['promessa', 'projeto', 'polemica', 'partido', 'instituicao'].includes(q.id));
  const genericas = pool.filter((q) => !especificas.includes(q));
  const escolhidas = [];
  const rest = [...especificas];
  while (escolhidas.length < 3 && rest.length) {
    const q = rng.weighted(rest, (x) => x.peso);
    escolhidas.push(q); rest.splice(rest.indexOf(q), 1);
  }
  for (const q of rng.shuffle(genericas)) { if (escolhidas.length >= 3) break; escolhidas.push(q); }
  return escolhidas.slice(0, 3);
}

// Faz uma live. modo: 'aberta' | 'bairro' | 'caixa'.
export function fazerLive(state, { modo = 'aberta', bairroId = null, respostas = [] } = {}) {
  if ((state.tempo.pontosRestantes ?? 0) < 2) throw new Error('Sem tempo (custa 2).');
  const r = state.redes;
  if ((r.ultimaLive ?? -99) === state.tempo.mes) throw new Error('Você já fez uma live este mês.');
  state.tempo.pontosRestantes -= 2;
  state.tempo.energia = clamp(state.tempo.energia - 12, 0, state.tempo.energiaMax);
  r.ultimaLive = state.tempo.mes;

  const rng = createRng(state.meta.seed, state.meta.rngState);
  const a = state.personagem.atributos;
  const preparo = ((a.comunicacao ?? 45) + (a.oratoria ?? 45) + (a.carisma ?? 45)) / 3;
  const gCom = multGabinete(state, 'redes');
  const alcanceBase = estimarAlcance(state);
  let views = Math.round(alcanceBase * rng.range([0.6, 1.4]) * gCom * (modo === 'bairro' ? 0.5 : 1));
  const m = state.tempo.mes;

  let score = 0; let txt;
  if (modo === 'caixa') {
    const perguntas = perguntasCaixa(state);
    respostas.forEach((tomId, i) => {
      const q = perguntas[i];
      const tom = q?.tons.find((t) => t.id === tomId) || q?.tons[0];
      if (!tom) return;
      score += tom.score;
      for (const [k, faixa] of Object.entries(tom.dRep || {})) {
        let d = rng.range(faixa);
        if (d < 0) d *= 1 - (preparo - 50) / 200;
        state.reputacao[k] = clamp((state.reputacao[k] ?? 0) + Math.round(d * 10) / 10, k === 'ecoMidiatico' ? -50 : 0, 100);
      }
    });
    txt = 'Caixa de perguntas';
  } else if (modo === 'bairro') {
    const bairros = bairrosDaCidade(state.personagem.cidade);
    const bid = bairroId || bairros[0].id;
    const bnome = bairros.find((b) => b.id === bid)?.nome || bid;
    const t = (state.territorio.porBairro[bid] ||= { presenca: 0, penetracao: 0 });
    const dP = rng.range([2, 5]) * (0.7 + preparo / 200);
    t.presenca = clamp(t.presenca + dP, 0, 100);
    t.penetracao = clamp(t.penetracao + dP * 0.5, 0, 100);
    score = rng.range([0, 1.4]);
    txt = `Live do(a) ${bnome}`;
  } else {
    score = rng.range([-0.6, 1.6]) + (preparo - 50) / 60;
    txt = 'Live aberta';
  }

  // viralizou / flopou
  const chanceViral = clamp((modo === 'aberta' ? 0.1 : 0.05) * gCom + score * 0.03, 0, 0.3);
  const viralizou = rng.chance(chanceViral);
  const flopou = !viralizou && rng.chance(0.22 - clamp(score, -0.5, 1) * 0.12);
  if (viralizou) views = Math.round(views * rng.range([3, 9]));
  if (flopou) views = Math.round(views * rng.range([0.2, 0.5]));

  const dSeg = Math.round(views * rng.range([0.004, 0.02]) * (score > 0 ? 1.3 : 0.7));
  r.seguidores = Math.max(0, r.seguidores + dSeg);
  const noto = clamp((Math.log10(1 + views) - 2) * rng.range([0.8, 1.8]), 0, 8);
  state.reputacao.notoriedade = clamp(state.reputacao.notoriedade + noto, 0, 100);
  state.reputacao.ecoMidiatico = clamp(state.reputacao.ecoMidiatico + (viralizou ? rng.range([4, 10]) : rng.range([1, 4])), -50, 100);

  // gafe: score baixo + sem preparo → escorregão ao vivo
  let virouPolemica = false;
  const dRej = score < 0 || rng.chance(0.18 - (preparo - 50) / 250)
    ? rng.range([1, 4]) * (viralizou ? 1.8 : 1) * (modo === 'caixa' ? 1.2 : 1)
    : rng.range([-1, 1]);
  state.reputacao.rejeicao = clamp(state.reputacao.rejeicao + dRej, 0, 100);
  if (viralizou && dRej > 3 && score < 0) {
    semear(state, 'polemica_viral', { tema: 'uma fala ao vivo' });
    virouPolemica = true;
  } else if (score > 0.8) {
    state.reputacao.aprovacao = clamp(state.reputacao.aprovacao + rng.range([0.5, 2.5]), 0, 100);
  }

  state.meta.rngState = rng.state;
  const resumo = `${txt}: ${fmtViews(views)} espectadores${viralizou ? ' — VIRALIZOU' : flopou ? ' — flopou' : ''}${virouPolemica ? ' — E VIROU POLÊMICA' : ''}, ${dSeg >= 0 ? '+' : ''}${dSeg} seguidores`;
  state.log.unshift({ mes: m, tipo: viralizou ? 'CRISE' : 'ACAO', texto: resumo });
  if (viralizou) {
    state.mundo.noticias.unshift({ id: `nt_live_${m}_${state.log.length}`, mes: m, tipo: 'MIDIA', destaque: true, atores: [], texto: `Uma live de ${state.personagem.nome} viralizou (${fmtViews(views)} espectadores).` });
  }
  return { views, viralizou, flopou, dSeg, virouPolemica, score: +score.toFixed(2), resumo };
}
