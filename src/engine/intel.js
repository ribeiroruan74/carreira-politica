import neighborhoods from '../content/neighborhoods/recife.json';
import electorateDef from '../content/electorate.json';
import partiesDef from '../content/parties.json';
import lawsDef from '../content/laws.json';
import { riscosAbertos } from './worldMemory';
import { cascatasAtivas } from './cascade';
import { resumoSatisfacao } from './electorate';
import { eventoNacionalAtual, rotuloClima, climaNacional } from './national';
import { exposicaoDoadores, doadoresResumo } from './donors';
import { imagemResumo } from './image';
import { influenciadoresDisponiveis } from './influencers';
import { temaCanonico } from './mandate';

const BAIRROS = neighborhoods.bairros;
const GRUPOS = electorateDef.grupos;
const TEMAS = lawsDef.temas;
const P = (id) => partiesDef.partidos.find((x) => x.id === id);
const GRUPO = (id) => GRUPOS.find((g) => g.id === id);
const TEMA = (id) => TEMAS.find((t) => t.id === id);
const nomeTema = (id) => TEMA(id)?.nome || id;
const nomeBairro = (id) => BAIRROS.find((b) => b.id === id)?.nome || id;

// ============================================================
// FASE 5 — Central de Inteligência
// Relatórios DERIVADOS do estado. Nada é inventado — cada item
// aponta um número real do jogo. A equipe pode estar errada só
// no julgamento, nunca nos fatos.
// ============================================================

function tendencia(serie, campo, janela = 4) {
  const vals = (serie || []).slice(-janela).map((x) => x[campo]).filter((v) => v != null);
  if (vals.length < 2) return 0;
  return vals[vals.length - 1] - vals[0];
}

