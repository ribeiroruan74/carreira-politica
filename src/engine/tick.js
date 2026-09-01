import { createRng, clamp } from './rng';
import balance from '../content/balance.json';
import { sincronizarRenda, horasEmprego } from './jobs';
import { custoServicosMensal } from './lifestyle';

const NIVEIS = balance.relacionamentos.niveis;
const LIMIARES = balance.relacionamentos.limiaresConfianca;

export function nivelPorConfianca(confianca) {
  let nivel = NIVEIS[0];
  for (let i = 0; i < LIMIARES.length; i++) {
    if (confianca >= LIMIARES[i]) nivel = NIVEIS[i];
  }
  return nivel;
}

// Roda 1 mês. Função pura: recebe o estado, devolve um novo estado + eventos.
// Não muta a entrada (o store faz o replace).
// Recebe um estado já clonado pelo store (muta e devolve o mesmo objeto).
export function runTick(s) {
  const rng = createRng(s.meta.seed, s.meta.rngState);
  const eventos = [];

  s.tempo.mes += 1;
  const mes = s.tempo.mes;
  const anoAtual = s.tempo.anoInicial + Math.floor(mes / 12);

  // Aniversário anual
  if (mes % 12 === 0) {
    s.personagem.idade += 1;
    eventos.push({ tipo: 'INFO', texto: `Você completou ${s.personagem.idade} anos.` });
  }

  // --- Recursos do mês ---
  sincronizarRenda(s);
  // Item 1 — energia é o recurso único do mês; recompõe cheia (menos o que o emprego consome).
  const horas = horasEmprego(s);
  s.tempo.energia = Math.max(3, s.tempo.energiaMax - horas);

  // --- Finanças mensais ---
  // Etapa 13 — custo de vida de político: cargo eletivo puxa despesa pessoal
  // (deslocamento, eventos, contribuições ao partido, equipe informal).
  const custoPolitico = s.personagem.cargoAtual && s.personagem.cargoAtual !== 'NENHUM'
    ? { VEREADOR: 4500, DEPUTADO_ESTADUAL: 9000, DEPUTADO_FEDERAL: 12000, PREFEITO: 11000 }[s.personagem.cargoAtual] || 6000
    : 0;
  const custoServicos = custoServicosMensal(s); // Item 7 — assinaturas de estilo de vida
  const saldoMes = s.financas.rendaMensal - s.financas.custoVidaMensal - custoPolitico - custoServicos;
  s.financas.pessoal += saldoMes;
  if (s.financas.pessoal < 0) {
    const rombo = -s.financas.pessoal;
    s.financas.pessoal = 0;
    s.personagem.patrimonio = Math.max(0, s.personagem.patrimonio - rombo * 1.5);
    eventos.push({
      tipo: 'ALERTA',
      texto: `Suas contas pessoais fecharam no vermelho. Você teve que consumir patrimônio (−${formatBRL(rombo * 1.5)}).`,
    });
  }

  // --- Relacionamentos: decaimento por falta de contato ---
  // Item 9 — estabiliza: decai devagar e para numa linha de base (você não
  // esquece de alguém que já conheceu; gente influente continua no seu radar).
  for (const p of Object.values(s.relacionamentos.pessoas)) {
    const mesesSemContato = mes - (p.ultimoContatoMes ?? 0);
    if (mesesSemContato >= 3) {
      const piso = 12 + (p.influencia > 60 ? 8 : p.influencia > 45 ? 4 : 0);
      const taxa = balance.relacionamentos.decaimentoMensalSemContato
        * (p.confianca - piso > 20 ? 1 : 0.4); // desacelera perto do piso
      p.confianca = Math.max(piso, +(p.confianca - taxa).toFixed(1));
    }
    const novoNivel = nivelPorConfianca(p.confianca);
    if (novoNivel !== p.nivel) {
      const subiu = NIVEIS.indexOf(novoNivel) > NIVEIS.indexOf(p.nivel);
      p.nivel = novoNivel;
      if (!subiu && (novoNivel === 'CONHECIDO' || novoNivel === 'DESCONHECIDO')) {
        eventos.push({
          tipo: 'RELACIONAMENTO',
          texto: `Seu vínculo com ${p.nome} (${p.papel}) esfriou.`,
        });
      }
    }
  }

  // --- Território: presença fora de campanha esvai (você não está lá toda hora) ---
  if (s.personagem.fase !== 'CANDIDATO') {
    const taxa = s.personagem.fase === 'MANDATO' ? 0.6 : 1.6;
    for (const t of Object.values(s.territorio.porBairro)) {
      if (t.presenca > 8) t.presenca = Math.max(8, t.presenca - taxa);
      // penetração (voto firme) é mais resistente
      if (t.penetracao > 4) t.penetracao = Math.max(4, t.penetracao - taxa * 0.35);
    }
  }

  // --- Reputação: eco midiático decai; notoriedade regride a um piso ---
  s.reputacao.ecoMidiatico = +(
    s.reputacao.ecoMidiatico * balance.reputacao.decaimentoEcoMidiaticoMensal
  ).toFixed(2);
  if (Math.abs(s.reputacao.ecoMidiatico) < 0.3) s.reputacao.ecoMidiatico = 0;

  // Fase 33 — o piso de notoriedade que os seguidores sustentam tem retorno
  // decrescente (500 mil seguidores não te deixam eternamente famoso), e a
  // notoriedade regride mais rápido quando você some do noticiário.
  // Prioridade 3 — piso de notoriedade: atributo + seguidores + CARGO (quem
  // ocupa um cargo eletivo não é esquecido enquanto está lá).
  const PISO_CARGO = { VEREADOR: 12, DEPUTADO_ESTADUAL: 22, DEPUTADO_FEDERAL: 30, PREFEITO: 34, GOVERNADOR: 42, SENADOR: 44, PRESIDENTE: 60 };
  const pisoNotoriedade = clamp(
    3 + Math.round(s.personagem.atributos.popularidade / 12)
      + Math.min(24, Math.round(Math.log10(1 + s.redes.seguidores / 1000) * 8))
      + (PISO_CARGO[s.personagem.cargoAtual] || 0),
    0, 100,
  );
  // Item 8 — regressão PROPORCIONAL (menos oscilação): notoriedade alta escorre
  // devagar, notoriedade perto do piso quase não se mexe. Sem quedas bruscas.
  if (s.reputacao.notoriedade > pisoNotoriedade) {
    const excessoNoto = s.reputacao.notoriedade - pisoNotoriedade;
    s.reputacao.notoriedade = Math.max(pisoNotoriedade, s.reputacao.notoriedade - (0.45 + excessoNoto * 0.05));
  }

  // Rejeição também não é permanente: esfria em direção a um piso, mais rápido
  // com honestidade percebida alta, confiança acumulada, e sem eco negativo pendente.
  // Item 22 — confiança (que só era escrita, nunca lida) agora tem consequência real:
  // quem construiu confiança é perdoado mais rápido quando erra.
  const pisoRejeicao = clamp(
    6 + (55 - s.personagem.atributos.honestidadePercebida) / 8
      - (s.reputacao.confianca - 40) / 32
      + Math.max(0, -s.reputacao.ecoMidiatico) / 8,
    3, 45,
  );
  if (s.reputacao.rejeicao > pisoRejeicao) {
    // decai mais rápido quanto mais longe do piso (não deixa disparar)
    const excesso = s.reputacao.rejeicao - pisoRejeicao;
    const taxa = 2.4 + excesso * 0.12 + (s.personagem.atributos.honestidadePercebida - 50) / 40 + (s.reputacao.confianca - 40) / 130;
    s.reputacao.rejeicao = Math.max(pisoRejeicao, s.reputacao.rejeicao - Math.max(1, taxa));
  }

  // --- Redes: crescimento/erosão orgânica ---
  const fatorNoto = (s.reputacao.notoriedade - 20) / 100;
  const fatorEng = (s.redes.engajamento - 0.03) * 8;
  const crescPct = clamp(fatorNoto * 0.03 + fatorEng * 0.02 + rng.range([-0.015, 0.015]), -0.05, 0.08);
  const delta = Math.round(s.redes.seguidores * crescPct);
  s.redes.seguidores = Math.max(0, s.redes.seguidores + delta);
  s.redes.crescimentoMensal = delta;
  s.redes.alcanceMedio = Math.round(
    s.redes.seguidores * (0.12 + s.redes.engajamento + Math.max(0, s.reputacao.ecoMidiatico) / 100),
  );

  // --- Série histórica p/ aba Pesquisas ---
  s.series = s.series || [];
  s.series.push({
    mes,
    aprovacao: Math.round(s.reputacao.aprovacao),
    rejeicao: Math.round(s.reputacao.rejeicao),
    notoriedade: Math.round(s.reputacao.notoriedade),
    seguidores: s.redes.seguidores,
    intencaoVoto: s.eleicao?.jogadorVotosHist?.at(-1) ?? null,
  });
  s.series = s.series.slice(-120);

  // --- Log do mês ---
  s.log.unshift({
    mes,
    tipo: 'MES',
    texto: `${nomeMes(mes)}/${anoAtual} — saldo pessoal ${saldoMes >= 0 ? '+' : ''}${formatBRL(saldoMes)}, seguidores ${delta >= 0 ? '+' : ''}${delta}.`,
  });
  s.log = s.log.slice(0, 200);

  for (const ev of eventos) {
    s.log.unshift({ mes, tipo: ev.tipo, texto: ev.texto });
  }

  s.meta.rngState = rng.state;
  s.meta.salvoEm = new Date().toISOString();
  return { state: s, eventos };
}

export function nomeMes(mesesDecorridos) {
  const nomes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return nomes[mesesDecorridos % 12];
}

export function formatBRL(v) {
  const n = Math.round(v);
  return `R$ ${n.toLocaleString('pt-BR')}`;
}
