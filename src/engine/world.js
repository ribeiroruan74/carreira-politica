import { streamRng, createRng, clamp } from './rng';
import polDef from '../content/politicians.json';
import partiesDef from '../content/parties.json';
import recife from '../content/neighborhoods/recife.json';
import { bairrosDaCidade } from './offices';

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
      pol.relacaoJogador = pol.relacaoJogador > 0
        ? Math.max(0, pol.relacaoJogador - 1)
        : Math.min(0, pol.relacaoJogador + 0.5);
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
    if (membros.length) {
      const alvo = membros.reduce((acc, m) => acc + (m.notoriedade - m.rejeicao * 0.5), 0) / membros.length;
      pr.popularidade = clamp(pr.popularidade + (alvo / 2 - pr.popularidade) * 0.05 + rng.range([-1.5, 1.5]), 3, 95);
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

  return { state: s, eventos };
}

// --- interação do jogador com o mundo (usado por actions/politica.json) ---
export function cultivarPolitico(state, politicoId, ganho) {
  const p = state.mundo.politicos[politicoId];
  if (!p) throw new Error('Político não encontrado.');
  p.relacaoJogador = clamp(p.relacaoJogador + ganho, -100, 100);
  p.ultimoContatoMes = state.tempo.mes;
  // apoio interno se for do mesmo partido
  if (p.partidoId === state.personagem.partidoId) {
    const pr = state.mundo.partidosRuntime[p.partidoId];
    if (pr) pr.apoioAoJogador = clamp(pr.apoioAoJogador + ganho * 0.35, 0, 100);
  }
  return p;
}

// quanto mais influente o político, mais difícil trazê-lo para o seu lado
export function limiarAlianca(p) {
  return Math.round(35 + Math.max(0, p.influencia - 45) * 0.95);
}

export function tentarAlianca(state, politicoId) {
  const p = state.mundo.politicos[politicoId];
  if (!p) throw new Error('Político não encontrado.');
  const limiar = limiarAlianca(p);
  if (p.relacaoJogador < limiar) {
    return { ok: false, msg: `${p.nome} ainda não confia o suficiente em você (relação ${Math.round(p.relacaoJogador)}/${limiar}).` };
  }
  if (state.personagem.grupoPolitico.includes(politicoId)) {
    return { ok: false, msg: `${p.nome} já faz parte do seu grupo.` };
  }
  state.personagem.grupoPolitico.push(politicoId);
  p.relacaoJogador = clamp(p.relacaoJogador + 8, -100, 100);
  state.mundo.noticias.unshift({
    id: `nt_al_${state.tempo.mes}_${politicoId}`, mes: state.tempo.mes, tipo: 'ALIANCA', destaque: true,
    atores: [politicoId], texto: `${p.nome} (${p.partidoId}) declarou apoio a você.`,
  });
  state.log.unshift({ mes: state.tempo.mes, tipo: 'MARCO', texto: `${p.nome} entrou para o seu grupo político.` });
  return { ok: true, msg: `${p.nome} agora apoia você.` };
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
  if (state.tempo.pontosRestantes < 3) throw new Error('Sem tempo suficiente este mês (custa 3).');
  const rng = createRng(state.meta.seed, state.meta.rngState);
  state.tempo.pontosRestantes -= 3;
  state.tempo.energia = clamp(state.tempo.energia - 14, 0, state.tempo.energiaMax);
  const r = disputarDiretorio(state, rng);
  state.meta.rngState = rng.state;
  return r;
}