export function relatorios(state) {
  const out = [];
  const pa = P(state.personagem.partidoId);

  // ELEITORAL — grupos onde você ganha/perde afinidade
  {
    const eixoJogador = pa?.eixo ?? 0;
    const socialJogador = pa?.eixoSocial ?? eixoJogador;
    const afin = GRUPOS.map((g) => ({
      g,
      dist: Math.abs(g.eixo - eixoJogador) + Math.abs(g.eixoSocial - socialJogador) * 0.6,
    })).sort((a, b) => a.dist - b.dist);
    const forte = afin[0].g;
    const fraco = afin[afin.length - 1].g;
    const dNoto = tendencia(state.series, 'notoriedade');
    const sat = resumoSatisfacao(state).filter((x) => Math.abs(x.valor) >= 8);
    const contra = sat.filter((x) => x.valor < 0);
    const aFavor = sat.filter((x) => x.valor > 0).sort((a, b) => b.valor - a.valor);
    const linhas = [
      `Seu perfil casa melhor com: ${forte.nome}. Pior alinhamento: ${fraco.nome}.`,
      dNoto > 3 ? `Sua notoriedade subiu ${Math.round(dNoto)} pontos nos últimos meses — bom momento para se apresentar a grupos novos.`
        : dNoto < -3 ? `Sua notoriedade caiu ${Math.round(-dNoto)} pontos — o eleitor está te esquecendo.`
          : 'Sua notoriedade está estável.',
    ];
    if (aFavor.length) linhas.push(`Hoje jogam a seu favor: ${aFavor.slice(0, 2).map((x) => `${x.nome} (+${x.valor})`).join(', ')}.`);
    if (contra.length) linhas.push(`Descontentes com você: ${contra.slice(0, 2).map((x) => `${x.nome} (${x.valor})`).join(', ')}. Uma entrega na pauta deles reverte isso.`);
    const traço = imagemResumo(state).filter((x) => x.forca >= 8)[0];
    if (traço) linhas.push(`Imagem que gruda: "${traço.frase}" (${traço.valor}/100). Escolha bem os podcasts.`);
    out.push({ area: 'ELEITORAL', ico: '🗳️', linhas, alerta: contra.some((x) => x.valor <= -35) });
  }

  // INFLUÊNCIA — creators contratados / capturados (Fase 15/16)
  {
    const inf = influenciadoresDisponiveis(state);
    const meus = inf.filter((i) => i.contratado);
    const rivais = inf.filter((i) => i.capturado);
    const cultivaveis = inf.filter((i) => !i.contratado && !i.capturado && i.afinidade > 30 && i.relacao < 30)
      .sort((a, b) => b.alcance - a.alcance)[0];
    const linhas = [
      meus.length ? `${meus.length} influenciador(es) contratados: ${meus.map((i) => i.nome).join(', ')}.` : 'Nenhum influenciador contratado.',
    ];
    if (rivais.length) linhas.push(`Com campanhas rivais: ${rivais.map((i) => `${i.nome} (${i.nicho})`).join(', ')}.`);
    if (cultivaveis) linhas.push(`Vale cultivar ${cultivaveis.nome} (${cultivaveis.nicho}, alcance ${cultivaveis.alcance}): afinidade alta, relação ainda fria.`);
    out.push({ area: 'INFLUÊNCIA', ico: '📱', linhas });
  }

  // NACIONAL — o vento que vem de fora (Fase 24)
  {
    const ev = eventoNacionalAtual(state);
    const c = climaNacional(state);
    const linhas = [`${rotuloClima(state)} (clima ${c > 0 ? '+' : ''}${c}).`];
    if (ev) linhas.push(`Em pauta no país: ${ev.texto}`);
    const alinhado = pa ? (-(pa.eixo || 0) / 100) * (-c / 100) > 0 : false;
    if (Math.abs(c) >= 10) {
      linhas.push(alinhado
        ? 'O momento nacional está a seu favor — dá para ser mais ousado.'
        : 'O vento nacional está contra o seu campo — segure pautas polêmicas e foque no local.');
    }
    out.push({ area: 'NACIONAL', ico: '🇧🇷', linhas });
  }

  // FINANCIAMENTO — de onde vem o dinheiro (Fase 17)
  {
    const doad = doadoresResumo(state);
    if (doad.length) {
      const exp = exposicaoDoadores(state);
      const top = doad[0];
      const linhas = [
        `${doad.length} financiador(es) na sua base. Maior: ${top.nome} (${top.setorNome}), R$ ${top.valorTotal.toLocaleString('pt-BR')}.`,
        `Exposição do financiamento: ${exp}/100.`,
      ];
      if (exp >= 55) linhas.push('Concentração alta de doações de um mesmo setor — material fácil para uma reportagem. Diversifique ou reduza o ritmo.');
      const cobrando = doad.find((d) => d.cobrado === false && d.risco >= 40);
      if (cobrando) linhas.push(`${cobrando.nome} pode vir cobrar contrapartida a qualquer momento.`);
      out.push({ area: 'FINANCIAMENTO', ico: '💰', linhas, alerta: exp >= 65 });
    }
  }

  // TERRITORIAL — bairros com potencial
  {
    const oportunidades = BAIRROS
      .map((b) => {
        const t = state.territorio.porBairro[b.id] || { presenca: 0 };
        const alinho = 1 - Math.abs((pa?.eixo ?? 0) - b.eixo) / 100;
        const potencial = (b.populacao / 1000) * alinho * (1 - t.presenca / 100);
        return { b, t, potencial };
      })
      .sort((a, b) => b.potencial - a.potencial);
    const alvo = oportunidades[0];
    const seuForte = Object.entries(state.territorio.porBairro)
      .sort((a, b) => b[1].presenca - a[1].presenca)[0];
    out.push({
      area: 'TERRITORIAL', ico: '📍',
      linhas: [
        `Maior potencial não explorado: ${alvo.b.nome} (${(alvo.b.populacao / 1000).toFixed(0)} mil hab., perfil favorável, sua presença ${Math.round(alvo.t.presenca)}).`,
        seuForte
          ? `Seu reduto: ${BAIRROS.find((x) => x.id === seuForte[0])?.nome} (presença ${Math.round(seuForte[1].presenca)}). Não descuide dele.`
          : 'Você ainda não tem base territorial firme em nenhum bairro.',
      ],
    });
  }

  // POLÍTICO — quem pode te apoiar
  {
    const vereadores = Object.values(state.mundo.politicos || {})
      .filter((p) => p.ativo && p.cargo === 'VEREADOR');
    const proximos = vereadores.filter((p) => p.relacaoJogador > 20);
    const cultivaveis = vereadores
      .filter((p) => p.relacaoJogador > 0 && p.relacaoJogador <= 20
        && Math.abs(p.ideologiaEixo - (pa?.eixo ?? 0)) < 35)
      .sort((a, b) => b.influencia - a.influencia)[0];
    const adversarioForte = vereadores
      .filter((p) => p.relacaoJogador < -10)
      .sort((a, b) => b.influencia - a.influencia)[0];
    out.push({
      area: 'POLÍTICO', ico: '🤝',
      linhas: [
        `${proximos.length} vereador(es) hoje votariam com você numa pauta.`,
        cultivaveis
          ? `Vale investir em ${cultivaveis.nome} (${cultivaveis.partidoId}, influência ${cultivaveis.influencia}): ideologia próxima, relação ainda morna.`
          : 'Nenhum vereador de meio-termo fácil de trazer para o seu lado no momento.',
        adversarioForte ? `Cuidado com ${adversarioForte.nome} (${adversarioForte.partidoId}) — hostil e influente.` : null,
      ].filter(Boolean),
    });
  }

  // MÍDIA
  {
    const eco = Math.round(state.reputacao.ecoMidiatico);
    const dRej = tendencia(state.series, 'rejeicao');
    out.push({
      area: 'MÍDIA', ico: '📰',
      linhas: [
        eco > 15 ? 'Você está em alta na imprensa — aproveite para emplacar uma pauta positiva.'
          : eco < -5 ? 'Cobertura negativa pesando. Evite exposição desnecessária esta semana.'
            : 'Sem grande destaque na mídia. Uma boa entrevista ou um projeto de impacto mudariam isso.',
        dRej > 4 ? `Sua rejeição subiu ${Math.round(dRej)} pontos — algo recente pegou mal.`
          : dRej < -4 ? `Sua rejeição caiu ${Math.round(-dRej)} pontos — a maré virou a seu favor.` : null,
      ].filter(Boolean),
    });
  }

  // OPOSIÇÃO — movimentos do principal rival
  {
    const rivais = Object.values(state.mundo.politicos || {})
      .filter((p) => p.ativo && p.cargo === 'VEREADOR' && p.relacaoJogador < 0);
    const rival = rivais.sort((a, b) => (b.notoriedade + b.influencia) - (a.notoriedade + a.influencia))[0];
    if (rival) {
      const noticiaRival = (state.mundo.noticias || []).find((n) => n.texto.includes(rival.nome));
      out.push({
        area: 'OPOSIÇÃO', ico: '⚔️',
        linhas: [
          `Principal rival: ${rival.nome} (${rival.partidoId}) — notoriedade ${Math.round(rival.notoriedade)}, rejeição ${Math.round(rival.rejeicao)}.`,
          noticiaRival ? `Movimento recente: "${noticiaRival.texto}"` : 'Sem movimentos de destaque dele no último mês.',
          rival.rejeicao > 40 ? 'A alta rejeição dele é uma janela — não precisa atacar, basta se diferenciar.' : null,
        ].filter(Boolean),
      });
    }
  }

  // RISCO — promessas, memória, cascatas
  {
    const promAbertas = (state.mandato?.promessas || []).filter((p) => !p.cumprida);
    const vencidas = promAbertas.filter((p) => state.tempo.mes > p.prazo);
    const riscos = riscosAbertos(state);
    const cascatas = cascatasAtivas(state);
    const linhas = [];
    if (vencidas.length) linhas.push(`${vencidas.length} promessa(s) já venceram sem serem cumpridas — a imprensa e a comunidade vão cobrar.`);
    else if (promAbertas.length) linhas.push(`${promAbertas.length} promessa(s) em aberto, ainda dentro do prazo.`);
    if (riscos.length) linhas.push(`${riscos.length} caso(s) antigo(s) podem voltar à tona (decisões que você registrou).`);
    if (cascatas.length) linhas.push(`${cascatas.length} repercussão(ões) em curso — cada uma avança sozinha todo mês.`);
    if (!linhas.length) linhas.push('Nada crítico no radar de riscos no momento.');
    out.push({ area: 'RISCO', ico: '⚠️', linhas, alerta: vencidas.length > 0 || cascatas.length > 0 });
  }

  // RECOMENDAÇÃO DO GABINETE — aponta o indicador mais fraco
  {
    const r = state.reputacao;
    const cand = [
      { k: 'notoriedade', v: r.notoriedade, txt: 'Você ainda é pouco conhecido. Priorize entrevistas, redes e presença pública antes de qualquer coisa.' },
      { k: 'rejeicao', v: 100 - r.rejeicao, txt: 'Sua rejeição está alta. Baixe o tom, cumpra uma promessa visível, evite polêmica.' },
      { k: 'aprovacao', v: r.aprovacao, txt: 'Sua aprovação está baixa. Entregas concretas em bairro, não discurso.' },
      { k: 'confianca', v: r.confianca, txt: 'A confiança do eleitor em você está fraca — coerência e transparência importam mais que exposição agora.' },
    ].sort((a, b) => a.v - b.v)[0];
    out.push({ area: 'RECOMENDAÇÃO DO GABINETE', ico: '💼', linhas: [cand.txt], recomendacao: true });
  }

  return out;
}

