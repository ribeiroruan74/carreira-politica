// Fase 30 — fim de jogo, legado e biografia.
// A carreira política termina por escolha, idade, saúde, derrota terminal ou
// escândalo fatal. Ao terminar, monta-se uma biografia com o balanço da
// trajetória e um "veredito da história".

import { clamp } from './rng';
import electorateDef from '../content/electorate.json';
import neighborhoods from '../content/neighborhoods/recife.json';
import olinda from '../content/neighborhoods/olinda.json';
import { cargoPorId } from './offices';
import { CONQUISTAS } from './achievements';

const GRUPO = Object.fromEntries(electorateDef.grupos.map((g) => [g.id, g]));
function bairrosDe(cidade) {
  return (cidade === 'OLINDA' ? olinda : neighborhoods).bairros;
}
function nomeBairro(cidade, id) {
  return bairrosDe(cidade).find((b) => b.id === id)?.nome || id;
}

// Dobra os indicadores do mandato atual no tally acumulado da carreira.
// Chamado sempre que um mandato termina (reeleição, fim de ciclo, fim de jogo).
export function arquivarMandato(s) {
  if (!s.mandato) return;
  const leg = (s.personagem.legado ||= {});
  const ind = s.mandato.indicadores || {};
  leg.mesesEmMandato = (leg.mesesEmMandato || 0) + Math.max(0, s.tempo.mes - s.mandato.mesInicio);
  leg.projetosAprovados = (leg.projetosAprovados || 0) + (ind.projetosAprovados || 0);
  leg.projetosRejeitados = (leg.projetosRejeitados || 0) + (ind.projetosRejeitados || 0);
  leg.fiscalizacoes = (leg.fiscalizacoes || 0) + (ind.fiscalizacoes || 0);
  leg.obrasEntregues = (leg.obrasEntregues || 0) + (ind.obrasEntregues || 0);
  leg.promessasFeitas = (leg.promessasFeitas || 0) + (s.mandato.promessas || []).length;
  leg.promessasCumpridas = (leg.promessasCumpridas || 0) + (s.mandato.promessas || []).filter((p) => p.cumprida).length;
}

// Verifica se a carreira chegou ao fim. Se sim, seta s.fimDeJogo e devolve eventos.
export function checarFimDeJogo(s) {
  if (s.fimDeJogo) return { eventos: [] };
  const p = s.personagem;
  const rep = s.reputacao;
  const saude = p.vida?.saude ?? 100;
  const emDisputa = s.personagem.fase === 'CANDIDATO' || (s.eleicao && s.eleicao.status !== 'APURADO');
  if (emDisputa) return { eventos: [] };

  let tipo = null; let motivo = null;

  // 1) idade: aos 75+, encerra ao sair do mandato (ou já fora dele)
  if (p.idade >= 75 && !s.mandato) {
    tipo = 'APOSENTADORIA';
    motivo = `Aos ${p.idade} anos, você pendura as chuteiras. A vida pública fica para trás.`;
  } else if (p.idade >= 78) {
    tipo = 'APOSENTADORIA';
    motivo = `Aos ${p.idade} anos, você anuncia que não disputará mais nada e se afasta.`;
  }

  // 2) saúde: problema grave afasta da política (só quando realmente crítico e mais velho)
  if (!tipo && saude <= 8 && p.idade >= 60) {
    tipo = 'SAUDE';
    motivo = 'Um problema sério de saúde te obriga a deixar a vida pública para se cuidar.';
  }

  // 3) derrota terminal: 3+ derrotas seguidas, sem mandato, já mais velho,
  //    e o partido de costas
  if (!tipo && !s.mandato && (p.derrotasSeguidas || 0) >= 3 && p.idade >= 58) {
    const pr = s.mundo.partidosRuntime?.[p.partidoId];
    if (!pr || pr.apoioAoJogador < 25) {
      tipo = 'DERROTA';
      motivo = `${p.derrotasSeguidas} derrotas seguidas. O partido não te lança mais e não há tempo de recomeçar. A carreira política acabou.`;
    }
  }

  // 4) escândalo fatal: rejeição altíssima + aprovação no chão, fora de mandato,
  //    por 2 meses seguidos (usa a série)
  if (!tipo && !s.mandato && rep.rejeicao >= 88 && rep.aprovacao <= 14) {
    const ult = (s.series || []).slice(-2);
    if (ult.length === 2 && ult.every((x) => x.rejeicao >= 82 && x.aprovacao <= 20)) {
      tipo = 'ESCANDALO';
      motivo = 'Sua imagem virou pó. Nenhum partido te aceita, nenhum aliado te atende. É o fim da linha.';
    }
  }

  if (!tipo) return { eventos: [] };

  finalizar(s, tipo, motivo);
  return { eventos: [{ tipo: 'MARCO', texto: `FIM DA CARREIRA — ${motivo}` }] };
}

