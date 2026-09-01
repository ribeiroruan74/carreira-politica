import { streamRng, createRng, clamp } from './rng';
import polDef from '../content/politicians.json';
import partiesDef from '../content/parties.json';
import recife from '../content/neighborhoods/recife.json';
import { bairrosDaCidade } from './offices';
import { relevanciaMidiatica } from './social';
import { multGabinete } from './mandate';

const BAIRROS = recife.bairros;
const PARTIDO_IDS = partiesDef.partidos.map((p) => p.id);
const ESTILOS = Object.fromEntries(polDef.estilos.map((e) => [e.id, e]));

function partido(id) {
  return partiesDef.partidos.find((p) => p.id === id) || partiesDef.partidos[0];
}

function nomeGerado(rng) {
  const primeiros = ['Ana', 'Roberto', 'Fernanda', 'Marcos', 'Cláudia', 'Paulo', 'Simone', 'Eduardo', 'Patrícia', 'Rogério', 'Vera', 'Gustavo', 'Luciana', 'Fábio', 'Renata', 'André', 'Tereza', 'Sérgio', 'Débora', 'Nelson', 'Cristiane', 'Wagner'];
  const sobrenomes = ['Cavalcanti', 'Melo', 'Lira', 'Siqueira', 'Wanderley', 'Bezerra', 'Correia', 'Vasconcelos', 'Arruda', 'Maranhão', 'Andrade', 'Feitosa', 'Tenório', 'Pessoa', 'Coimbra', 'Uchôa'];
  const pref = rng.chance(0.28) ? rng.pick(['Dr.', 'Profª', 'Prof.', 'Delegado', 'Sargento', 'Cel.']) + ' ' : '';
  return pref + rng.pick(primeiros) + ' ' + rng.pick(sobrenomes);
}

function baseBairros(rng, n, bairros = BAIRROS) {
  const b = {};
  const rest = [...bairros];
  for (let i = 0; i < n && rest.length; i++) {
    const escolha = rng.weighted(rest, (x) => x.populacao);
    b[escolha.id] = rng.range([0.12, 0.4]);
    rest.splice(rest.indexOf(escolha), 1);
  }
  return b;
}

// Cria o mundo político. Determinístico (offset de RNG dedicado).
export function inicializarMundo(state) {
  const rng = streamRng(state.meta.seed, "worldinit");
  const politicos = {};
  const bairros = bairrosDaCidade(state.personagem.cidade);

  for (const s of polDef.semente) {
    politicos[s.id] = {
      ...s,
      atributos: {},
      baseBairros: baseBairros(rng, s.cargo === 'PREFEITO' ? 12 : 5, bairros),
      relacaoJogador: 0,
      ultimoContatoMes: -99,
      aliados: [],
      ecoMidiatico: 0,
      caixa: rng.int(50000, 400000),
      aprovacao: s.cargo === 'PREFEITO' ? rng.int(48, 62) : undefined, // Fase 18
      ativo: true,
      gerado: false,
    };
  }

  for (const cfg of polDef.cargosGerados) {
    for (let i = 0; i < cfg.qtd; i++) {
      const id = `np_${cfg.cargo.toLowerCase().replace(/\s/g, '')}_${i}_${rng.int(100, 999)}`;
      const pid = rng.weighted(partiesDef.partidos, (p) => p.forcaRecife + p.tamanho * 0.3).id;
      const pa = partido(pid);
      const estilo = rng.pick(Object.keys(ESTILOS));
      politicos[id] = {
        id,
        nome: nomeGerado(rng),
        cargo: cfg.cargo,
        partidoId: pid,
        influencia: rng.rangeInt(cfg.influencia),
        notoriedade: rng.rangeInt(cfg.notoriedade),
        rejeicao: rng.int(8, 40),
        ideologiaEixo: clamp(pa.eixo + rng.int(-20, 20), -100, 100),
        estilo,
        objetivo: rng.weighted(polDef.objetivos).id,
        lider: cfg.cargo === 'LIDERANCA',
        atributos: {},
        baseBairros: baseBairros(rng, cfg.cargo === 'VEREADOR' ? rng.int(2, 4) : rng.int(3, 6), bairros),
        relacaoJogador: 0,
        ultimoContatoMes: -99,
        aliados: [],
        ecoMidiatico: 0,
        caixa: rng.int(20000, 250000),
        ativo: true,
        gerado: true,
      };
    }
  }

  const partidosRuntime = {};
  for (const p of partiesDef.partidos) {
    const membros = Object.values(politicos).filter((x) => x.partidoId === p.id);
    const lideres = membros.filter((m) => m.lider).map((m) => m.id);
    // presidente do diretório municipal: dirigente/liderança da sigla, NUNCA o prefeito
    const candidatosPres = membros.filter((m) => m.cargo !== 'PREFEITO'
      && (m.cargo === 'LIDERANCA' || m.lider || m.cargo === 'VEREADOR'));
    const presidente = candidatosPres.length
      ? rng.weighted(candidatosPres, (m) => m.influencia + (m.cargo === 'LIDERANCA' ? 20 : 0))
      : membros.find((m) => m.cargo !== 'PREFEITO') || membros[0];
    partidosRuntime[p.id] = {
      caixa: rng.int(80000, 600000) * (p.tamanho / 60),
      popularidade: clamp(p.forcaRecife * 0.5 + rng.int(-10, 10), 5, 95),
      bancada: membros.filter((m) => m.cargo === 'VEREADOR').length,
      forcaDelta: 0,
      apoioAoJogador: 30,
      lideres,
      preCandidatos: [],
      // Fase 21 — política partidária interna
      presidenteMunicipal: presidente?.id || null,
      diretorioDoJogador: false,
    };
  }

  state.mundo.politicos = politicos;
  state.mundo.partidosRuntime = partidosRuntime;
  state.mundo.inicializado = true;
}

function garantirInit(state) {
  if (!state.mundo.inicializado) inicializarMundo(state);
}