// ============================================================
// Item 5 — pesquisas dirigidas (sob demanda). O jogador escolhe o alvo.
// Tudo derivado do estado; a "leitura" pode errar, os números não.
// ============================================================

function eixoJogador(state) {
  const pa = P(state.personagem.partidoId);
  return pa?.eixo ?? 0;
}

// --- pesquisar bairro ---
export function pesquisarBairro(state, bairroId) {
  const b = BAIRROS.find((x) => x.id === bairroId) || BAIRROS[0];
  const t = state.territorio.porBairro[b.id] || { presenca: 0, penetracao: 0 };
  const alinho = 1 - Math.abs(eixoJogador(state) - b.eixo) / 100;
  const temaChave = temaCanonico((b.problemas || ['assistencia'])[0]);
  const disponivel = Math.round((1 - t.penetracao / 100) * alinho * 100);
  const linhas = [
    `${(b.populacao / 1000).toFixed(0)} mil habitantes · ${b.regiao} · renda ${b.renda}/5 · perfil ${b.eixo > 15 ? 'mais à direita' : b.eixo < -15 ? 'mais à esquerda' : 'de centro'}.`,
    `Sua presença aqui: ${Math.round(t.presenca)} · voto firme (penetração): ${Math.round(t.penetracao)}.`,
    `Pauta que mais mobiliza: ${nomeTema(temaChave)} (também: ${(b.problemas || []).slice(1).map((p) => nomeTema(temaCanonico(p))).join(', ') || '—'}).`,
    alinho > 0.7 ? 'Perfil ideológico favorável — vale investir.'
      : alinho < 0.45 ? 'Perfil ideológico adverso — retorno baixo por caminhada; foque em entrega concreta.'
        : 'Perfil misto — disputável com trabalho de base.',
    `Voto ainda disponível estimado: ${disponivel}/100.`,
  ];
  return { id: b.id, nome: b.nome, temaChave, linhas };
}

