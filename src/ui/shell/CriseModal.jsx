import { useState } from 'react';
import { useGame } from '../../state/store';

const CAT_LABEL = {
  CIDADE: 'Crise na cidade', IMPRENSA: 'Imprensa', PESSOAL: 'Vida pessoal',
  GABINETE: 'Gabinete', POLITICA: 'Política', MANDATO: 'Mandato',
  REDES: 'Redes sociais', CANDIDATO: 'Campanha', BASTIDORES: 'Bastidores',
};

export default function CriseModal() {
  const ev = useGame((g) => g.estado?.eventoPendente);
  const resolver = useGame((g) => g.resolverEventoAtual);
  const [escolhendo, setEscolhendo] = useState(false);

  if (!ev) return null;

  function escolher(i) {
    setEscolhendo(true);
    resolver(i);
    setEscolhendo(false);
  }

  return (
    <div className="overlay">
      <div className="modal" style={{ maxWidth: 520 }}>
        <p className="eyebrow">{CAT_LABEL[ev.cat] || 'Acontecimento'}</p>
        <h2 style={{ marginBottom: 8 }}>{ev.titulo}</h2>
        <p className="small dim" style={{ marginBottom: 16 }}>{ev.contexto}</p>
        <div className="stack" style={{ gap: 8 }}>
          {ev.opcoes.map((o, i) => (
            <button key={i} className="btn ghost" style={{ textAlign: 'left', justifyContent: 'flex-start' }}
              disabled={escolhendo} onClick={() => escolher(i)}>
              {o.texto}
            </button>
          ))}
        </div>
        <p className="small faint" style={{ marginTop: 14 }}>
          Toda escolha tem custo, benefício e risco — e algumas voltam a te cobrar mais adiante.
        </p>
      </div>
    </div>
  );
}