// Encerramento voluntário (objetivo "Encerrar a carreira").
export function encerrarCarreira(s) {
  if (s.fimDeJogo) return;
  const cargo = s.mandato ? ` como ${s.mandato.cargoNome || 'parlamentar'}` : '';
  finalizar(s, 'ESCOLHA', `Você decide encerrar a vida pública${cargo} e virar a página, nos seus próprios termos.`);
}

function finalizar(s, tipo, motivo) {
  arquivarMandato(s);
  const biografia = montarBiografia(s);
  s.fimDeJogo = { tipo, motivo, mes: s.tempo.mes, idade: s.personagem.idade, biografia };
  s.personagem.historicoPolitico.push({ mes: s.tempo.mes, texto: `Fim da carreira política: ${biografia.titulo}.` });
  s.marcos = s.marcos || [];
  s.marcos.push({ mes: s.tempo.mes, tipo: 'CARREIRA', texto: `Fim da carreira — ${biografia.titulo}` });
}

// ---------------------------------------------------------------------------

export function montarBiografia(s) {
  const p = s.personagem;
  const leg = p.legado || {};
  const rep = s.reputacao;
  const anosPublica = p.fase === 'VIDA' ? 0 : Math.max(1, Math.round(s.tempo.mes / 12));
  const cargos = (p.mandatosExercidos || []).map((c) => cargoPorId(c)?.nome || c);
  const cumpridas = leg.promessasCumpridas || 0;
  const feitas = leg.promessasFeitas || 0;

  // grupos que mais amaram / odiaram
  const sat = Object.entries(s.mundo?.satisfacaoGrupos || {})
    .map(([id, v]) => ({ nome: GRUPO[id]?.nome || id, valor: Math.round(v) }))
    .sort((a, b) => b.valor - a.valor);
  const base = sat.filter((x) => x.valor >= 20).slice(0, 3);
  const inimigos = sat.filter((x) => x.valor <= -20).slice(-3).reverse();

  // redutos (território alto)
  const redutos = Object.entries(s.territorio?.porBairro || {})
    .filter(([, t]) => t.presenca >= 45)
    .sort((a, b) => b[1].presenca - a[1].presenca)
    .slice(0, 4)
    .map(([id]) => nomeBairro(p.cidade, id));

  const conquistas = Object.keys(s.conquistas?.desbloqueadas || {})
    .map((id) => CONQUISTAS.find((c) => c.id === id))
    .filter(Boolean);

  const marcos = [...(s.marcos || [])]
    .filter((m) => ['ELEICAO', 'MANDATO', 'CONQUISTA', 'CRISE'].includes(m.tipo))
    .slice(-8);

  const aprovMedia = mediaSerie(s, 'aprovacao');
  const notoFinal = Math.round(rep.notoriedade);

  const nota = calcularNota(s, leg);
  const { titulo, veredito } = vereditoDaHistoria(s, leg, nota, { cargos, redutos, base });

  return {
    nome: p.nome,
    idadeFinal: p.idade,
    cidade: p.cidade,
    anosPublica,
    cargos,
    ultimoCargo: cargos.at(-1) || null,
    eleicoesVencidas: leg.eleicoesVencidas || 0,
    eleicoesPerdidas: leg.eleicoesPerdidas || 0,
    mesesEmMandato: leg.mesesEmMandato || 0,
    projetosAprovados: leg.projetosAprovados || 0,
    projetosRejeitados: leg.projetosRejeitados || 0,
    fiscalizacoes: leg.fiscalizacoes || 0,
    promessasFeitas: feitas,
    promessasCumpridas: cumpridas,
    taxaPromessas: feitas ? Math.round((cumpridas / feitas) * 100) : null,
    melhorVotacao: leg.melhorVotacao || 0,
    aprovMedia,
    notoFinal,
    rejeicaoFinal: Math.round(rep.rejeicao),
    seguidores: s.redes?.seguidores || 0,
    patrimonio: p.patrimonio || 0,
    caixaPessoal: s.financas?.pessoal || 0,
    empresas: (p.empresas || []).map((e) => e.nome),
    instituicoes: (p.instituicoes || []).map((i) => ({ nome: i.nome, nivel: i.nivel })),
    institutosFundados: leg.institutosFundados || 0,
    impactoSocial: Math.round(leg.impactoSocial || 0),
    base,
    inimigos,
    redutos,
    conquistas: conquistas.map((c) => ({ icone: c.icone, nome: c.nome })),
    totalConquistas: CONQUISTAS.length,
    marcos,
    nota,
    titulo,
    veredito,
  };
}