// --- pesquisar grupo social ---
export function pesquisarGrupo(state, grupoId) {
  const g = GRUPO(grupoId) || GRUPOS[0];
  const sat = Math.round((state.mundo?.satisfacaoGrupos?.[g.id]) || 0);
  const temasDoGrupo = TEMAS.filter((t) => (t.grupos || []).includes(g.id));
  const dist = Math.abs(eixoJogador(state) - g.eixo);
  const linhas = [
    `Satisfação com você: ${sat > 0 ? '+' : ''}${sat} (−100 a 100). Volatilidade ${Math.round(g.volatilidade * 100)}% — ${g.volatilidade > 0.6 ? 'muda de ideia rápido' : 'leal, custa a virar e custa a voltar'}.`,
    `Pautas que mobilizam esse grupo: ${temasDoGrupo.map((t) => t.nome).join(', ') || '—'}.`,
    dist < 25 ? 'Alinhamento ideológico com você: bom.' : dist < 55 ? 'Alinhamento ideológico: parcial.' : 'Alinhamento ideológico: ruim — conquista custa mais.',
    sat <= -20 ? 'Prioridade: reverter. Um encontro + uma entrega na pauta deles.'
      : sat >= 40 ? 'Já são seus — mantenha com presença, não desperdice tempo cortejando.'
        : 'Terreno neutro — dá para crescer com discurso dirigido e projeto no tema.',
  ];
  return { id: g.id, nome: g.nome, temas: temasDoGrupo.map((t) => t.id), linhas };
}