// --- ações dos NPCs ---
function alvoAtaque(pol, todos, state, rng) {
  const podeAtacarJogador = ['CANDIDATO', 'MANDATO'].includes(state.personagem.fase)
    && state.reputacao.notoriedade > 20;
  if (podeAtacarJogador) {
    // ataca-se mais quem está fraco; poupa-se quem está popular
    const base = pol.relacaoJogador < -15 ? 0.14 : 0.035;
    const ajuste = clamp(1 - (state.reputacao.aprovacao - 45) / 90, 0.3, 1.6);
    if (rng.chance(base * ajuste)) return 'JOGADOR';
  }
  const rivais = todos.filter((o) => o.id !== pol.id && o.ativo
    && Math.abs(o.ideologiaEixo - pol.ideologiaEixo) > 35);
  if (!rivais.length) return null;
  return rng.weighted(rivais, (o) => o.notoriedade + 10).id;
}

function agirPolitico(pol, state, rng, noticias, mes) {
  const est = ESTILOS[pol.estilo] || ESTILOS.tecnico;
  const roll = rng.float();
  const todos = Object.values(state.mundo.politicos);

  if (roll < est.ataca) {
    const alvoId = alvoAtaque(pol, todos, state, rng);
    if (!alvoId) return;
    const forca = rng.range([2, 6]) * (pol.influencia / 60);
    if (alvoId === 'JOGADOR') {
      state.reputacao.rejeicao = clamp(state.reputacao.rejeicao + forca * 0.5, 0, 100);
      state.reputacao.ecoMidiatico = clamp(state.reputacao.ecoMidiatico - forca * 0.4, -50, 100);
      pol.relacaoJogador = clamp(pol.relacaoJogador - rng.int(4, 12), -100, 100);
      noticias.push({ mes, tipo: 'ATAQUE', destaque: true, atores: [pol.id],
        texto: `${pol.nome} (${pol.partidoId}) atacou você publicamente.` });
    } else {
      const alvo = state.mundo.politicos[alvoId];
      alvo.rejeicao = clamp(alvo.rejeicao + forca, 0, 100);
      alvo.ecoMidiatico = clamp(alvo.ecoMidiatico - forca * 0.4, -50, 100);
      pol.notoriedade = clamp(pol.notoriedade + rng.range([0.5, 2]), 0, 100);
      if (rng.chance(0.5)) {
        noticias.push({ mes, tipo: 'ATAQUE', atores: [pol.id, alvoId],
          texto: `${pol.nome} (${pol.partidoId}) e ${alvo.nome} (${alvo.partidoId}) trocaram acusações.` });
      }
    }
    return;
  }

  if (roll < est.ataca + est.alia) {
    if (pol.aliados.length >= 3 || !rng.chance(0.4)) return;
    const cand = todos.filter((o) => o.id !== pol.id && o.ativo
      && o.aliados.length < 3
      && !pol.aliados.includes(o.id)
      && Math.abs(o.ideologiaEixo - pol.ideologiaEixo) < 25);
    if (!cand.length) return;
    const parceiro = rng.weighted(cand, (o) => o.influencia).id;
    pol.aliados.push(parceiro);
    state.mundo.politicos[parceiro].aliados.push(pol.id);
    state.mundo.aliancas.push({ aId: pol.id, bId: parceiro, forca: rng.int(20, 50), desde: mes });
    if (pol.influencia > 55 || rng.chance(0.4)) {
      noticias.push({ mes, tipo: 'ALIANCA', atores: [pol.id, parceiro],
        texto: `${pol.nome} (${pol.partidoId}) e ${state.mundo.politicos[parceiro].nome} (${state.mundo.politicos[parceiro].partidoId}) selaram uma aliança.` });
    }
    return;
  }

  if (roll < est.ataca + est.alia + est.midia) {
    pol.notoriedade = clamp(pol.notoriedade + rng.range([1, 4]), 0, 100);
    pol.ecoMidiatico = clamp(pol.ecoMidiatico + rng.range([1, 5]), -50, 100);
    if (pol.notoriedade > 45 && rng.chance(0.35)) {
      noticias.push({ mes, tipo: 'MIDIA', atores: [pol.id],
        texto: `${pol.nome} (${pol.partidoId}) ganhou espaço na imprensa esta semana.` });
    }
    return;
  }

  // território
  const bairro = rng.weighted(BAIRROS, (b) => b.populacao);
  pol.baseBairros[bairro.id] = clamp((pol.baseBairros[bairro.id] || 0) + rng.range([0.02, 0.06]), 0, 0.7);
}

