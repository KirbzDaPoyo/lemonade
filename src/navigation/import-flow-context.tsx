import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useMemo,
  useReducer
} from 'react';

import type { DraftPlaceEntry, PlaceCandidate } from '../types/place';

export type ImportFlowState = {
  requestId: number;
  active?: boolean;
  initialInstagramUrl?: string;
  inboxItem?: import('../types/inbox').InboxItem;
  draft?: DraftPlaceEntry;
  candidates: PlaceCandidate[];
};

export type ImportFlowAction =
  | { type: 'begin-manual' }
  | { type: 'set-active'; active: boolean }
  | { type: 'begin-inbox'; item: import('../types/inbox').InboxItem }
  | { type: 'begin-share'; instagramUrl: string }
  | {
      type: 'show-candidates';
      draft: DraftPlaceEntry;
      candidates: PlaceCandidate[];
    };

export const initialImportFlowState: ImportFlowState = {
  requestId: 0,
  candidates: []
};

export const reduceImportFlow = (
  state: ImportFlowState,
  action: ImportFlowAction
): ImportFlowState => {
  if (action.type === 'set-active') return { ...state, active: action.active };
  if (action.type === 'begin-inbox') return { requestId: state.requestId + 1, initialInstagramUrl: action.item.sourceUrl, inboxItem: action.item, candidates: [] };
  if (action.type === 'begin-manual') {
    return {
      requestId: state.requestId + 1,
      candidates: []
    };
  }

  if (action.type === 'begin-share') {
    return {
      requestId: state.requestId + 1,
      initialInstagramUrl: action.instagramUrl,
      candidates: []
    };
  }

  return {
    ...state,
    draft: action.draft,
    candidates: action.candidates
  };
};

type ImportFlowContextValue = ImportFlowState & {
  beginInboxAdd: (item: import('../types/inbox').InboxItem) => void;
  setActive: (active: boolean) => void;
  beginManualAdd: () => void;
  beginSharedAdd: (instagramUrl: string) => void;
  showCandidates: (
    draft: DraftPlaceEntry,
    candidates: PlaceCandidate[]
  ) => void;
};

const ImportFlowContext = createContext<ImportFlowContextValue | undefined>(
  undefined
);

export function ImportFlowProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(
    reduceImportFlow,
    initialImportFlowState
  );

  const setActive = useCallback((active: boolean) => dispatch({ type: 'set-active', active }), []);
  const beginInboxAdd = useCallback((item: import('../types/inbox').InboxItem) => dispatch({ type: 'begin-inbox', item }), []);
  const beginManualAdd = useCallback(() => {
    dispatch({ type: 'begin-manual' });
  }, []);

  const beginSharedAdd = useCallback((instagramUrl: string) => {
    dispatch({ type: 'begin-share', instagramUrl });
  }, []);

  const showCandidates = useCallback(
    (draft: DraftPlaceEntry, candidates: PlaceCandidate[]) => {
      dispatch({ type: 'show-candidates', draft, candidates });
    },
    []
  );

  const value = useMemo<ImportFlowContextValue>(
    () => ({
      ...state,
      setActive,
      beginInboxAdd,
      beginManualAdd,
      beginSharedAdd,
      showCandidates
    }),
    [setActive, beginInboxAdd, beginManualAdd, beginSharedAdd, showCandidates, state]
  );

  return (
    <ImportFlowContext.Provider value={value}>
      {children}
    </ImportFlowContext.Provider>
  );
}

export function useImportFlow() {
  const context = useContext(ImportFlowContext);

  if (!context) {
    throw new Error('useImportFlow must be used within ImportFlowProvider');
  }

  return context;
}