// --- rivais que dá para pesquisar ---
export function rivaisConhecidos(state) {
  return Object.values(state.mundo.politicos || {})
    .filter((p) => p.ativo && (p.relacaoJogador < 25 || p.influencia > 55))
    .sort((a, b) => (b.influencia + b.notoriedade) - (a.influencia + a.notoriedade))
    .slice(0, 12)
    .map((p) => ({ id: p.id, nome: p.nome, partidoId: p.partidoId }));
}

// --- pesquisar rival ---
export function pesquisarRival(state, polId) {
  const p = state.mundo.politicos?.[polId];
  if (!p) return null;
  const noticia = (state.mundo.noticias || []).find((n) => n.texto.includes(p.nome));
  const meuEixo = eixoJogador(state);
  const linhas = [
    `${p.partidoId} · ${p.cargo || 'sem cargo'} · influência ${Math.round(p.influencia)} · notoriedade ${Math.round(p.notoriedade)} · rejeição ${Math.round(p.rejeicao)}.`,
    `Relação com você: ${Math.round(p.relacaoJogador)} (${p.relacaoJogador < -20 ? 'hostil' : p.relacaoJogador < 10 ? 'fria' : 'cordial'}).`,
    noticia ? `Movimento recente: "${noticia.texto}"` : 'Sem movimentos de destaque no último mês.',
    p.rejeicao > 40 ? 'Ponto fraco: rejeição alta. Não precisa atacar — basta se diferenciar e deixar ele falar.'
      : Math.abs((p.ideologiaEixo ?? 0) - meuEixo) > 45 ? 'Ponto fraco: está longe do eleitor de centro. Dispute esse espaço.'
        : p.influencia < 45 ? 'Ponto fraco: base institucional curta. Trabalhe as lideranças antes dele.'
          : 'Sem brecha óbvia — evite confronto direto e construa entrega.',
  ];
  return { id: p.id, nome: p.nome, linhas };
}

// --- analisar tendências ---
export function analisarTendencias(state) {
  const campos = [
    ['notoriedade', 'Notoriedade'], ['aprovacao', 'Aprovação'],
    ['rejeicao', 'Rejeição'], ['seguidores', 'Seguidores'],
  ];
  const linhas = campos.map(([k, nome]) => {
    const d6 = tendencia(state.series, k, 6);
    const d3 = tendencia(state.series, k, 3);
    const seta = d6 > 1 ? '↑' : d6 < -1 ? '↓' : '→';
    const acel = Math.abs(d3) > Math.abs(d6 - d3) && Math.abs(d3) > 2 ? ' (acelerando)' : '';
    return `${nome}: ${seta} ${d6 >= 0 ? '+' : ''}${Math.round(d6)} em 6 meses${acel}.`;
  });
  const dRej = tendencia(state.series, 'rejeicao', 4);
  if (dRej > 5) linhas.push('Alerta: a rejeição está em rota de subida — identifique o que mudou nos últimos 2 meses.');
  return { linhas };
}

// --- eleitorado potencial ---
export function eleitoradoPotencial(state) {
  const ex = eixoJogador(state);
  const grupos = GRUPOS.map((g) => {
    const sat = (state.mundo?.satisfacaoGrupos?.[g.id]) || 0;
    const afin = 1 - Math.abs(ex - g.eixo) / 100;
    const espaco = afin * (1 - (sat + 100) / 260); // afim, mas ainda não conquistado
    return { nome: g.nome, id: g.id, espaco, sat: Math.round(sat), afin };
  }).sort((a, b) => b.espaco - a.espaco);
  const bairros = BAIRROS.map((b) => {
    const t = state.territorio.porBairro[b.id] || { penetracao: 0 };
    const afin = 1 - Math.abs(ex - b.eixo) / 100;
    return { nome: b.nome, id: b.id, espaco: afin * (1 - t.penetracao / 100) * (b.populacao / 100000) };
  }).sort((a, b) => b.espaco - a.espaco);
  return {
    linhas: [
      `Grupos com voto disponível a seu favor: ${grupos.slice(0, 3).map((g) => `${g.nome} (satisf. ${g.sat > 0 ? '+' : ''}${g.sat})`).join(', ')}.`,
      `Bairros afins ainda pouco fidelizados: ${bairros.slice(0, 3).map((b) => b.nome).join(', ')}.`,
      'Priorize onde afinidade é alta E o voto ainda não está firmado — é aí que o esforço rende mais.',
    ],
    grupos: grupos.slice(0, 3).map((g) => g.id),
    bairros: bairros.slice(0, 3).map((b) => b.id),
  };
}