// --- tick mensal do mundo --- (recebe estado já clonado; muta e devolve)
export function worldTick(s) {
  garantirInit(s);
  const rng = streamRng(s.meta.seed, "world", s.tempo.mes);
  const mes = s.tempo.mes;
  const noticias = [];
  const eventos = [];

  const lista = Object.values(s.mundo.politicos).filter((p) => p.ativo);

  for (const pol of lista) {
    // decaimento
    pol.ecoMidiatico = +(pol.ecoMidiatico * 0.6).toFixed(2);
    const pisoNoto = pol.cargo === 'PREFEITO' ? 80 : Math.round(pol.influencia / 3);
    if (pol.notoriedade > pisoNoto) pol.notoriedade = Math.max(pisoNoto, pol.notoriedade - 0.8);
    if (mes - (pol.ultimoContatoMes ?? -99) > 2) {
      // Prioridade 5 — relações não dependem só de contato: convivência de partido
      // e alinhamento ideológico puxam para uma linha de base (co-partidário aquece
      // devagar sozinho; adversário ideológico esfria abaixo de zero).
      const eixoJ = (partiesDef.partidos.find((x) => x.id === s.personagem.partidoId)?.eixo) ?? 0;
      const dIdeo = Math.abs(eixoJ - (pol.ideologiaEixo ?? 0)); // 0..~160
      const mesmoPartido = s.personagem.partidoId && pol.partidoId === s.personagem.partidoId;
      let alvo = 0;
      if (mesmoPartido) alvo = 22 - dIdeo / 12;
      else if (dIdeo < 30) alvo = 8;
      else if (dIdeo > 90) alvo = -6;
      alvo = clamp(alvo, -12, 22);
      const passo = pol.relacaoJogador < alvo ? 0.5 : pol.relacaoJogador > alvo ? -1 : 0;
      if (passo) pol.relacaoJogador = passo > 0
        ? Math.min(alvo, pol.relacaoJogador + passo)
        : Math.max(alvo, pol.relacaoJogador + passo);
    }
    if (rng.chance(0.85)) agirPolitico(pol, s, rng, noticias, mes);
  }

  // rompimento esporádico de alianças
  s.mundo.aliancas = s.mundo.aliancas.filter((al) => {
    if (rng.chance(0.06)) {
      const a = s.mundo.politicos[al.aId];
      const b = s.mundo.politicos[al.bId];
      if (a) a.aliados = a.aliados.filter((x) => x !== al.bId);
      if (b) b.aliados = b.aliados.filter((x) => x !== al.aId);
      if (a && b && (a.influencia > 60 || b.influencia > 60)) {
        noticias.push({ mes, tipo: 'ALIANCA', atores: [al.aId, al.bId],
          texto: `Rompimento: ${a.nome} e ${b.nome} não estão mais juntos.` });
      }
      return false;
    }
    return true;
  });

  // troca de partido rara
  for (const pol of lista) {
    if (pol.cargo !== 'PREFEITO' && rng.chance(0.006)) {
      const novo = rng.pick(PARTIDO_IDS.filter((x) => x !== pol.partidoId));
      noticias.push({ mes, tipo: 'PARTIDO', destaque: pol.influencia > 55, atores: [pol.id],
        texto: `${pol.nome} deixou o ${pol.partidoId} e se filiou ao ${novo}.` });
      pol.partidoId = novo;
    }
  }

  // partidos: popularidade e caixa
  for (const [pid, pr] of Object.entries(s.mundo.partidosRuntime)) {
    const membros = lista.filter((p) => p.partidoId === pid);
    // Etapa 3 — no partido do jogador, ELE é a cara: entra na média com peso alto,
    // ponderado pela relevância midiática (senão o partido fica preso perto de 3).
    const ehDoJogador = pid === s.personagem.partidoId && s.personagem.fase !== 'VIDA';
    if (membros.length || ehDoJogador) {
      let soma = membros.reduce((acc, m) => acc + (m.notoriedade - m.rejeicao * 0.5), 0);
      let peso = membros.length;
      if (ehDoJogador) {
        const rel = relevanciaMidiatica(s);
        const pesoJog = 2 + rel / 25; // 2..6
        soma += (rel - s.reputacao.rejeicao * 0.5) * pesoJog;
        peso += pesoJog;
      }
      const alvo = peso ? soma / peso : pr.popularidade;
      pr.popularidade = clamp(pr.popularidade + (alvo * 0.75 - pr.popularidade) * 0.06 + rng.range([-1.5, 1.5]), 3, 95);
    }
    pr.bancada = membros.filter((m) => m.cargo === 'VEREADOR').length;
    pr.caixa = Math.max(0, pr.caixa + rng.int(-30000, 45000));

    // disputa interna no partido do jogador
    if (pid === s.personagem.partidoId && ['PARTIDO', 'CANDIDATO'].includes(s.personagem.fase)) {
      pr.preCandidatos = pr.preCandidatos || [];
      if (pr.preCandidatos.length < 4 && rng.chance(0.32)) {
        pr.preCandidatos.push({
          nome: nomeGerado(rng), forca: rng.int(35, 78), desde: mes,
        });
      }
      // pré-candidatos disputam o apoio; sem esforço, o apoio regride pra ~40
      const pressao = pr.preCandidatos.reduce((acc, pc) => acc + pc.forca / 85, 0);
      const regressao = (pr.apoioAoJogador - 40) * 0.06;
      pr.apoioAoJogador = clamp(pr.apoioAoJogador - pressao - regressao + rng.range([-0.5, 0.5]), 0, 100);
    }
  }

  // prefeito: aprovação (passeio aleatório com reversão à média) e evento de cidade
  const prefeito = Object.values(s.mundo.politicos).find((p) => p.cargo === 'PREFEITO');
  if (prefeito) {
    if (prefeito.aprovacao == null) prefeito.aprovacao = 55;
    prefeito.aprovacao = clamp(
      prefeito.aprovacao + rng.gauss(0, 1.6) + (52 - prefeito.aprovacao) * 0.04,
      15, 88,
    );
    prefeito.notoriedade = clamp(prefeito.notoriedade + rng.range([-0.5, 0.5]), 60, 100);
    if (mes % 4 === 0 && mes > 0) {
      const bairro = rng.weighted(BAIRROS, (b) => (b.renda <= 2 ? 3 : 1));
      const prob = rng.pick(bairro.problemas);
      const PROB = { seguranca: 'segurança', mobilidade: 'mobilidade', alagamento: 'alagamentos', moradia: 'moradia', saneamento: 'saneamento', emprego: 'desemprego', saude: 'saúde', educacao: 'educação' };
      prefeito.aprovacao = clamp(prefeito.aprovacao - rng.range([1, 4]), 15, 88);
      noticias.push({ mes, tipo: 'CIDADE', destaque: true, atores: ['np_joao_campos'],
        texto: `Moradores de ${bairro.nome} cobram a prefeitura por ${PROB[prob] || prob}. Aprovação do prefeito: ${Math.round(prefeito.aprovacao)}%.` });
    }
  }

  s.mundo.noticias = [...noticias.map((n, i) => ({ id: `nt_${mes}_${i}`, ...n })), ...s.mundo.noticias].slice(0, 80);
  for (const n of noticias.filter((x) => x.destaque)) {
    s.log.unshift({ mes, tipo: 'MUNDO', texto: n.texto });
    eventos.push({ tipo: 'MUNDO', texto: n.texto });
  }
  s.log = s.log.slice(0, 220);

  tickAliancas(s); // Etapa 5 — efeito mensal do grupo político

  return { state: s, eventos };
}

// --- interação do jogador com o mundo (usado por actions/politica.json) ---

