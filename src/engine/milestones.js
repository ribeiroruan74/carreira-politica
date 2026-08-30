// Fase 28 — marcos na linha do tempo.
// state.marcos[] guarda pontos notáveis da carreira para anotar nos gráficos
// (aba Pesquisas) e montar a biografia. Cada marco: { mes, tipo, texto }.

const TIPOS = ['CARREIRA', 'ELEICAO', 'MANDATO', 'MIDIA', 'CRISE', 'CONQUISTA'];

export function registrarMarco(state, tipo, texto) {
  state.marcos ||= [];
  const t = TIPOS.includes(tipo) ? tipo : 'CARREIRA';
  // dedup: mesmo mês + mesmo texto
  if (state.marcos.some((m) => m.mes === state.tempo.mes && m.texto === texto)) return;
  state.marcos.push({ mes: state.tempo.mes, tipo: t, texto });
  state.marcos = state.marcos.slice(-60);
}

export function marcosAte(state, mesMax) {
  return (state.marcos || []).filter((m) => m.mes <= (mesMax ?? Infinity));
}

// deriva marcos "automáticos" do log recente que ainda não estão anotados
// (chamado 1x/mês pelo tick, cobre eventos que não passam por registrarMarco)
const PADROES = [
  { re: /eleito\(a\)|APURAÇÃO: você foi eleito/i, tipo: 'ELEICAO' },
  { re: /não se elegeu|Não eleito/i, tipo: 'ELEICAO' },
  { re: /Mandato de .* iniciado|Mandato iniciado/i, tipo: 'MANDATO' },
  { re: /viralizou/i, tipo: 'MIDIA' },
  { re: /Filiação ao|Filiou-se/i, tipo: 'CARREIRA' },
  { re: /entrou na vida pública/i, tipo: 'CARREIRA' },
];

export function tickMarcos(s) {
  s.marcos ||= [];
  const recentes = (s.log || []).filter((l) => l.mes === s.tempo.mes && ['MARCO', 'CRISE'].includes(l.tipo));
  for (const l of recentes) {
    const hit = PADROES.find((p) => p.re.test(l.texto));
    if (!hit) continue;
    if (s.marcos.some((m) => m.mes === l.mes && m.texto === l.texto)) continue;
    s.marcos.push({ mes: l.mes, tipo: hit.tipo, texto: l.texto });
  }
  s.marcos = s.marcos.slice(-60);
  return { eventos: [] };
}
