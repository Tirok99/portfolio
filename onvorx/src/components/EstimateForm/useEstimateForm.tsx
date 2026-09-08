import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

interface EstimateFormValue {
  isOpen: boolean
  sourcePage?: string
  open: (sourcePage?: string) => void
  close: () => void
}

const Ctx = createContext<EstimateFormValue | null>(null)

export function EstimateFormProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ isOpen: boolean; sourcePage?: string }>({
    isOpen: false,
  })
  const open = useCallback(
    (sourcePage?: string) => setState({ isOpen: true, sourcePage }),
    [],
  )
  const close = useCallback(
    () => setState((s) => ({ isOpen: false, sourcePage: s.sourcePage })),
    [],
  )
  const value = useMemo<EstimateFormValue>(
    () => ({ isOpen: state.isOpen, sourcePage: state.sourcePage, open, close }),
    [state, open, close],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useEstimateForm(): EstimateFormValue {
  const ctx = useContext(Ctx)
  if (!ctx)
    throw new Error('useEstimateForm must be used within <EstimateFormProvider>')
  return ctx
}