// Etapa 4 — o quanto uma aproximação rende, de fato. 0.25..1.6.
// Depende de: relação atual (mais duro no topo), alinhamento ideológico/partido,
// influência do alvo (peixe grande é mais difícil), estilo, e histórico recente.
export function fatorRelacao(state, p, tipo = 'conversar') {
  const eixoJ = (partiesDef.partidos.find((x) => x.id === state.personagem.partidoId)?.eixo) ?? 0;
  const dIdeo = Math.abs(eixoJ - (p.ideologiaEixo ?? 0)) / 100; // 0..2
  const mesmoPartido = p.partidoId === state.personagem.partidoId;

  let f = 1;
  f *= 1 - Math.max(0, (p.relacaoJogador || 0) - 25) / 150;      // topo rende menos
  f *= 1 - dIdeo * 0.35 + (mesmoPartido ? 0.15 : 0);             // alinhamento
  f *= 1 - Math.max(0, (p.influencia || 50) - 50) / 125;         // peixe grande
  const est = polDefEstilo(p.estilo);
  f *= 0.8 + (est?.alia ?? 0.25) * 0.9;                          // estilo aberto a alianças
  const desdeContato = state.tempo.mes - (p.ultimoContatoMes ?? -99);
  if (desdeContato <= 0) f *= 0.35;                              // já falou este mês
  else if (desdeContato === 1) f *= 0.7;
  else if (desdeContato > 6) f *= 1.15;                          // reata contato antigo
  const habil = (state.personagem.atributos.negociacao + state.personagem.atributos.carisma) / 2;
  f *= 0.85 + (habil - 50) / 200;
  if (tipo === 'apoiar' && dIdeo > 0.6) f *= 0.55;               // apoiar oposto pega mal
  f *= multGabinete(state, 'aliancas');                          // Etapa 8 — assessor político
  return clamp(f, 0.25, 1.7);
}
function polDefEstilo(id) {
  return polDef.estilos.find((e) => e.id === id) || null;
}

export function cultivarPolitico(state, politicoId, ganho, tipo) {
  const p = state.mundo.politicos[politicoId];
  if (!p) throw new Error('Político não encontrado.');
  const g = ganho * fatorRelacao(state, p, tipo);
  p.relacaoJogador = clamp(p.relacaoJogador + g, -100, 100);
  p.ultimoContatoMes = state.tempo.mes;
  if (p.partidoId === state.personagem.partidoId) {
    const pr = state.mundo.partidosRuntime[p.partidoId];
    if (pr) pr.apoioAoJogador = clamp(pr.apoioAoJogador + g * 0.35, 0, 100);
  }
  return p;
}

// Etapa 4 — ações de relação sob demanda, direto da ficha (não dependem do leque).
const ACOES_RELACAO = {
  telefonar: { nome: 'Telefonar', tempo: 1, energia: 2, dinheiro: 0, base: 4, cat: 'contato' },
  cafe: { nome: 'Tomar um café', tempo: 1, energia: 4, dinheiro: 60, base: 6, cat: 'contato' },
  conversar: { nome: 'Conversar', tempo: 1, energia: 4, dinheiro: 0, base: 6, cat: 'contato' },
  almoco: { nome: 'Almoçar', tempo: 2, energia: 7, dinheiro: 280, base: 11, cat: 'contato' },
  jantar: { nome: 'Jantar reservado', tempo: 2, energia: 8, dinheiro: 650, base: 16, cat: 'contato' },
  reuniao: { nome: 'Reunião de trabalho', tempo: 2, energia: 9, dinheiro: 0, base: 11, cat: 'trabalho' },
  evento: { nome: 'Convidar para um evento', tempo: 2, energia: 7, dinheiro: 500, base: 9, noto: [1, 3], cat: 'publico' },
  elogiar: { nome: 'Elogiar publicamente', tempo: 1, energia: 3, dinheiro: 0, base: 7, noto: [0, 2], cat: 'publico', anuncio: 'elogio' },
  apoiar: { nome: 'Declarar apoio público', tempo: 1, energia: 5, dinheiro: 0, base: 10, apoiar: true, cat: 'publico' },
  criticar: { nome: 'Criticar publicamente', tempo: 1, energia: 5, dinheiro: 0, base: -14, cat: 'ataque', anuncio: 'critica' },
  pedir_apoio: { nome: 'Pedir apoio', tempo: 2, energia: 8, dinheiro: 0, base: 5, exigeContato: true, cat: 'negocio', pedido: true },
  negociar: { nome: 'Negociar um acordo', tempo: 2, energia: 10, dinheiro: 0, base: 14, exigeContato: true, cat: 'negocio' },
  parceria: { nome: 'Propor parceria', tempo: 2, energia: 9, dinheiro: 0, base: 12, exigeContato: true, cat: 'negocio', parceria: true },
  manter_contato: { nome: 'Manter contato', tempo: 1, energia: 2, dinheiro: 0, base: 4, exigeContato: true, cat: 'contato' },
};
export function acoesRelacaoInfo() { return ACOES_RELACAO; }

// Item 11 — como o estilo do político modula cada tipo de aproximação.
// >1 = ele responde melhor a isso; <1 = friamente. Para `criticar` (base<0),
// >1 significa que ele reage PIOR (relação despenca mais + tende a revidar).
const REACAO_ESTILO = {
  combativo: { criticar: 1.7, apoiar: 1.25, elogiar: 1.15, negociar: 0.75, parceria: 0.8, jantar: 1.1 },
  articulador: { negociar: 1.35, parceria: 1.35, pedir_apoio: 1.3, reuniao: 1.15, criticar: 0.7, jantar: 1.3 },
  tecnico: { reuniao: 1.3, negociar: 1.2, pedir_apoio: 1.1, evento: 0.75, elogiar: 0.85, jantar: 1.15 },
  midiatico: { elogiar: 1.45, evento: 1.35, apoiar: 1.2, criticar: 1.4, reuniao: 0.7, cafe: 0.8, jantar: 0.9 },
  cabo_eleitoral: { cafe: 1.35, almoco: 1.3, conversar: 1.2, telefonar: 1.15, negociar: 0.85, jantar: 1.25 },
};
function reacaoEstilo(p, tipo) {
  return (REACAO_ESTILO[p.estilo] || {})[tipo] ?? 1;
}

