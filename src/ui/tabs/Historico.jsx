import { useState } from 'react';
import { useGame } from '../../state/store';
import { Card, PageHead } from '../components/primitives';
import { nomeMes } from '../../engine/tick';

const FILTROS = [
  { id: 'TODOS', nome: 'Tudo' },
  { id: 'ACAO', nome: 'Ações' },
  { id: 'MES', nome: 'Meses' },
  { id: 'ALERTA', nome: 'Alertas' },
  { id: 'RELACIONAMENTO', nome: 'Relacionamentos' },
];

export default function Historico() {
  const s = useGame((g) => g.estado);
  const [filtro, setFiltro] = useState('TODOS');

  const itens = s.log.filter((l) => filtro === 'TODOS' || l.tipo === filtro);

  return (
    <div className="stack">
      <PageHead eyebrow="Histórico" title="Tudo que aconteceu">
        O mundo lembra. O que você fez — e não fez — pode voltar mais adiante.
      </PageHead>

      <Card>
        <div className="chips">
          {FILTROS.map((f) => (
            <button key={f.id} className={`btn sm ${filtro === f.id ? '' : 'ghost'}`} onClick={() => setFiltro(f.id)}>{f.nome}</button>
          ))}
        </div>
      </Card>

      <Card>
        {itens.map((l, i) => (
          <div key={i} className={`log-item ${l.tipo}`}>
            <span className="when">{nomeMes(l.mes)}/{s.tempo.anoInicial + Math.floor(l.mes / 12)}</span>
            <span className="txt">{l.texto}</span>
          </div>
        ))}
        {itens.length === 0 && <p className="dim small">Nada registrado neste filtro ainda.</p>}
      </Card>
    </div>
  );
}
