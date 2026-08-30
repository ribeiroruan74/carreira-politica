// Fase 27 — conquistas.
// Cada conquista tem uma condição pura sobre o estado. checarConquistas() roda
// todo mês, desbloqueia as novas e vira MARCO + evento. Guardadas em
// state.conquistas.desbloqueadas = { id: mes }.

import { registrarMarco } from './milestones';

function totalMilitantes(s) {
  return Object.values(s.personagem?.militancia || {}).reduce((a, n) => a + n, 0);
}
function grupoMax(s) {
  const v = Object.values(s.mundo?.satisfacaoGrupos || {});
  return v.length ? Math.max(...v) : 0;
}
function grupoMin(s) {
  const v = Object.values(s.mundo?.satisfacaoGrupos || {});
  return v.length ? Math.min(...v) : 0;
}

export const CONQUISTAS = [
  // carreira
  { id: 'vida_publica', nome: 'Saiu do anonimato', desc: 'Entrou na vida pública.', icone: '🌱', grupo: 'Carreira', cond: (s) => s.personagem.fase !== 'VIDA' },
  { id: 'filiado', nome: 'Tem legenda', desc: 'Filiou-se a um partido.', icone: '🪪', grupo: 'Carreira', cond: (s) => !!s.personagem.partidoId },
  { id: 'primeiro_mandato', nome: 'Eleito(a)', desc: 'Conquistou seu primeiro mandato.', icone: '🏛️', grupo: 'Carreira', cond: (s) => (s.personagem.mandatosExercidos || []).length >= 1 },
  { id: 'prefeito', nome: 'Chefe do Executivo', desc: 'Elegeu-se prefeito(a).', icone: '🏙️', grupo: 'Carreira', cond: (s) => (s.personagem.mandatosExercidos || []).includes('PREFEITO') },
  { id: 'deputado', nome: 'Foi para o parlamento', desc: 'Elegeu-se deputado(a).', icone: '⚖️', grupo: 'Carreira', cond: (s) => (s.personagem.mandatosExercidos || []).some((c) => c.startsWith('DEPUTADO')) },
  { id: 'reeleito', nome: 'O eleitor renovou', desc: 'Foi reeleito(a) para o mesmo cargo.', icone: '🔁', grupo: 'Carreira', cond: (s) => (s.personagem.historicoPolitico || []).filter((h) => /Eleito|reeleiç/i.test(h.texto)).length >= 2 },
  { id: 'multi_cargo', nome: 'Currículo diverso', desc: 'Exerceu dois cargos eletivos diferentes.', icone: '🎖️', grupo: 'Carreira', cond: (s) => new Set(s.personagem.mandatosExercidos || []).size >= 2 },

  // território / base
  { id: 'reduto', nome: 'Dono do pedaço', desc: 'Presença acima de 70 num bairro.', icone: '📍', grupo: 'Base', cond: (s) => Object.values(s.territorio.porBairro).some((t) => t.presenca >= 70) },
  { id: 'capilaridade', nome: 'Capilaridade', desc: 'Presença em 10+ bairros.', icone: '🗺️', grupo: 'Base', cond: (s) => Object.values(s.territorio.porBairro).filter((t) => t.presenca > 5).length >= 10 },
  { id: 'militancia_forte', nome: 'Tem quem carregue bandeira', desc: '80+ voluntários de militância.', icone: '🚩', grupo: 'Base', cond: (s) => totalMilitantes(s) >= 80 },

  // mídia / imagem
  { id: 'viral', nome: 'Viralizou', desc: 'Um conteúdo seu explodiu na rede.', icone: '🚀', grupo: 'Mídia', cond: (s) => (s.log || []).some((l) => /viralizou/i.test(l.texto)) },
  { id: 'cem_mil', nome: '100 mil', desc: '100 mil seguidores.', icone: '📈', grupo: 'Mídia', cond: (s) => s.redes.seguidores >= 100000 },
  { id: 'meio_milhao', nome: 'Fenômeno de rede', desc: '500 mil seguidores.', icone: '🌟', grupo: 'Mídia', cond: (s) => s.redes.seguidores >= 500000 },
  { id: 'imagem_forte', nome: 'Marca registrada', desc: 'Um traço de imagem acima de 75.', icone: '🎭', grupo: 'Mídia', cond: (s) => Object.values(s.personagem.imagem || {}).some((v) => v >= 75) },
  { id: 'querido', nome: 'Queridinho(a) de um nicho', desc: 'Um grupo social com satisfação +50.', icone: '💚', grupo: 'Mídia', cond: (s) => grupoMax(s) >= 50 },

  // reputação
  { id: 'aprovacao_alta', nome: 'Nas alturas', desc: 'Aprovação acima de 70%.', icone: '☀️', grupo: 'Reputação', cond: (s) => s.reputacao.aprovacao >= 70 },
  { id: 'conhecido', nome: 'Todo mundo te conhece', desc: 'Notoriedade acima de 70.', icone: '📣', grupo: 'Reputação', cond: (s) => s.reputacao.notoriedade >= 70 },
  { id: 'polarizador', nome: 'Ame ou odeie', desc: 'Aprovação 55+ e rejeição 40+ ao mesmo tempo.', icone: '⚡', grupo: 'Reputação', cond: (s) => s.reputacao.aprovacao >= 55 && s.reputacao.rejeicao >= 40 },

  // mandato
  { id: 'legislador', nome: 'Faz lei', desc: '5 projetos aprovados num mandato.', icone: '📜', grupo: 'Mandato', cond: (s) => (s.mandato?.indicadores?.projetosAprovados || 0) >= 5 },
  { id: 'fiscal', nome: 'Xerife do dinheiro público', desc: '10 fiscalizações.', icone: '🔎', grupo: 'Mandato', cond: (s) => (s.mandato?.indicadores?.fiscalizacoes || 0) >= 10 },
  { id: 'palavra_cumprida', nome: 'Palavra é palavra', desc: '5 promessas cumpridas.', icone: '🤝', grupo: 'Mandato', cond: (s) => (s.mandato?.promessas || []).filter((p) => p.cumprida).length >= 5 },
  { id: 'presidente_comissao', nome: 'Bate o martelo', desc: 'Presidiu uma comissão.', icone: '🪑', grupo: 'Mandato', cond: (s) => !!s.mandato?.comissoes?.presidindo },
  { id: 'dono_diretorio', nome: 'Manda no partido', desc: 'Presidiu o diretório municipal.', icone: '👑', grupo: 'Mandato', cond: (s) => Object.values(s.mundo.partidosRuntime || {}).some((pr) => pr.diretorioDoJogador) },

  // dinheiro / influência
  { id: 'caixa_cheio', nome: 'Campanha bancada', desc: 'R$ 300 mil em caixa de campanha.', icone: '💰', grupo: 'Recursos', cond: (s) => s.financas.campanha >= 300000 },
  { id: 'rede_de_influencia', nome: 'Padrinho digital', desc: 'Contratou um influenciador.', icone: '📱', grupo: 'Recursos', cond: (s) => (s.mundo.influenciadores || []).some((i) => i.aliadoDe === 'JOGADOR') },

  // adversidade
  { id: 'sobreviveu_crise', nome: 'Aguentou o tranco', desc: 'Conteve uma cascata de repercussão.', icone: '🛡️', grupo: 'Adversidade', cond: (s) => (s.log || []).some((l) => /reduziu o estrago|respondeu à repercussão/i.test(l.texto)) },
  { id: 'inimigo_publico', nome: 'Colecionador de desafetos', desc: 'Um grupo social com satisfação -40.', icone: '🔥', grupo: 'Adversidade', cond: (s) => grupoMin(s) <= -40 },
];

export function checarConquistas(s) {
  s.conquistas ||= { desbloqueadas: {} };
  const desb = s.conquistas.desbloqueadas;
  const eventos = [];
  for (const c of CONQUISTAS) {
    if (desb[c.id]) continue;
    let ok = false;
    try { ok = !!c.cond(s); } catch { ok = false; }
    if (!ok) continue;
    desb[c.id] = s.tempo.mes;
    registrarMarco(s, 'CONQUISTA', `Conquista: ${c.nome}`);
    eventos.push({ tipo: 'MARCO', texto: `🏆 Conquista desbloqueada: ${c.icone} ${c.nome} — ${c.desc}` });
  }
  return { eventos };
}

export function conquistasResumo(s) {
  const desb = s.conquistas?.desbloqueadas || {};
  const grupos = {};
  for (const c of CONQUISTAS) {
    (grupos[c.grupo] ||= []).push({ ...c, mes: desb[c.id] ?? null, feita: !!desb[c.id] });
  }
  return {
    total: CONQUISTAS.length,
    feitas: Object.keys(desb).length,
    grupos,
  };
}
