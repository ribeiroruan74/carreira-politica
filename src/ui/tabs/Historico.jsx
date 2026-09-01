import { useState } from 'react';
import { useGame } from '../../state/store';
import { Card, PageHead } from '../components/primitives';
import { formatBRL, nomeMes } from '../../engine/tick';

const FILTROS = [
  { id: 'TODOS', nome: 'Tudo' },
  { id: 'ACAO', nome: 'Ações' },
  { id: 'MES', nome: 'Meses' },
  { id: 'ALERTA', nome: 'Alertas' },
  { id: 'RELACIONAMENTO', nome: 'Relações' },
];

export default function Historico() {
  const s = useGame((g) => g.estado);
  const [filtro, setFiltro] = useState('TODOS');
  const p = s.personagem;

  const itens = s.log.filter((l) => filtro === 'TODOS' || l.tipo === filtro);
  const traj = [...p.historicoProfissional, ...p.historicoPolitico].sort((a, b) => a.mes - b.mes);

  return (
    <div className="stack">
      <PageHead eyebrow="Carreira & histórico" title="Sua trajetória" />

      <Card title="Situação profissional">
        {p.cargoAtual && p.cargoAtual !== 'NENHUM' ? (
          <p className="small dim">Mandato em exercício — subsídio de {formatBRL(s.financas.rendaMensal)}/mês.{p.emprego && !p.licenciado ? ` Mantém ${p.emprego.titulo} em meio período.` : ''}</p>
        ) : p.emprego ? (
          <>
            <div className="row"><span className="grow name">{p.emprego.titulo}</span><span className="faint small">{p.emprego.setor}</span></div>
            <div className="row"><span className="grow">Salário{p.licenciado ? ' (licenciado)' : ''}</span><span className="num">{formatBRL(s.financas.rendaMensal)}</span></div>
            <div className="row"><span className="grow">Horas / mês</span><span className="num">{p.licenciado ? 0 : p.emprego.horas}</span></div>
          </>
        ) : <p className="small dim">Sem emprego no momento.</p>}
      </Card>

      {traj.length > 0 && (
        <Card title="Marcos">
          {traj.map((h, i) => (
            <div key={i} className="log-item"><span className="when">mês {h.mes}</span><span className="txt">{h.texto}</span></div>
          ))}
        </Card>
      )}

      <Card title="Registro">
        <div className="chips" style={{ marginBottom: 10 }}>
          {FILTROS.map((f) => (
            <button key={f.id} className={`btn sm ${filtro === f.id ? '' : 'ghost'}`} onClick={() => setFiltro(f.id)}>{f.nome}</button>
          ))}
        </div>
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