export function acaoRelacao(state, politicoId, tipo) {
  const cfg = ACOES_RELACAO[tipo];
  const p = state.mundo.politicos[politicoId];
  if (!cfg || !p) throw new Error('Ação inválida.');
  if (cfg.exigeContato && (p.ultimoContatoMes ?? -99) < 0) throw new Error('Você ainda não teve contato com essa pessoa.');
  if (state.tempo.energia < cfg.tempo) throw new Error(`Sem energia (custa ${cfg.tempo}).`);
  if (cfg.dinheiro > state.financas.pessoal) throw new Error('Dinheiro pessoal insuficiente.');

  const rng = createRng(state.meta.seed, state.meta.rngState);
  state.tempo.energia = Math.max(0, state.tempo.energia - cfg.tempo);
  state.financas.pessoal -= cfg.dinheiro;
  const m = state.tempo.mes;
  const est = reacaoEstilo(p, tipo);
  let msg;

  // telefonema pode simplesmente não render (não atende / liga depois)
  if (tipo === 'telefonar' && rng.chance(clamp(0.28 - (p.relacaoJogador || 0) / 200 - (state.reputacao.notoriedade - 40) / 250, 0.05, 0.6))) {
    p.ultimoContatoMes = m;
    state.meta.rngState = rng.state;
    state.log.unshift({ mes: m, tipo: 'ACAO', texto: `Ligou para ${p.nome} — não atendeu.` });
    return { ok: true, msg: `${p.nome} não atendeu a ligação.` };
  }

  if (tipo === 'criticar') {
    const dano = cfg.base * (0.8 + rng.float() * 0.5) * est; // negativo
    p.relacaoJogador = clamp(p.relacaoJogador + dano, -100, 100);
    p.ultimoContatoMes = m;
    state.reputacao.notoriedade = clamp(state.reputacao.notoriedade + rng.range([1, 3]), 0, 100);
    if (p.rejeicao > 45) {
      state.reputacao.aprovacao = clamp(state.reputacao.aprovacao + rng.range([0.3, 1.5]), 0, 100);
    } else {
      state.reputacao.rejeicao = clamp(state.reputacao.rejeicao + rng.range([0.5, 2]), 0, 100);
    }
    state.mundo.noticias.unshift({ id: `nt_crit_${politicoId}_${m}`, mes: m, tipo: 'ATAQUE', destaque: false, atores: [politicoId], texto: `${state.personagem.nome} criticou publicamente ${p.nome} (${p.partidoId}).` });
    // revida: combativo/midiático tende a responder na hora
    if (est > 1.2 && rng.chance(0.55)) {
      state.reputacao.rejeicao = clamp(state.reputacao.rejeicao + rng.range([1, 4]), 0, 100);
      state.reputacao.ecoMidiatico = clamp(state.reputacao.ecoMidiatico + rng.range([2, 6]), -50, 100);
      state.mundo.noticias.unshift({ id: `nt_revida_${politicoId}_${m}`, mes: m, tipo: 'ATAQUE', destaque: true, atores: [politicoId], texto: `${p.nome} (${p.partidoId}) revidou o ataque de ${state.personagem.nome}.` });
      msg = `${p.nome} revidou publicamente. Relação ${Math.round(p.relacaoJogador)}.`;
    } else {
      msg = `${p.nome} não gostou. Relação ${Math.round(p.relacaoJogador)}.`;
    }
  } else if (tipo === 'pedir_apoio') {
    const chance = clamp(0.15 + (p.relacaoJogador || 0) / 120 + ((ESTILOS[p.estilo]?.alia ?? 0.25) - 0.25) * 1.2
      - Math.abs((p.ideologiaEixo ?? 0) - eixoDoJogador(state)) / 200
      + (p.partidoId === state.personagem.partidoId ? 0.15 : 0), 0.03, 0.9);
    if (rng.chance(chance)) {
      cultivarPolitico(state, politicoId, cfg.base * 1.4, tipo);
      if (!(state.personagem.grupoPolitico || []).includes(politicoId) && (p.relacaoJogador || 0) > 35) {
        state.personagem.grupoPolitico.push(politicoId);
      }
      state.mundo.noticias.unshift({ id: `nt_apoiovc_${politicoId}_${m}`, mes: m, tipo: 'POLITICA', destaque: false, atores: [politicoId], texto: `${p.nome} (${p.partidoId}) declarou apoio a ${state.personagem.nome}.` });
      msg = `${p.nome} topou te apoiar.`;
    } else {
      cultivarPolitico(state, politicoId, -3, tipo);
      msg = `${p.nome} evitou se comprometer.`;
    }
  } else if (tipo === 'negociar' || tipo === 'parceria') {
    const ganho = cfg.base * (0.75 + rng.float() * 0.5) * est;
    cultivarPolitico(state, politicoId, ganho, tipo);
    if (tipo === 'parceria' && (p.relacaoJogador || 0) > 25 && !(p.aliados || []).includes('JOGADOR')) {
      (p.aliados ||= []).push('JOGADOR');
      state.mundo.noticias.unshift({ id: `nt_parc_${politicoId}_${m}`, mes: m, tipo: 'POLITICA', destaque: false, atores: [politicoId], texto: `${state.personagem.nome} e ${p.nome} anunciaram uma agenda conjunta.` });
    }
    msg = `${p.nome}: relação ${Math.round(p.relacaoJogador)}.`;
  } else {
    const ganho = cfg.base * (0.75 + rng.float() * 0.5) * est;
    cultivarPolitico(state, politicoId, ganho, tipo);
    if (cfg.noto) state.reputacao.notoriedade = clamp(state.reputacao.notoriedade + rng.range(cfg.noto), 0, 100);
    if (cfg.anuncio === 'elogio') {
      state.mundo.noticias.unshift({ id: `nt_elogio_${politicoId}_${m}`, mes: m, tipo: 'POLITICA', destaque: false, atores: [politicoId], texto: `${state.personagem.nome} elogiou publicamente ${p.nome} (${p.partidoId}).` });
    }
    if (cfg.apoiar) {
      if (p.rejeicao > 45) state.reputacao.rejeicao = clamp(state.reputacao.rejeicao + rng.range([0.5, 2]), 0, 100);
      state.mundo.noticias.unshift({ id: `nt_apoio_${politicoId}_${m}`, mes: m, tipo: 'POLITICA', destaque: false, atores: [politicoId], texto: `${state.personagem.nome} declarou apoio a ${p.nome} (${p.partidoId}).` });
    }
    msg = `${p.nome}: relação ${p.relacaoJogador >= 0 ? '+' : ''}${Math.round(p.relacaoJogador)}.`;
  }

  state.meta.rngState = rng.state;
  state.log.unshift({ mes: m, tipo: 'ACAO', texto: `${cfg.nome}: ${p.nome} — relação ${Math.round(p.relacaoJogador)}.` });
  return { ok: true, msg };
}

