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
  initialInstagramUrl?: string;
  draft?: DraftPlaceEntry;
  candidates: PlaceCandidate[];
};

export type ImportFlowAction =
  | { type: 'begin-manual' }
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
      beginManualAdd,
      beginSharedAdd,
      showCandidates
    }),
    [beginManualAdd, beginSharedAdd, showCandidates, state]
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
