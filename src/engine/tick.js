import { createRng, clamp } from './rng';
import balance from '../content/balance.json';
import { sincronizarRenda, horasEmprego } from './jobs';

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
  const horas = horasEmprego(s);
  s.tempo.pontosRestantes = Math.max(2, s.tempo.pontosPorMes - horas);
  const recupEnergia = balance.tempo.energiaRecuperaPorMes
    + Math.round((s.personagem.atributos.disciplina - 50) / 8);
  s.tempo.energia = clamp(s.tempo.energia + recupEnergia, 0, s.tempo.energiaMax);

  // --- Finanças mensais ---
  const saldoMes = s.financas.rendaMensal - s.financas.custoVidaMensal;
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
  for (const p of Object.values(s.relacionamentos.pessoas)) {
    const mesesSemContato = mes - (p.ultimoContatoMes ?? 0);
    if (mesesSemContato >= 2) {
      p.confianca = clamp(
        p.confianca - balance.relacionamentos.decaimentoMensalSemContato,
        0, 100,
      );
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

  const pisoNotoriedade = clamp(
    3 + Math.round(s.personagem.atributos.popularidade / 12)
      + Math.round(s.redes.seguidores / 20000),
    0, 100,
  );
  if (s.reputacao.notoriedade > pisoNotoriedade) {
    s.reputacao.notoriedade = Math.max(
      pisoNotoriedade,
      s.reputacao.notoriedade - 1.5,
    );
  }

  // Rejeição também não é permanente: esfria em direção a um piso, mais rápido
  // com honestidade percebida alta e sem eco negativo pendente.
  const pisoRejeicao = clamp(
    6 + (55 - s.personagem.atributos.honestidadePercebida) / 8
      + Math.max(0, -s.reputacao.ecoMidiatico) / 8,
    3, 45,
  );
  if (s.reputacao.rejeicao > pisoRejeicao) {
    // decai mais rápido quanto mais longe do piso (não deixa disparar)
    const excesso = s.reputacao.rejeicao - pisoRejeicao;
    const taxa = 2.4 + excesso * 0.12 + (s.personagem.atributos.honestidadePercebida - 50) / 40;
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