function eixoDoJogador(state) {
  return (partiesDef.partidos.find((x) => x.id === state.personagem.partidoId)?.eixo) ?? 0;
}

// Etapa 5 — limiar de relação a partir do qual dá para sequer TENTAR a aliança.
export function limiarAlianca(p) {
  // Item 12 — recalibrado: peixe grande ainda exige mais relação, mas menos proibitivo.
  return Math.round(26 + Math.max(0, (p.influencia || 50) - 50) * 0.5);
}

// Chance de fechar a aliança (rolagem, não binário). 0.03..0.9.
export function chanceAlianca(state, p) {
  const eixoJ = (partiesDef.partidos.find((x) => x.id === state.personagem.partidoId)?.eixo) ?? 0;
  const afinIdeo = 1 - Math.abs(eixoJ - (p.ideologiaEixo ?? 0)) / 100; // -1..1
  const mesmoPartido = p.partidoId === state.personagem.partidoId ? 1 : 0;
  const limiar = limiarAlianca(p);
  const bonusInflJog = (state.reputacao.notoriedade - 40) / 200 + ((state.personagem.cargoAtual || 'NENHUM') !== 'NENHUM' ? 0.12 : 0);
  const custoOportunidade = Math.max(0, (p.influencia || 50) - 58) / 240; // peixe grande pesa mais
  const est = polDefEstilo(p.estilo);
  const bonusEstilo = ((est?.alia ?? 0.25) - 0.25) * 0.6;
  // Item 12 — recompensa persistência e o "dar para receber":
  const persistencia = clamp((p._tentativasAlianca || 0) * 0.06, 0, 0.3);
  const apoioDado = (p._apoioRecebidoMes != null && state.tempo.mes - p._apoioRecebidoMes <= 4) ? 0.22 : 0;
  const chance = 0.26
    + (p.relacaoJogador - limiar) / 42
    + afinIdeo * 0.2
    + mesmoPartido * 0.2
    + bonusInflJog
    + bonusEstilo
    + persistencia
    + apoioDado
    - custoOportunidade
    + (multGabinete(state, 'aliancas') - 1) * 0.4; // Etapa 8 — assessor político
  return clamp(chance, 0.04, 0.95);
}

export function tentarAlianca(state, politicoId, { cobrarCusto = false } = {}) {
  const p = state.mundo.politicos[politicoId];
  if (!p) throw new Error('Político não encontrado.');
  if (state.personagem.grupoPolitico.includes(politicoId)) {
    return { ok: false, msg: `${p.nome} já faz parte do seu grupo.` };
  }
  const limiar = limiarAlianca(p);
  if (p.relacaoJogador < limiar) {
    return { ok: false, msg: `${p.nome} nem cogita — relação ${Math.round(p.relacaoJogador)}/${limiar}. Aproxime-se primeiro.` };
  }
  if (cobrarCusto) {
    if (state.tempo.energia < 2) return { ok: false, msg: 'Sem energia (custa 2).' };
    state.tempo.energia -= 2;
  }
  const rng = createRng(state.meta.seed, state.meta.rngState);
  const chance = chanceAlianca(state, p);
  const sucesso = rng.float() < chance;
  state.meta.rngState = rng.state;

  if (!sucesso) {
    // tentativa fracassada quase não esfria (não pode ir abaixo do limiar) e soma persistência
    p.relacaoJogador = clamp(p.relacaoJogador - rng.range([0, 2]), limiar - 2, 100);
    p._tentativasAlianca = (p._tentativasAlianca || 0) + 1;
    state.log.unshift({ mes: state.tempo.mes, tipo: 'POLITICA', texto: `${p.nome} recusou fechar aliança agora (${Math.round(chance * 100)}% de chance). Continue cultivando.` });
    return { ok: false, msg: `${p.nome} recusou por ora. Chance era ~${Math.round(chance * 100)}%.` };
  }

  delete p._tentativasAlianca;
  state.personagem.grupoPolitico.push(politicoId);
  p.relacaoJogador = clamp(p.relacaoJogador + 8, -100, 100);
  state.mundo.noticias.unshift({
    id: `nt_al_${state.tempo.mes}_${politicoId}`, mes: state.tempo.mes, tipo: 'ALIANCA', destaque: true,
    atores: [politicoId], texto: `${p.nome} (${p.partidoId}) declarou apoio a você.`,
  });
  state.log.unshift({ mes: state.tempo.mes, tipo: 'MARCO', texto: `${p.nome} entrou para o seu grupo político.` });
  return { ok: true, msg: `${p.nome} agora apoia você.` };
}