// --- forças e fraquezas ---
export function forcasEfraquezas(state) {
  const r = state.reputacao;
  const a = state.personagem.atributos;
  const fortes = []; const fracas = [];
  const at = (k, nome) => { if ((a[k] ?? 45) >= 62) fortes.push(nome); else if ((a[k] ?? 45) <= 38) fracas.push(nome); };
  at('carisma', 'carisma'); at('comunicacao', 'comunicação'); at('oratoria', 'oratória');
  at('negociacao', 'negociação'); at('lideranca', 'liderança'); at('organizacao', 'gestão');
  if (r.notoriedade >= 55) fortes.push('já é um nome conhecido'); else if (r.notoriedade <= 25) fracas.push('pouco conhecido');
  if (r.rejeicao <= 20) fortes.push('rejeição baixa'); else if (r.rejeicao >= 40) fracas.push('rejeição alta');
  if (r.aprovacao >= 55) fortes.push('aprovação sólida'); else if (r.aprovacao <= 35) fracas.push('aprovação fraca');
  const base = Object.values(state.territorio.porBairro || {}).filter((t) => t.presenca > 30).length;
  if (base >= 3) fortes.push(`base territorial em ${base} bairros`); else if (base === 0) fracas.push('sem reduto territorial');
  const caixa = state.financas.campanha + state.financas.gabinete;
  if (caixa > 80000) fortes.push('caixa confortável'); else if (caixa < 15000 && state.personagem.fase !== 'VIDA') fracas.push('caixa curto');
  return {
    linhas: [
      `Forças: ${fortes.join(', ') || 'nada se destaca ainda'}.`,
      `Fraquezas: ${fracas.join(', ') || 'sem vulnerabilidade grave'}.`,
      fracas.length > fortes.length ? 'Leitura: você ainda está construindo — evite disputas onde a fraqueza pesa.' : 'Leitura: dá para partir para o ataque nos seus pontos fortes.',
    ],
  };
}

// --- temas populares agora ---
export function temasPopulares(state) {
  const clima = climaNacional(state);
  const ranking = TEMAS.map((t) => {
    const satGrupos = (t.grupos || []).map((gid) => (state.mundo?.satisfacaoGrupos?.[gid]) || 0);
    const carencia = satGrupos.length ? -satGrupos.reduce((s, v) => s + v, 0) / satGrupos.length : 0; // grupo insatisfeito = tema urgente
    const ventoNac = (clima > 0 ? ['seguranca', 'empreendedorismo'] : ['saude', 'educacao', 'assistencia', 'habitacao']).includes(t.id) ? 12 : 0;
    return { t, score: carencia + ventoNac };
  }).sort((a, b) => b.score - a.score);
  return {
    linhas: [
      `Pautas com mais tração agora: ${ranking.slice(0, 3).map((x) => x.t.nome).join(', ')}.`,
      `Menos urgentes hoje: ${ranking.slice(-2).map((x) => x.t.nome).join(', ')}.`,
      clima !== 0 ? `O clima nacional (${clima > 0 ? 'centro-direita' : 'centro-esquerda'}) empurra ${clima > 0 ? 'segurança e economia' : 'saúde, educação e assistência'}.` : null,
    ].filter(Boolean),
    temas: ranking.slice(0, 4).map((x) => x.t.id),
  };
}

