// Fase 22 — vida pessoal (leve).
// personagem.vida = { estadoCivil, conjuge, filhos, hobby, saude }.
// A saúde acompanha o ritmo de trabalho e limita a energia máxima. De tempos em
// tempos a vida pessoal manda um recado — para o bem ou para o mal.

import { streamRng, clamp } from './rng';

const HOBBIES = ['corrida', 'música', 'culinária', 'leitura', 'futebol', 'jardinagem', 'pesca', 'cinema'];

export function estadoVida(state) {
  return state.personagem.vida || { estadoCivil: 'solteiro', conjuge: null, filhos: 0, hobby: null, saude: 100 };
}

export function cuidarDeSi(state, rng) {
  const v = (state.personagem.vida ||= estadoVida(state));
  v.saude = clamp(v.saude + rng.range([8, 16]), 0, 100);
  state.tempo.energia = clamp(state.tempo.energia + rng.range([6, 14]), 0, state.tempo.energiaMax);
  state.reputacao.rejeicao = clamp(state.reputacao.rejeicao - rng.range([0, 1]), 0, 100);
  if (!v.hobby && rng.chance(0.5)) {
    v.hobby = rng.pick(HOBBIES);
    return `Você tirou um tempo para si e reencontrou o gosto por ${v.hobby}. Saúde recuperada.`;
  }
  return 'Você desacelerou por uns dias. Saúde e energia recuperadas.';
}

export function tickVidaPessoal(s) {
  const eventos = [];
  const v = (s.personagem.vida ||= estadoVida(s));
  const rng = streamRng(s.meta.seed, 'vida', s.tempo.mes);

  // saúde segue o ritmo: mês puxado (pouca energia sobrando) desgasta;
  // folga recompõe. Idade pesa de leve.
  const folga = s.tempo.energia / Math.max(1, s.tempo.energiaMax);
  let dSaude = (folga - 0.5) * 6 - Math.max(0, s.personagem.idade - 45) * 0.05;
  if (v.hobby) dSaude += 0.6;
  v.saude = clamp(v.saude + dSaude, 15, 100);

  // energia máxima reflete a saúde (85..105)
  s.tempo.energiaMax = Math.round(clamp(85 + v.saude / 5, 70, 110));

  // alerta de saúde
  if (v.saude <= 30 && s.tempo.mes % 2 === 0) {
    eventos.push({ tipo: 'ALERTA', texto: `Sua saúde está no limite (${Math.round(v.saude)}). Considere desacelerar.` });
  }

  // eventos de vida — raros, só a partir de alguma estabilidade pública
  if (s.personagem.fase !== 'VIDA' && rng.chance(0.03)) {
    const ev = sortearEventoVida(s, v, rng);
    if (ev) {
      eventos.push({ tipo: ev.marco ? 'MARCO' : 'CIDADE', texto: ev.texto });
      s.log.unshift({ mes: s.tempo.mes, tipo: 'PESSOAL', texto: ev.texto });
    }
  }
  return { eventos };
}

function sortearEventoVida(s, v, rng) {
  const opcoes = [];
  if (v.estadoCivil === 'solteiro') {
    opcoes.push(() => {
      v.estadoCivil = 'casado';
      v.conjuge = { nome: rng.pick(['Ana', 'Bruno', 'Carla', 'Diego', 'Elena', 'Fábio', 'Lia', 'Rafa']), apoio: rng.int(55, 85) };
      s.reputacao.aprovacao = clamp(s.reputacao.aprovacao + rng.range([0, 2]), 0, 100);
      return { texto: `Você se casou com ${v.conjuge.nome}. A imagem de vida estável ajuda um pouco.`, marco: true };
    });
  } else if (v.estadoCivil === 'casado') {
    if (v.filhos < 3) {
      opcoes.push(() => {
        v.filhos += 1;
        s.tempo.energia = clamp(s.tempo.energia - 10, 0, s.tempo.energiaMax);
        return { texto: `Nasceu mais um filho. Noites mal dormidas — e uma foto de família que rende bem.`, marco: true };
      });
    }
    opcoes.push(() => {
      const q = rng.chance(0.5);
      if (q) { v.saude = clamp(v.saude - 8, 15, 100); return { texto: 'Uma crise em casa cobrou seu tempo e sua cabeça esta semana.' }; }
      s.tempo.energia = clamp(s.tempo.energia + 8, 0, s.tempo.energiaMax);
      return { texto: `Um fim de semana bom com a família recarregou as baterias.` };
    });
  }
  opcoes.push(() => {
    v.saude = clamp(v.saude - rng.range([6, 14]), 15, 100);
    s.tempo.energia = clamp(s.tempo.energia - rng.range([5, 12]), 0, s.tempo.energiaMax);
    return { texto: 'Um problema de saúde tirou você de circulação por alguns dias.' };
  });

  return rng.pick(opcoes)();
}