// Etapa 5 — romper com um aliado.
export function romperAlianca(state, politicoId) {
  const i = state.personagem.grupoPolitico.indexOf(politicoId);
  if (i < 0) return { ok: false, msg: 'Essa pessoa não está no seu grupo.' };
  state.personagem.grupoPolitico.splice(i, 1);
  const p = state.mundo.politicos[politicoId];
  if (p) {
    p.relacaoJogador = clamp(p.relacaoJogador - 25, -100, 100);
    state.log.unshift({ mes: state.tempo.mes, tipo: 'POLITICA', texto: `Você rompeu com ${p.nome}. A relação azedou.` });
  }
  return { ok: true, msg: `Aliança com ${p?.nome || 'o aliado'} rompida.` };
}

// Item 12 — "dar para receber": banca o outro publicamente primeiro. Sobe a relação,
// destrava um bônus grande de aliança por alguns meses, mas cola a imagem dele em você.
export function oferecerApoio(state, politicoId) {
  const p = state.mundo.politicos[politicoId];
  if (!p) throw new Error('Político não encontrado.');
  if (state.personagem.grupoPolitico.includes(politicoId)) return { ok: false, msg: `${p.nome} já é seu aliado.` };
  if (state.tempo.energia < 1) return { ok: false, msg: 'Sem tempo (custa 1).' };
  const rng = createRng(state.meta.seed, state.meta.rngState);
  state.tempo.energia -= 1;
  const m = state.tempo.mes;
  p.relacaoJogador = clamp(p.relacaoJogador + rng.range([6, 12]), -100, 100);
  p._apoioRecebidoMes = m;
  if (p.rejeicao > 40) {
    state.reputacao.rejeicao = clamp(state.reputacao.rejeicao + rng.range([1, 3]), 0, 100);
  }
  state.mundo.noticias.unshift({ id: `nt_ofapoio_${politicoId}_${m}`, mes: m, tipo: 'POLITICA', destaque: false, atores: [politicoId], texto: `${state.personagem.nome} declarou apoio a ${p.nome} (${p.partidoId}).` });
  state.meta.rngState = rng.state;
  state.log.unshift({ mes: m, tipo: 'POLITICA', texto: `Você bancou ${p.nome} publicamente. Ele fica te devendo essa.` });
  return { ok: true, msg: `${p.nome} não vai esquecer. Aliança fica bem mais provável nos próximos meses.` };
}

// Item 12 — articular a coligação da próxima eleição: se você tem peso interno e
// aliados numa outra sigla, pré-compromete aquele partido a coligar com o seu.
export function articularColigacao(state, partidoAlvoId) {
  const meu = state.personagem.partidoId;
  if (!meu) return { ok: false, msg: 'Você precisa estar filiado a um partido.' };
  if (partidoAlvoId === meu) return { ok: false, msg: 'Esse já é o seu partido.' };
  if (state.tempo.energia < 2) return { ok: false, msg: 'Sem tempo (custa 2).' };
  const aliadosLa = (state.personagem.grupoPolitico || [])
    .map((id) => state.mundo.politicos[id]).filter((p) => p && p.partidoId === partidoAlvoId).length;
  const pr = state.mundo.partidosRuntime?.[meu];
  const peso = (pr?.diretorioDoJogador ? 2 : 0) + (pr?.apoioAoJogador > 55 ? 1 : 0) + aliadosLa;
  if (peso < 2) {
    return { ok: false, msg: 'Você ainda não tem cacife para isso — precisa presidir o diretório ou ter aliados na sigla-alvo.' };
  }
  state.tempo.energia -= 2;
  const rng = createRng(state.meta.seed, state.meta.rngState);
  const chance = clamp(0.25 + peso * 0.12 + aliadosLa * 0.08, 0.1, 0.85);
  const ok = rng.chance(chance);
  state.meta.rngState = rng.state;
  const m = state.tempo.mes;
  if (ok) {
    state.mundo.coligacaoArticulada = { comPartido: partidoAlvoId, ateMes: m + 30 };
    state.mundo.noticias.unshift({ id: `nt_colig_${m}`, mes: m, tipo: 'POLITICA', destaque: true, atores: [], texto: `${state.personagem.nome} costura uma coligação entre ${meu} e ${partidoAlvoId}.` });
    return { ok: true, msg: `Acordo encaminhado: ${partidoAlvoId} deve coligar com o ${meu} na próxima eleição.` };
  }
  return { ok: false, msg: `${partidoAlvoId} não topou agora (chance era ~${Math.round(chance * 100)}%). Reforce sua posição e tente de novo.` };
}

// Prioridade 5 — propor coligação PELA ficha de um político influente da outra sigla:
// se a relação com ele for boa e ele tiver peso, é a via mais direta.
export function articularColigacaoVia(state, politicoId) {
  const p = state.mundo.politicos[politicoId];
  if (!p) return { ok: false, msg: 'Político não encontrado.' };
  if (!state.personagem.partidoId) return { ok: false, msg: 'Você precisa estar filiado.' };
  if (p.partidoId === state.personagem.partidoId) return { ok: false, msg: 'Ele já é do seu partido.' };
  if ((p.relacaoJogador || 0) < 35) return { ok: false, msg: `Relação com ${p.nome} baixa demais (${Math.round(p.relacaoJogador)}/35) para ele bancar isso na sigla dele.` };
  if (state.tempo.energia < 2) return { ok: false, msg: 'Sem tempo (custa 2).' };
  state.tempo.energia -= 2;
  const rng = createRng(state.meta.seed, state.meta.rngState);
  const infl = (p.influencia || 50) / 100;
  const chance = clamp(0.1 + (p.relacaoJogador - 35) / 90 + infl * 0.35 + (p.lider ? 0.15 : 0), 0.08, 0.85);
  const ok = rng.chance(chance);
  state.meta.rngState = rng.state;
  const m = state.tempo.mes;
  if (ok) {
    state.mundo.coligacaoArticulada = { comPartido: p.partidoId, ateMes: m + 30 };
    p.relacaoJogador = clamp(p.relacaoJogador + rng.int(2, 6), -100, 100);
    state.mundo.noticias.unshift({ id: `nt_coligv_${m}`, mes: m, tipo: 'POLITICA', destaque: true, atores: [politicoId], texto: `${p.nome} (${p.partidoId}) acertou uma coligação com o partido de ${state.personagem.nome}.` });
    return { ok: true, msg: `${p.nome} topou levar o ${p.partidoId} para a sua coligação.` };
  }
  return { ok: false, msg: `${p.nome} não conseguiu (ou não quis) fechar agora — ~${Math.round(chance * 100)}%. Continue cultivando.` };
}

