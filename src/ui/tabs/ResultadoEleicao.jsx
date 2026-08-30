import { useGame } from '../../state/store';
import { encerrarEleicao } from '../../engine/election';
import { corPartido } from '../../engine/voteModel';

export default function ResultadoEleicao({ irPara }) {
  const s = useGame((g) => g.estado);
  const aplicar = useGame((g) => g.aplicar);
  const el = s.eleicao;
  const r = el?.resultado;
  if (!r) return null;

  const majoritario = r.sistema === 'MAJORITARIO';
  const top = r.ranking.slice(0, majoritario ? 8 : 12);
  const jogador = r.ranking.find((x) => x.jogador);
  const foraDoTop = jogador && !top.includes(jogador);
  const cargoNome = el.cargoNome || 'vereador(a)';

  let titulo;
  if (r.eleito) titulo = `🎉 Eleito(a) ${cargoNome}`;
  else if (r.segundoTurnoEntre) titulo = 'Você ficou fora do 2º turno';
  else titulo = 'Não eleito(a) desta vez';

  function continuar() {
    aplicar((st) => encerrarEleicao(st));
    irPara('dashboard');
  }

  return (
    <div className="overlay">
      <div className="modal" style={{ maxWidth: 560 }}>
        <p className="eyebrow">Apuração · {cargoNome} · {el.circunscricaoNome || el.cidade}</p>
        <h2 style={{ marginBottom: 4 }}>{titulo}</h2>
        <p className="small dim" style={{ marginBottom: 14 }}>
          {majoritario
            ? `${jogador.votos.toLocaleString('pt-BR')} votos · ${r.pctJogador}% dos válidos · ${r.posicaoJogador}º lugar`
            : `${jogador.votos.toLocaleString('pt-BR')} votos · ${r.posicaoJogador}º lugar geral · quociente eleitoral ${r.quociente.toLocaleString('pt-BR')}`}
          {r.segundoTurnoEntre && ` · o 2º turno será entre ${r.segundoTurnoEntre.join(' e ')}.`}
          {!r.eleito && !r.segundoTurnoEntre && ' · você continua filiado e pode disputar o próximo pleito.'}
        </p>

        <div style={{ maxHeight: 300, overflowY: 'auto', margin: '0 -4px' }}>
          {top.map((c, i) => (
            <div key={c.id} className="row" style={{
              padding: '7px 4px',
              background: c.jogador ? 'var(--accent-soft)' : undefined,
              borderRadius: c.jogador ? 6 : 0,
            }}>
              <span className="faint mono" style={{ width: 22 }}>{i + 1}</span>
              <span className="grow name small">
                {c.nome} <span className="pill" style={{ borderColor: corPartido(c.partidoId), color: corPartido(c.partidoId) }}>{c.partidoId}</span>
                {c.eleito && <span className="pill accent">eleito</span>}
              </span>
              <span className="num small">
                {majoritario ? `${c.pct}%` : c.votos.toLocaleString('pt-BR')}
              </span>
            </div>
          ))}
          {foraDoTop && (
            <div className="row" style={{ padding: '7px 4px', background: 'var(--accent-soft)', borderRadius: 6, marginTop: 4 }}>
              <span className="faint mono" style={{ width: 22 }}>{r.posicaoJogador}</span>
              <span className="grow name small">{jogador.nome} <span className="pill">{jogador.partidoId}</span></span>
              <span className="num small">{majoritario ? `${r.pctJogador}%` : jogador.votos.toLocaleString('pt-BR')}</span>
            </div>
          )}
        </div>

        <p className="small faint" style={{ margin: '12px 0' }}>
          {majoritario
            ? (r.eleito ? 'Você assume o Executivo.' : r.vencedorNome ? `${r.vencedorNome} venceu a eleição.` : 'A disputa vai para o 2º turno.')
            : `${r.cadeiras} cadeiras distribuídas · ${r.partidosSemCadeira.length} partidos não atingiram o quociente.`}
        </p>

        <button className="btn block" onClick={continuar}>
          {r.eleito ? 'Assumir o mandato' : 'Seguir em frente'}
        </button>
      </div>
    </div>
  );
}
