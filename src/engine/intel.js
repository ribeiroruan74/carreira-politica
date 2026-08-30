import neighborhoods from '../content/neighborhoods/recife.json';
import electorateDef from '../content/electorate.json';
import partiesDef from '../content/parties.json';
import { riscosAbertos } from './worldMemory';
import { cascatasAtivas } from './cascade';
import { resumoSatisfacao } from './electorate';
import { eventoNacionalAtual, rotuloClima, climaNacional } from './national';
import { exposicaoDoadores, doadoresResumo } from './donors';
import { imagemResumo } from './image';
import { influenciadoresDisponiveis } from './influencers';

const BAIRROS = neighborhoods.bairros;
const GRUPOS = electorateDef.grupos;
const P = (id) => partiesDef.partidos.find((x) => x.id === id);

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