// Etapa 5 — efeito mensal de manter um grupo político (chamado no worldTick).
export function tickAliancas(s) {
  const grupo = s.personagem.grupoPolitico || [];
  if (!grupo.length) return { eventos: [] };
  const rng = streamRng(s.meta.seed, 'aliancas', s.tempo.mes);
  let forca = 0;
  for (const id of grupo) {
    const p = s.mundo.politicos[id];
    if (!p || !p.ativo) continue;
    const f = p.influencia / 100;
    forca += f;
    // apoio interno se do mesmo partido — um aliado de peso segura a sua indicação
    if (p.partidoId === s.personagem.partidoId) {
      const pr = s.mundo.partidosRuntime[p.partidoId];
      if (pr) pr.apoioAoJogador = clamp(pr.apoioAoJogador + (0.6 + f) * rng.range([1.2, 2.6]), 0, 100);
    }
    // aliado influente sustenta a sua presença nos redutos dele
    for (const [bid, w] of Object.entries(p.baseBairros || {})) {
      const t = (s.territorio.porBairro[bid] ||= { presenca: 0, penetracao: 0 });
      t.presenca = clamp(t.presenca + w * f * rng.range([0.3, 0.9]), 0, 100);
    }
  }
  // um grupo forte também mantém algum eco/notoriedade
  s.reputacao.ecoMidiatico = clamp(s.reputacao.ecoMidiatico + forca * rng.range([0.4, 1]), -50, 100);
  s.reputacao.notoriedade = clamp(s.reputacao.notoriedade + forca * rng.range([0.05, 0.2]), 0, 100);
  return { eventos: [] };
}

// bônus concedidos ao jogador no início da campanha pelo grupo político + alianças
export function bonusDeAliancas(state) {
  let eco = 0; let noto = 0; let caixa = 0; const territorio = {};
  for (const id of state.personagem.grupoPolitico) {
    const p = state.mundo.politicos[id];
    if (!p) continue;
    const f = p.influencia / 100;
    eco += f * 6;
    noto += f * 4;
    caixa += Math.round(f * 18000);
    for (const [bid, w] of Object.entries(p.baseBairros)) {
      territorio[bid] = (territorio[bid] || 0) + w * f * 18;
    }
  }
  return { eco, noto, caixa, territorio, n: state.personagem.grupoPolitico.length };
}

// --- Fase 21: política partidária interna ---

// "base interna": quantos filiados do seu partido te apoiam + apoio institucional
export function baseInterna(state) {
  const pid = state.personagem.partidoId;
  if (!pid) return 0;
  const pr = state.mundo.partidosRuntime?.[pid];
  const aliadosNoPartido = Object.values(state.mundo.politicos || {})
    .filter((p) => p.ativo && p.partidoId === pid && p.relacaoJogador > 25).length;
  const noGrupo = state.personagem.grupoPolitico
    .filter((id) => state.mundo.politicos?.[id]?.partidoId === pid).length;
  return Math.round((pr?.apoioAoJogador || 30) * 0.5 + aliadosNoPartido * 6 + noGrupo * 4);
}

export function disputarDiretorio(state, rng) {
  const pid = state.personagem.partidoId;
  if (!pid) return { ok: false, msg: 'Você não é filiado a nenhum partido.' };
  const pr = state.mundo.partidosRuntime[pid];
  if (pr.diretorioDoJogador) return { ok: true, msg: 'Você já preside o diretório municipal.' };
  const base = baseInterna(state);
  const presidente = state.mundo.politicos?.[pr.presidenteMunicipal];
  const forcaAtual = presidente ? presidente.influencia * 0.55 + 15 : 35;
  const chance = clamp((base - forcaAtual) / 45 + 0.3 + (state.personagem.atributos.lideranca - 50) / 140, 0.05, 0.85);
  const m = state.tempo.mes;
  if (rng.chance(chance)) {
    pr.diretorioDoJogador = true;
    pr.presidenteMunicipal = 'JOGADOR';
    pr.apoioAoJogador = clamp(Math.max(pr.apoioAoJogador, 60), 0, 100);
    state.reputacao.notoriedade = clamp(state.reputacao.notoriedade + rng.int(4, 9), 0, 100);
    // o ex-presidente pode virar rival
    if (presidente) presidente.relacaoJogador = clamp(presidente.relacaoJogador - rng.int(15, 35), -100, 100);
    state.mundo.noticias.unshift({ id: `nt_dir_${m}`, mes: m, tipo: 'POLITICA', destaque: true, atores: [], texto: `Você assumiu a presidência do diretório municipal do ${pid}.` });
    state.log.unshift({ mes: m, tipo: 'MARCO', texto: `Você comanda o diretório do ${pid}: controla a indicação de candidaturas e os recursos do partido na cidade.` });
    return { ok: true, msg: `Diretório do ${pid} é seu.` };
  }
  pr.apoioAoJogador = clamp(pr.apoioAoJogador - rng.int(4, 12), 0, 100);
  if (presidente) presidente.relacaoJogador = clamp(presidente.relacaoJogador - rng.int(8, 18), -100, 100);
  state.log.unshift({ mes: m, tipo: 'POLITICA', texto: `Você perdeu a disputa pelo diretório do ${pid}. ${presidente?.nome || 'A ala dominante'} saiu fortalecido — e ressentido.` });
  return { ok: false, msg: `Derrota na convenção. Base interna insuficiente (${base}).` };
}

// wrapper com custo p/ a aba Política
export function disputarDiretorioJogador(state) {
  if (state.tempo.energia < 3) throw new Error('Sem energia suficiente este mês (custa 3).');
  const rng = createRng(state.meta.seed, state.meta.rngState);
  state.tempo.energia -= 3;
  const r = disputarDiretorio(state, rng);
  state.meta.rngState = rng.state;
  return r;
}
