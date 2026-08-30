import { streamRng, clamp } from './rng';
import neighborhoods from '../content/neighborhoods/recife.json';

// ============================================================
// FASE 31 — Narrativa emergente: MOTOR DE CASCATA
// Um evento significativo não termina em si. Ele planta uma cascata
// que avança um estágio por mês, cada estágio produzindo notícia +
// efeito. Ninguém roteiriza a história inteira — os estágios se
// encadeiam a partir do estado.
//   ignorar bairro → líder reclama → jornalista publica → rival
//   compartilha → viral → pesquisa cai → você responde
// ============================================================

const MAX_ATIVAS = 3;

// Modelos de cascata. Cada estágio: { texto(dados,s), efeito(s,rng,dados), próximoEm:[min,max] }
const MODELOS = {
  bairro_ignorado: {
    rótulo: 'Revolta de bairro',
    estagios: [
      {
        txt: (d) => `Lideranças da ${d.bairroNome} reclamam publicamente que você sumiu.`,
        ef: (s, rng) => { s.reputacao.confianca = clamp(s.reputacao.confianca - rng.range([1, 3]), 0, 100); },
        prox: [1, 2], tipo: 'CIDADE',
      },
      {
        txt: (d) => `Um portal publica: "Vereador abandonou a ${d.bairroNome}".`,
        ef: (s, rng, d) => {
          s.reputacao.ecoMidiatico = clamp(s.reputacao.ecoMidiatico - rng.range([3, 7]), -50, 100);
          const t = s.territorio.porBairro[d.bairroId];
          if (t) t.presenca = clamp(t.presenca - rng.range([2, 6]), 0, 100);
        },
        prox: [1, 2], tipo: 'MIDIA',
      },
      {
        txt: (d) => `Seu principal adversário foi à ${d.bairroNome} e postou de lá.`,
        ef: (s, rng, d) => {
          const t = s.territorio.porBairro[d.bairroId] || { presenca: 0, penetracao: 0 };
          t.presenca = clamp(t.presenca - rng.range([1, 4]), 0, 100);
          s.territorio.porBairro[d.bairroId] = t;
        },
        prox: [1, 2], tipo: 'ATAQUE',
      },
      {
        txt: () => 'O vídeo do abandono viralizou. Comentários pesados.',
        ef: (s, rng) => {
          s.reputacao.rejeicao = clamp(s.reputacao.rejeicao + rng.range([2, 6]), 0, 100);
          s.reputacao.aprovacao = clamp(s.reputacao.aprovacao - rng.range([1, 4]), 0, 100);
        },
        prox: [1, 1], tipo: 'REDES',
      },
    ],
  },

  gafe_publica: {
    rótulo: 'Repercussão de fala',
    estagios: [
      {
        txt: () => 'O corte da sua fala está circulando fora de contexto.',
        ef: (s, rng) => { s.reputacao.ecoMidiatico = clamp(s.reputacao.ecoMidiatico + rng.range([2, 5]), -50, 100); },
        prox: [1, 1], tipo: 'REDES',
      },
      {
        txt: () => 'Colunistas comentaram a fala. Nem todos foram gentis.',
        ef: (s, rng) => { s.reputacao.rejeicao = clamp(s.reputacao.rejeicao + rng.range([2, 5]), 0, 100); },
        prox: [1, 2], tipo: 'MIDIA',
      },
      {
        txt: () => 'Um influenciador fez um vídeo te alfinetando. Bombou.',
        ef: (s, rng) => {
          s.reputacao.rejeicao = clamp(s.reputacao.rejeicao + rng.range([2, 6]), 0, 100);
          s.reputacao.notoriedade = clamp(s.reputacao.notoriedade + rng.range([1, 4]), 0, 100);
        },
        prox: [1, 2], tipo: 'REDES',
      },
    ],
  },

  polemica_viral: {
    rótulo: 'Bola de neve de uma polêmica',
    estagios: [
      {
        txt: (d) => `Sua publicação sobre ${d.tema || 'o assunto'} virou polêmica e está nos trending topics.`,
        ef: (s, rng) => {
          s.reputacao.ecoMidiatico = clamp(s.reputacao.ecoMidiatico + rng.range([4, 9]), -50, 100);
          s.reputacao.notoriedade = clamp(s.reputacao.notoriedade + rng.range([2, 5]), 0, 100);
        },
        prox: [1, 1], tipo: 'REDES',
      },
      {
        txt: () => 'Colunistas e portais entraram no assunto. A maioria não te poupou.',
        ef: (s, rng) => { s.reputacao.rejeicao = clamp(s.reputacao.rejeicao + rng.range([2, 5]), 0, 100); },
        prox: [1, 1], tipo: 'MIDIA',
      },
      {
        txt: () => 'Adversários compartilharam em peso, chamando de "a fala que define quem você é".',
        ef: (s, rng) => {
          s.reputacao.rejeicao = clamp(s.reputacao.rejeicao + rng.range([2, 5]), 0, 100);
          s.reputacao.aprovacao = clamp(s.reputacao.aprovacao - rng.range([1, 3]), 0, 100);
        },
        prox: [1, 1], tipo: 'ATAQUE',
      },
      {
        txt: () => 'Influenciadores fizeram vídeos te alfinetando. Um deles passou de 2 milhões de views.',
        ef: (s, rng) => {
          s.reputacao.rejeicao = clamp(s.reputacao.rejeicao + rng.range([3, 7]), 0, 100);
          const d = -Math.round(s.redes.seguidores * rng.range([0.01, 0.04]));
          s.redes.seguidores = Math.max(0, s.redes.seguidores + d);
        },
        prox: [1, 1], tipo: 'REDES',
      },
      {
        txt: () => 'A próxima pesquisa registrou o estrago: intenção de voto e aprovação caíram.',
        ef: (s, rng) => {
          s.reputacao.aprovacao = clamp(s.reputacao.aprovacao - rng.range([2, 5]), 0, 100);
        },
        prox: [1, 1], tipo: 'PESQUISA',
      },
    ],
  },

  projeto_rejeitado: {
    rótulo: 'Derrota legislativa',
    estagios: [
      {
        txt: (d) => `A imprensa noticiou a derrota do seu projeto "${d.titulo}".`,
        ef: (s, rng) => { s.reputacao.aprovacao = clamp(s.reputacao.aprovacao - rng.range([0.5, 2]), 0, 100); },
        prox: [1, 2], tipo: 'MIDIA',
      },
      {
        txt: () => 'Aliados começam a questionar sua articulação nos bastidores.',
        ef: (s, rng) => {
          const pr = s.mundo.partidosRuntime?.[s.personagem.partidoId];
          if (pr) pr.apoioAoJogador = clamp(pr.apoioAoJogador - rng.range([2, 6]), 0, 100);
        },
        prox: [1, 2], tipo: 'POLITICA',
      },
    ],
  },
};

