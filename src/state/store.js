import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { get as idbGet, set as idbSet, del as idbDel } from 'idb-keyval';
import { migrar, SAVE_VERSION } from './schema';
import { novoJogo } from './newGame';
import { runMonth } from '../engine/runMonth';
import { resolverEvento } from '../engine/events';
import { montarEntrevista, responderPergunta } from '../engine/interview';

// Persistência em IndexedDB (funciona offline, sem servidor).
const idbStorage = {
  getItem: async (name) => (await idbGet(name)) ?? null,
  setItem: async (name, value) => idbSet(name, value),
  removeItem: async (name) => idbDel(name),
};

export const SAVE_KEY = 'carreira-politica-save-v1';

export const useGame = create(
  persist(
    (set, get) => ({
      // null = sem partida em andamento (mostra tela de criação)
      estado: null,
      _hidratado: false,
      ultimoTick: null, // eventos do último avanço de mês, para a UI mostrar

      iniciarPartida(opcoes) {
        set({ estado: novoJogo(opcoes), ultimoTick: null });
      },

      avancarMes() {
        const estado = get().estado;
        if (!estado) return;
        if (estado.eventoPendente) return; // resolva a crise antes de avançar
        const work = structuredClone(estado);
        const { eventos } = runMonth(work);
        set({ estado: work, ultimoTick: eventos });
      },

      dispensarDica(id) {
        const estado = get().estado;
        if (!estado) return;
        const vistas = estado.flags.dicasVistas || [];
        if (vistas.includes(id)) return;
        set({ estado: { ...estado, flags: { ...estado.flags, dicasVistas: [...vistas, id] } } });
      },

      resolverEventoAtual(opcaoIndex) {
        const estado = get().estado;
        if (!estado?.eventoPendente) return;
        const novo = structuredClone(estado);
        resolverEvento(novo, opcaoIndex);
        set({ estado: novo });
      },

      iniciarEntrevista(jornalistaId) {
        const estado = get().estado;
        if (!estado || estado.entrevistaAtiva) return;
        if (estado.tempo.pontosRestantes < 2) return;
        const novo = structuredClone(estado);
        novo.tempo.pontosRestantes -= 2;
        novo.tempo.energia = Math.max(0, novo.tempo.energia - 10);
        novo.entrevistaAtiva = montarEntrevista(novo, jornalistaId);
        set({ estado: novo, ultimoTick: null });
      },

      responderEntrevista(tomIdx) {
        const estado = get().estado;
        if (!estado?.entrevistaAtiva || estado.entrevistaAtiva.concluida) return null;
        const novo = structuredClone(estado);
        const r = responderPergunta(novo, tomIdx);
        set({ estado: novo });
        return r;
      },

      fecharEntrevista() {
        const estado = get().estado;
        if (!estado) return;
        set({ estado: { ...estado, entrevistaAtiva: null } });
      },

      // aplica uma mutação parcial ao estado (usado pelos sistemas de ação)
      aplicar(fn) {
        const estado = get().estado;
        if (!estado) return;
        const novo = structuredClone(estado);
        fn(novo);
        set({ estado: novo });
      },

      apagarPartida() {
        set({ estado: null, ultimoTick: null });
      },

      importar(json) {
        try {
          const parsed = typeof json === 'string' ? JSON.parse(json) : json;
          set({ estado: migrar(parsed), ultimoTick: null });
          return true;
        } catch {
          return false;
        }
      },

      exportar() {
        return JSON.stringify(get().estado, null, 2);
      },
    }),
    {
      name: SAVE_KEY,
      version: SAVE_VERSION,
      storage: createJSONStorage(() => idbStorage),
      partialize: (s) => ({ estado: s.estado }),
      migrate: (persisted) => {
        if (persisted?.estado) persisted.estado = migrar(persisted.estado);
        return persisted;
      },
      onRehydrateStorage: () => (state) => {
        // rede de segurança: mesmo quando a versão persistida == SAVE_VERSION
        // (o zustand pula `migrate`), garante que todo campo novo do schema
        // exista — deepMerge com o emptyState() não sobrescreve nada do save.
        if (state?.estado) state.estado = migrar(state.estado);
        useGame.setState({ _hidratado: true });
      },
    },
  ),
);

// seletores derivados
export const selFase = (s) => s.estado?.personagem.fase ?? null;

if (import.meta.env.DEV && typeof window !== 'undefined') {
  window.__game = useGame;
}