function mediaSerie(s, campo) {
  const vals = (s.series || []).map((x) => x[campo]).filter((v) => v != null);
  if (!vals.length) return Math.round(s.reputacao[campo] ?? 50);
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

// Nota 0-100 do saldo da carreira.
function calcularNota(s, leg) {
  const p = s.personagem;
  let n = 20;
  n += Math.min(28, (leg.eleicoesVencidas || 0) * 9); // vitórias eleitorais
  n += Math.min(8, (new Set(p.mandatosExercidos || [])).size * 4); // diversidade de cargos
  n += Math.min(16, (leg.projetosAprovados || 0) * 1.5); // entregas legislativas
  n += Math.min(8, (leg.fiscalizacoes || 0) * 0.8);
  const taxaProm = leg.promessasFeitas ? (leg.promessasCumpridas || 0) / leg.promessasFeitas : 0.5;
  n += taxaProm * 12; // palavra cumprida
  n += (mediaSerie(s, 'aprovacao') - 45) * 0.25; // aprovação média
  n -= (s.reputacao.rejeicao - 25) * 0.15; // rejeição
  n += Math.min(6, Object.keys(s.conquistas?.desbloqueadas || {}).length * 0.3);
  // Item 17 — legado social de instituições fundadas (impacto acumulado)
  n += Math.min(10, (leg.institutosFundados || 0) * 2 + (leg.impactoSocial || 0) / 2500);
  n -= (leg.eleicoesPerdidas || 0) * 2.5;
  if (s.fimDeJogo?.tipo === 'ESCANDALO') n -= 22;
  if (s.fimDeJogo?.tipo === 'DERROTA') n -= 8;
  return Math.round(clamp(n, 0, 100));
}

function vereditoDaHistoria(s, leg, nota, ctx) {
  const p = s.personagem;
  const cargosSet = new Set(p.mandatosExercidos || []);
  const executivo = cargosSet.has('PREFEITO');
  const parlamentar = cargosSet.has('DEPUTADO_ESTADUAL') || cargosSet.has('DEPUTADO_FEDERAL');
  const nunca = (leg.eleicoesVencidas || 0) === 0;
  const tipo = s.fimDeJogo?.tipo;

  let titulo; let veredito;

  if (tipo === 'ESCANDALO') {
    titulo = 'A queda';
    veredito = 'A carreira desabou num escândalo. O nome virou sinônimo de tudo que o eleitor diz odiar na política. É assim que os livros vão te registrar — se registrarem.';
  } else if (nunca && p.reputacao?.notoriedade > 45) {
    titulo = 'O eterno candidato';
    veredito = 'Conhecido, comentado, presente em todo debate — e nunca eleito. A história guarda um lugar para quem quase chegou lá, tantas vezes.';
  } else if (nunca) {
    titulo = 'Nota de rodapé';
    veredito = 'A passagem pela política foi breve e discreta. Poucos vão lembrar que você tentou.';
  } else if (nota >= 78 && executivo) {
    titulo = 'Estadista';
    veredito = `${ctx.cargos.join(', ')}. Governou, entregou, deixou marca. O tipo de trajetória que vira nome de rua e capítulo de livro didático.`;
  } else if (nota >= 78 && parlamentar) {
    titulo = 'Peso pesado do parlamento';
    veredito = 'Uma carreira legislativa de respeito: projetos que pegaram, fiscalização que incomodou, um mandato que fez diferença. Referência para a geração seguinte.';
  } else if (nota >= 62 && ctx.redutos.length >= 2) {
    titulo = 'Cacique de território';
    veredito = `Dono de ${ctx.redutos.slice(0, 2).join(' e ')}. Uma base fiel que ninguém tirou de você — e que sustentou toda a carreira. Poder de verdade, do tipo que se herda.`;
  } else if (nota >= 55 && (leg.institutosFundados || 0) >= 2 && (leg.impactoSocial || 0) > 2500) {
    titulo = 'O construtor de instituições';
    veredito = 'Mais do que mandatos, deixou obras que continuam funcionando sem você — escolas, institutos, projetos que levam o seu nome. O legado que não depende de eleição.';
  } else if (nota >= 55) {
    titulo = 'Político de carreira';
    veredito = 'Nem herói, nem vilão: um quadro competente que soube se manter, negociar e entregar o suficiente. A maioria da classe política sonha em terminar assim.';
  } else if ((leg.promessasFeitas || 0) > 4 && (leg.promessasCumpridas || 0) / Math.max(1, leg.promessasFeitas) < 0.35) {
    titulo = 'Promessas ao vento';
    veredito = 'Ganhou eleições no discurso e perdeu a confiança na prática. O eleitor aprende — e cobra na urna seguinte.';
  } else if ((leg.eleicoesPerdidas || 0) >= 2) {
    titulo = 'Sobe e desce';
    veredito = 'Uma carreira de altos e baixos: elegeu-se, caiu, voltou, caiu de novo. Resistência não faltou; consolidação, sim.';
  } else {
    titulo = 'Passagem discreta';
    veredito = 'Um mandato, algum trabalho, e a saída de cena sem grande alarde. Cumpriu o combinado e foi para casa.';
  }

  return { titulo, veredito };
}