// Semeia uma cascata (chamado pelos sistemas quando algo relevante acontece).
export function semear(state, tipo, dados = {}) {
  if (!MODELOS[tipo]) return;
  state.mundo.cascatas = state.mundo.cascatas || [];
  if (state.mundo.cascatas.filter((c) => !c.encerrada).length >= MAX_ATIVAS) return;
  if (state.mundo.cascatas.some((c) => !c.encerrada && c.tipo === tipo && c.dados.bairroId === dados.bairroId)) return;
  state.mundo.cascatas.push({
    id: `casc_${state.tempo.mes}_${tipo}_${state.mundo.cascatas.length}`,
    tipo, dados, estagio: 0, proximoMes: state.tempo.mes + 1, encerrada: false,
  });
}

export function tickCascatas(s) {
  s.mundo.cascatas = s.mundo.cascatas || [];
  const mes = s.tempo.mes;
  const eventos = [];
  const rng = streamRng(s.meta.seed, 'casc', mes);

  for (const c of s.mundo.cascatas) {
    if (c.encerrada || mes < c.proximoMes) continue;
    const modelo = MODELOS[c.tipo];
    const est = modelo.estagios[c.estagio];
    if (!est) { c.encerrada = true; continue; }

    const texto = est.txt(c.dados, s);
    try { est.ef(s, rng, c.dados); } catch { /* efeito falhou, segue */ }

    s.mundo.noticias.unshift({
      id: `nt_casc_${c.id}_${c.estagio}`, mes, tipo: est.tipo, destaque: c.estagio >= 2, atores: [],
      texto,
    });
    s.mundo.noticias = s.mundo.noticias.slice(0, 80);
    eventos.push({ tipo: 'CASCATA', texto });

    c.estagio += 1;
    if (c.estagio >= modelo.estagios.length) c.encerrada = true;
    else c.proximoMes = mes + rng.rangeInt(est.prox);

    // o jogador pode "cortar" uma cascata respondendo bem — feito via ação/entrevista
    // (marcador para a UI mostrar o botão)
  }

  // poda cascatas encerradas antigas
  s.mundo.cascatas = s.mundo.cascatas.filter((c) => !c.encerrada || mes - c.proximoMes < 6);
  return { state: s, eventos };
}

// Reduz o dano / encerra uma cascata (chamado ao responder bem numa entrevista/ação)
export function conterCascata(state, cascataId, forca = 1) {
  const c = (state.mundo.cascatas || []).find((x) => x.id === cascataId);
  if (!c || c.encerrada) return false;
  c.estagio = Math.min(c.estagio + Math.ceil(forca), MODELOS[c.tipo].estagios.length);
  if (c.estagio >= MODELOS[c.tipo].estagios.length) c.encerrada = true;
  else c.proximoMes = state.tempo.mes + 3;
  return true;
}

export function cascatasAtivas(state) {
  return (state.mundo.cascatas || []).filter((c) => !c.encerrada).map((c) => ({
    ...c, rótulo: MODELOS[c.tipo]?.rótulo || c.tipo,
    total: MODELOS[c.tipo]?.estagios.length || 0,
  }));
}

export function nomeBairro(id) {
  return neighborhoods.bairros.find((b) => b.id === id)?.nome || id;
}
