// Fase 17 — financiamento rastreado.
// Toda captação de recursos passa a ter origem: um doador com setor e interesse.
// Doações grandes e concentradas acumulam `risco`; quando o risco de um doador
// estoura, vira uma investigação (via world memory) e/ou uma cobrança.

import { streamRng, createRng, clamp } from './rng';
import { registrarFato } from './worldMemory';

const SETORES = [
  { id: 'construcao', nome: 'Construção civil', interesse: 'contratos de obras e licenciamento urbano', risco: 1.6 },
  { id: 'transporte', nome: 'Transporte e mobilidade', interesse: 'concessões de linhas e tarifas', risco: 1.5 },
  { id: 'saude_privada', nome: 'Saúde privada', interesse: 'credenciamentos e repasses da rede', risco: 1.3 },
  { id: 'comercio', nome: 'Comércio e varejo', interesse: 'carga tributária municipal e horário de funcionamento', risco: 0.9 },
  { id: 'educacao_privada', nome: 'Educação privada', interesse: 'convênios e isenções', risco: 1.0 },
  { id: 'tecnologia', nome: 'Tecnologia e serviços', interesse: 'contratos de modernização da gestão', risco: 1.1 },
  { id: 'eventos', nome: 'Eventos e entretenimento', interesse: 'editais de cultura e uso de espaços públicos', risco: 0.8 },
  { id: 'ambiental', nome: 'Coleta e saneamento', interesse: 'contratos de limpeza urbana', risco: 1.7 },
];

const PREFIXOS = ['Grupo', 'Construtora', 'Associação', 'Rede', 'Holding', 'Instituto', 'Cooperativa'];
const NOMES = ['Aurora', 'Beberibe', 'Capibaribe', 'Pina', 'Boa Vista', 'Nordeste', 'Recife', 'Guararapes', 'Atlântico', 'Frei Caneca', 'Derby', 'Várzea'];

export function setorPorId(id) {
  return SETORES.find((s) => s.id === id) || null;
}

function novoDoador(rng) {
  const setor = rng.pick(SETORES);
  const nome = `${rng.pick(PREFIXOS)} ${rng.pick(NOMES)}`;
  return {
    id: `dn_${setor.id}_${nome.replace(/\s+/g, '').toLowerCase()}`,
    nome, setor: setor.id, interesse: setor.interesse,
    valorTotal: 0, mesUltima: 0, risco: 0, cobrado: false, investigado: false,
  };
}

// Captação. base = valor pretendido; a habilidade do jogador ajusta o resultado.
export function captarDoacao(state, rng, base = 30000) {
  const lista = (state.financas.doadores ||= []);
  const neg = state.personagem.atributos.negociacao || 50;
  const noto = state.reputacao.notoriedade || 0;
  const fator = 0.55 + neg / 140 + noto / 260 + rng.range([-0.1, 0.25]);
  const valor = Math.max(3000, Math.round((base * fator) / 500) * 500);

  let doador;
  const antigos = lista.filter((d) => !d.investigado);
  if (antigos.length && rng.chance(0.55)) {
    doador = rng.weighted(antigos, (d) => 1 + d.valorTotal / 40000);
  } else {
    doador = novoDoador(rng);
    lista.push(doador);
  }

  doador.valorTotal += valor;
  doador.mesUltima = state.tempo.mes;
  state.financas.campanha += valor;

  // risco: cresce com o valor da doação e com a concentração acumulada
  const setor = setorPorId(doador.setor);
  const incremento = (valor / 22000) * (setor?.risco || 1)
    + Math.max(0, doador.valorTotal - 60000) / 90000;
  doador.risco = clamp(doador.risco + incremento * 8, 0, 100);

  return { doador, valor, setor };
}

export function exposicaoDoadores(state) {
  const lista = state.financas?.doadores || [];
  if (!lista.length) return 0;
  return Math.round(clamp(
    lista.reduce((s, d) => s + d.risco * (1 + d.valorTotal / 120000), 0) / 2.5,
    0, 100,
  ));
}

export function doadoresResumo(state) {
  return [...(state.financas?.doadores || [])]
    .sort((a, b) => b.valorTotal - a.valorTotal)
    .map((d) => ({ ...d, setorNome: setorPorId(d.setor)?.nome || d.setor }));
}