// --- "O que devo propor?" ---
export function sugerirProjetos(state) {
  const ex = eixoJogador(state);
  const promsAbertas = (state.mandato?.promessas || []).filter((p) => !p.cumprida);
  const usados = new Set((state.mandato?.projetos || []).map((p) => `${p.tema}|${p.bairroFoco}`));
  const cand = [];

  // 1) promessas em aberto → projeto que as cumpre
  for (const pr of promsAbertas) {
    const key = `${pr.tema}|${pr.bairroId}`;
    if (usados.has(key)) continue;
    cand.push({
      tema: pr.tema, tipo: 'projeto_lei', bairroId: pr.bairroId,
      motivo: `Cumpre a promessa de ${nomeTema(pr.tema)} na ${nomeBairro(pr.bairroId)}${state.tempo.mes > pr.prazo ? ' — JÁ VENCIDA' : ''}.`,
      prioridade: state.tempo.mes > pr.prazo ? 3 : 2,
    });
  }
  // 2) grupo social irritado → projeto no tema dele, no bairro mais fraco desse perfil
  const pior = resumoSatisfacao(state)[0];
  if (pior && pior.valor <= -20) {
    const temaG = TEMAS.find((t) => (t.grupos || [])[0] === pior.id) || TEMAS.find((t) => (t.grupos || []).includes(pior.id));
    if (temaG) {
      const bairro = BAIRROS.filter((b) => (b.problemas || []).map(temaCanonico).includes(temaG.id))
        .sort((a, b) => b.populacao - a.populacao)[0] || BAIRROS[0];
      cand.push({
        tema: temaG.id, tipo: 'indicacao', bairroId: bairro.id,
        motivo: `${pior.nome} estão insatisfeitos (${pior.valor}); ${nomeTema(temaG.id)} é a pauta que os mobiliza.`,
        prioridade: 2,
      });
    }
  }
  // 3) bairro de alto potencial não explorado → projeto no problema dele
  const alvoBairro = BAIRROS.map((b) => {
    const t = state.territorio.porBairro[b.id] || { penetracao: 0 };
    const afin = 1 - Math.abs(ex - b.eixo) / 100;
    return { b, score: afin * (1 - t.penetracao / 100) * (b.populacao / 100000) };
  }).sort((a, b) => b.score - a.score)[0];
  if (alvoBairro) {
    const tema = temaCanonico((alvoBairro.b.problemas || ['assistencia'])[0]);
    if (!usados.has(`${tema}|${alvoBairro.b.id}`)) {
      cand.push({
        tema, tipo: 'projeto_lei', bairroId: alvoBairro.b.id,
        motivo: `${alvoBairro.b.nome} tem perfil favorável e voto disponível; ${nomeTema(tema)} é a dor local.`,
        prioridade: 1,
      });
    }
  }
  // 4) tema em alta nacional que você ainda não trabalhou
  const quente = temasPopulares(state).temas[0];
  if (quente && ![...usados].some((k) => k.startsWith(`${quente}|`))) {
    const bairro = BAIRROS.filter((b) => (b.problemas || []).map(temaCanonico).includes(quente))
      .sort((a, b) => b.populacao - a.populacao)[0] || BAIRROS[0];
    cand.push({
      tema: quente, tipo: 'audiencia', bairroId: bairro.id,
      motivo: `${nomeTema(quente)} é a pauta com mais tração agora e você ainda não se posicionou nela.`,
      prioridade: 1,
    });
  }

  // dedup por tema+bairro, ordena por prioridade
  const seen = new Set();
  const lista = cand.filter((c) => {
    const k = `${c.tema}|${c.bairroId}`;
    if (seen.has(k)) return false; seen.add(k); return true;
  }).sort((a, b) => b.prioridade - a.prioridade).slice(0, 4);

  return lista.map((c) => ({
    ...c,
    temaNome: nomeTema(c.tema),
    bairroNome: nomeBairro(c.bairroId),
    tipoNome: lawsDef.tipos.find((t) => t.id === c.tipo)?.nome || c.tipo,
    tituloExemplo: (lawsDef.titulos[c.tema] || [`Projeto de ${nomeTema(c.tema)}`])[0].replace('{bairro}', nomeBairro(c.bairroId)),
  }));
}
