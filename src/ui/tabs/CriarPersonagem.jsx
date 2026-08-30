import { useState } from 'react';
import { useGame } from '../../state/store';
import professionsDef from '../../content/professions.json';
import attributesDef from '../../content/attributes.json';
import { cidadesDisponiveis } from '../../engine/offices';
import { Card, Pill } from '../components/primitives';

const CIDADES = cidadesDisponiveis();

const DIFICULDADES = [
  { id: 'FACIL', nome: 'Fácil', desc: 'Mais capital e renda. Para conhecer os sistemas.' },
  { id: 'NORMAL', nome: 'Normal', desc: 'Equilíbrio pretendido do jogo.' },
  { id: 'DIFICIL', nome: 'Difícil', desc: 'Pouco dinheiro, tudo custa mais. Carreira instável.' },
];

export default function CriarPersonagem() {
  const iniciar = useGame((g) => g.iniciarPartida);
  const importar = useGame((g) => g.importar);

  const [nome, setNome] = useState('');
  const [idade, setIdade] = useState(30);
  const [profissaoId, setProfissaoId] = useState(professionsDef.profissoes[0].id);
  const [traçoId, setTraçoId] = useState('');
  const [dificuldade, setDificuldade] = useState('NORMAL');
  const [cidade, setCidade] = useState(CIDADES[0].id);
  const [seed, setSeed] = useState('');
  const [erro, setErro] = useState(null);

  const prof = professionsDef.profissoes.find((p) => p.id === profissaoId);
  const traço = attributesDef.traços.find((t) => t.id === traçoId);

  function criar() {
    if (!nome.trim()) { setErro('Dê um nome ao seu personagem.'); return; }
    iniciar({ nome, idade: Number(idade), profissaoId, traçoId: traçoId || null, cidade, dificuldade, seed: seed || undefined });
  }

  function carregarArquivo(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (!importar(reader.result)) setErro('Arquivo de save inválido.');
    };
    reader.readAsText(file);
  }

  return (
    <div className="app-main" style={{ maxWidth: 720, margin: '0 auto' }}>
      <p className="eyebrow">Carreira Política</p>
      <h1 style={{ marginBottom: 8 }}>Crie uma pessoa. Construa uma carreira.</h1>
      <p className="dim" style={{ marginBottom: 22 }}>
        Você não começa político. Começa com uma profissão, uma rede e um nome quase
        desconhecido — e decide como chegar à Câmara do Recife.
      </p>

      <Card>
        <div className="field-row two">
          <div>
            <label>Nome do personagem</label>
            <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Marina Tavares" />
          </div>
          <div>
            <label>Idade</label>
            <input type="number" min="18" max="70" value={idade} onChange={(e) => setIdade(e.target.value)} />
          </div>
        </div>

        <label>Profissão</label>
        <select value={profissaoId} onChange={(e) => setProfissaoId(e.target.value)}>
          {professionsDef.profissoes.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
        </select>
        <p className="small dim" style={{ marginTop: 6 }}>{prof.descricao}</p>
        <div className="chips" style={{ marginTop: 8 }}>
          {Object.entries(prof.atributos || {}).map(([k, v]) => (
            <Pill key={k} tone={v > 0 ? 'accent' : 'red'}>
              {(attributesDef.atributos.find((a) => a.id === k)?.nome || k)} {v > 0 ? '+' : ''}{v}
            </Pill>
          ))}
        </div>

        <label>Traço de personalidade (opcional)</label>
        <select value={traçoId} onChange={(e) => setTraçoId(e.target.value)}>
          <option value="">Nenhum traço marcante</option>
          {attributesDef.traços.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
        </select>
        {traço && (
          <div className="chips" style={{ marginTop: 8 }}>
            {Object.entries(traço.atributos).map(([k, v]) => (
              <Pill key={k} tone={v > 0 ? 'accent' : 'red'}>
                {(attributesDef.atributos.find((a) => a.id === k)?.nome || k)} {v > 0 ? '+' : ''}{v}
              </Pill>
            ))}
          </div>
        )}

        <label>Cidade</label>
        <select value={cidade} onChange={(e) => setCidade(e.target.value)}>
          {CIDADES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome} — {(c.populacao / 1000).toFixed(0)} mil hab., {c.bairros} bairros
            </option>
          ))}
        </select>
        <p className="small dim" style={{ marginTop: 6 }}>
          Onde sua carreira começa. Recife elege 39 vereadores; Olinda, 21. A eleição a
          prefeito e a deputado é disputada a partir da mesma base.
        </p>

        <label>Dificuldade</label>
        <div className="chips">
          {DIFICULDADES.map((d) => (
            <button
              key={d.id}
              className={`btn sm ${dificuldade === d.id ? '' : 'ghost'}`}
              onClick={() => setDificuldade(d.id)}
            >{d.nome}</button>
          ))}
        </div>
        <p className="small dim" style={{ marginTop: 6 }}>
          {DIFICULDADES.find((d) => d.id === dificuldade).desc}
        </p>

        <label>Semente (opcional — mesma semente, mesma partida)</label>
        <input value={seed} onChange={(e) => setSeed(e.target.value)} placeholder="deixe em branco para aleatória" />

        {erro && <p style={{ color: 'var(--red)' }} className="small">{erro}</p>}

        <hr className="hr" />
        <button className="btn block" onClick={criar}>Começar a carreira</button>
        <label style={{ marginTop: 16 }}>Ou carregue um save exportado</label>
        <input type="file" accept="application/json" onChange={carregarArquivo} />
      </Card>
    </div>
  );
}