export function tickDoadores(s) {
  const eventos = [];
  const lista = s.financas?.doadores;
  if (!lista?.length) return { eventos };
  const rng = streamRng(s.meta.seed, 'doadores', s.tempo.mes);

  for (const d of lista) {
    d.risco = clamp(d.risco * 0.985, 0, 100);

    // cobrança: o doador vem pedir a "contrapartida"
    if (!d.cobrado && d.valorTotal >= 45000 && d.risco >= 45 && s.mandato
        && !s.eventoPendente && rng.chance(0.16)) {
      d.cobrado = true;
      s.eventoPendente = {
        id: `dn_cobr_${d.id}_${s.tempo.mes}`,
        cat: 'BASTIDORES',
        titulo: `${d.nome} quer uma conversa`,
        contexto: `O ${setorPorId(d.setor)?.nome || 'grupo'} que bancou R$ ${d.valorTotal.toLocaleString('pt-BR')} da sua campanha pede atenção a ${d.interesse}. O lobista foi direto: "a gente se ajudou, agora é a sua vez".`,
        opcoes: [
          { texto: 'Atender o pedido nos bastidores' },
          { texto: 'Ouvir, prometer analisar e empurrar' },
          { texto: 'Recusar e deixar claro que não há acordo' },
        ],
        _doadorId: d.id,
        _cobrancaDoador: true,
      };
      eventos.push({ tipo: 'ALERTA', texto: `${d.nome} está cobrando a contrapartida da doação.` });
      continue;
    }

    // exposição: risco alto vira investigação da imprensa meses depois
    if (!d.investigado && d.risco >= 68 && rng.chance(0.4)) {
      d.investigado = true;
      registrarFato(s, {
        tipo: 'FINANCIAMENTO',
        texto: `doações de R$ ${d.valorTotal.toLocaleString('pt-BR')} do ${setorPorId(d.setor)?.nome || 'setor privado'} (${d.nome})`,
        dados: {
          tituloInvestigacao: `As doações do ${setorPorId(d.setor)?.nome || 'setor'} para o seu mandato`,
          contextoInvestigacao: `Uma reportagem cruza o seu financiamento de campanha com ${d.interesse}`,
        },
        gatilho: {
          aposMeses: [2, 6], chance: 0.6, disparo: 'INVESTIGACAO',
          maturaEm: s.tempo.mes + rng.int(2, 6),
        },
      });
      eventos.push({ tipo: 'ALERTA', texto: `Jornalistas começaram a perguntar sobre o dinheiro do ${setorPorId(d.setor)?.nome || 'setor privado'} na sua campanha.` });
    }
  }
  return { eventos };
}

// resolução da cobrança (chamada pelo store ao escolher a opção)
export function resolverCobrancaDoador(state, opcaoIndex) {
  const pend = state.eventoPendente;
  if (!pend?._cobrancaDoador) return;
  const d = (state.financas.doadores || []).find((x) => x.id === pend._doadorId);
  const rng = createRng(state.meta.seed, state.meta.rngState);
  const mes = state.tempo.mes;
  let texto;

  if (opcaoIndex === 0) {
    // atende — alívio imediato, dívida moral e risco de exposição
    if (d) { d.risco = clamp(d.risco + 18, 0, 100); d.cobrado = true; }
    state.financas.campanha += 20000;
    state.reputacao.confianca = clamp(state.reputacao.confianca - rng.range([1, 3]), 0, 100);
    registrarFato(state, {
      tipo: 'FINANCIAMENTO',
      texto: `favor concedido ao ${d ? d.nome : 'doador'} em troca de apoio de campanha`,
      dados: { tituloInvestigacao: 'A contrapartida ao seu financiador', contextoInvestigacao: 'Documentos sugerem troca de favores' },
      gatilho: { aposMeses: [3, 9], chance: 0.55, disparo: 'INVESTIGACAO', maturaEm: mes + rng.int(3, 9) },
    });
    texto = 'Você atendeu o pedido nos bastidores. O caixa respira — mas ficou um rastro.';
  } else if (opcaoIndex === 1) {
    if (d) d.risco = clamp(d.risco - 6, 0, 100);
    state.reputacao.rejeicao = clamp(state.reputacao.rejeicao + rng.range([0, 1.5]), 0, 100);
    texto = 'Você ganhou tempo. O doador não gostou, mas ninguém rompeu.';
  } else {
    if (d) { d.risco = clamp(d.risco - 20, 0, 100); d.cobrado = true; }
    state.reputacao.confianca = clamp(state.reputacao.confianca + rng.range([1, 3]), 0, 100);
    state.financas.campanha = Math.max(0, state.financas.campanha - 8000);
    texto = 'Você recusou e foi claro. O grupo fechou a torneira e pode migrar para um rival.';
  }

  state.mundo.noticias.unshift({ id: `dn_res_${mes}`, mes, tipo: 'BASTIDORES', destaque: false, atores: [], texto });
  state.log.unshift({ mes, tipo: 'BASTIDORES', texto });
  state.meta.rngState = rng.state;
  state.eventoPendente = null;
}
