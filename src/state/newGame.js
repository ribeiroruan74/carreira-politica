import { emptyState } from './schema';
import { createRng, hashSeed, clamp } from '../engine/rng';
import { inicializarMundo } from '../engine/world';
import { inicializarInfluenciadores } from '../engine/influencers';
import { assumirEmprego, sincronizarRenda } from '../engine/jobs';
import jobsDef from '../content/jobs.json';
import balance from '../content/balance.json';
import attributesDef from '../content/attributes.json';
import professionsDef from '../content/professions.json';
import contactsDef from '../content/contacts.json';
import { bairrosDaCidade, CIDADE_PADRAO } from '../engine/offices';

const ATTR_IDS = attributesDef.atributos.map((a) => a.id);

function nomeContato(rng) {
  return `${rng.pick(contactsDef.nomes.primeiros)} ${rng.pick(contactsDef.nomes.sobrenomes)}`;
}

// Cria o estado inicial a partir das escolhas da tela de criação.
export function novoJogo({
  nome, profissaoId, traçoId, idade, cidade, dificuldade = 'NORMAL', seed,
}) {
  const seedNum = seed ? hashSeed(String(seed)) : (Math.random() * 2 ** 32) >>> 0;
  const rng = createRng(seedNum);

  const profissao = professionsDef.profissoes.find((p) => p.id === profissaoId)
    || professionsDef.profissoes[professionsDef.profissoes.length - 1];
  const traço = attributesDef.traços.find((t) => t.id === traçoId) || null;

  const s = emptyState();

  s.meta.seed = seedNum;
  s.meta.rngState = null;
  s.meta.dificuldade = dificuldade;
  s.meta.criadoEm = new Date().toISOString();

  // --- Tempo ---
  s.tempo.pontosPorMes = balance.tempo.pontosPorMesBase;
  s.tempo.pontosRestantes = balance.tempo.pontosPorMesBase;
  s.tempo.energiaMax = balance.tempo.energiaMaxBase;
  s.tempo.energia = balance.tempo.energiaMaxBase;

  // --- Personagem ---
  s.personagem.nome = nome?.trim() || 'Candidato(a) sem nome';
  s.personagem.idade = idade || balance.tempo.idadeInicialPadrao;
  s.personagem.cidade = cidade || CIDADE_PADRAO; // Fase 26
  const bairrosCidade = bairrosDaCidade(s.personagem.cidade);
  s.personagem.profissaoId = profissao.id;
  s.personagem.traçoId = traço?.id || null;
  s.personagem.historicoProfissional = [{ mes: 0, texto: `Começou a carreira como ${profissao.nome}.` }];

  // Atributos: base 38-52 + bônus de profissão + bônus de traço
  const atributos = {};
  for (const id of ATTR_IDS) {
    let v = rng.int(38, 52);
    if (profissao.atributos?.[id]) v += profissao.atributos[id];
    if (traço?.atributos?.[id]) v += traço.atributos[id];
    atributos[id] = clamp(Math.round(v), 1, 99);
  }
  s.personagem.atributos = atributos;

  // Skills
  s.personagem.skills = { ...(profissao.skills || {}) };

  // Dificuldade afeta capital inicial e renda
  const multDif = dificuldade === 'DIFICIL' ? 0.85 : dificuldade === 'FACIL' ? 1.6 : 1.2;
  const multBase = balance.financas.multiplicadorDinheiroInicial || 1;

  // --- Finanças ---
  s.financas.pessoal = Math.round(rng.rangeInt(profissao.dinheiro) * multDif * multBase);
  s.financas.custoVidaMensal = rng.rangeInt([
    balance.financas.custoVidaMensal.min,
    balance.financas.custoVidaMensal.max,
  ]);
  s.personagem.patrimonio = Math.round(s.financas.pessoal * rng.range([0.8, 3.5]));

  // --- Emprego inicial ---
  const empInicialId = jobsDef.inicialPorProfissao[profissao.id] || 'assistente_escritorio';
  assumirEmprego(s, empInicialId, rng, true);
  s.personagem.historicoProfissional = [{ mes: 0, texto: `Começou a carreira como ${profissao.nome}.` }, ...s.personagem.historicoProfissional];
  sincronizarRenda(s);
  s.tempo.pontosRestantes = Math.max(2, s.tempo.pontosPorMes - (s.personagem.emprego?.horas || 0));

  // --- Reputação ---
  s.reputacao.aprovacao = balance.reputacao.aprovacaoInicial;
  s.reputacao.confianca = clamp(
    balance.reputacao.confiancaInicial + (profissao.confiancaBonus || 0),
    0, 100,
  );
  s.reputacao.rejeicao = clamp(
    balance.reputacao.rejeicaoInicial + (profissao.rejeicaoBonus || 0),
    0, 100,
  );
  s.reputacao.notoriedade = clamp(
    balance.reputacao.notoriedadeInicial + (profissao.notoriedadeBonus || 0)
      + Math.round(atributos.popularidade / 20),
    0, 100,
  );

  // --- Redes ---
  const segRange = profissao.usaSeguidoresIniciaisInfluenciador
    ? balance.redes.seguidoresIniciaisInfluenciador
    : balance.redes.seguidoresIniciais;
  let seguidores = rng.rangeInt([segRange.min, segRange.max]);
  if (profissao.seguidoresBonus) seguidores += rng.rangeInt(profissao.seguidoresBonus);
  s.redes.seguidores = seguidores;
  s.redes.alcanceMedio = Math.round(seguidores * rng.range([0.15, 0.4]));
  s.redes.engajamento = +(rng.range([0.02, 0.07])).toFixed(3);

  // --- Relacionamentos (contatos da profissão) ---
  for (const cid of profissao.contatos || []) {
    const def = contactsDef.papeis[cid];
    if (!def) continue;
    const id = `c_${cid}`;
    s.relacionamentos.pessoas[id] = {
      id,
      nome: nomeContato(rng),
      papel: def.papel,
      profissao: def.profissao,
      ideologiaEixo: def.eixo + rng.int(-8, 8),
      influencia: rng.rangeInt(def.influencia),
      confianca: rng.int(20, 42),
      nivel: 'CONHECIDO',
      ultimoContatoMes: 0,
      origem: profissao.nome,
    };
  }

  // --- Território (bônus inicial de líder comunitário concentra num bairro) ---
  if (profissao.territorioInicialBonus) {
    const bairro = rng.pick(bairrosCidade.filter((b) => b.renda <= 3));
    s.territorio.porBairro[bairro.id] = {
      presenca: profissao.territorioInicialBonus + rng.int(0, 10),
      penetracao: Math.round(profissao.territorioInicialBonus * 0.6),
    };
    s.personagem.historicoPolitico.push({
      mes: 0, texto: `Referência comunitária no bairro ${bairro.nome}.`,
    });
  }

  s.log.push({
    mes: 0,
    tipo: 'INICIO',
    texto: `${s.personagem.nome}, ${s.personagem.idade} anos, ${profissao.nome}${traço ? `, perfil ${traço.nome.toLowerCase()}` : ''}. A carreira começa agora.`,
  });

  s.meta.rngState = rng.state;
  inicializarMundo(s);
  inicializarInfluenciadores(s);
  return s;
}
