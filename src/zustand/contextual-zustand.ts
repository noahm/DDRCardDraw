import {
  createContext,
  ReactNode,
  useContext,
  useState,
  createElement,
  useEffect,
} from "react";
import { StoreApi, useStore, createStore } from "zustand";

export function createContextualStore<
  StoreValue,
  ProviderProps extends { children?: ReactNode },
>(
  /** returns initial store state for given props */
  creator: (
    p: ProviderProps,
    set: StoreApi<StoreValue>["setState"],
    get: StoreApi<StoreValue>["getState"],
  ) => StoreValue,
  /** returns a unique id for a given set of props */
  getUniqueId: (p: ProviderProps) => string,
  globalProps: ProviderProps,
) {
  const globalStore = createStore(creator.bind(undefined, globalProps));
  const context = createContext(globalStore);
  const StoreIndex = new Map<string, StoreApi<StoreValue>>();

  const Provider = (props: ProviderProps) => {
    const [localStore] = useState(() =>
      createStore(creator.bind(undefined, props)),
    );
    useEffect(() => {
      const thisId = getUniqueId(props);
      StoreIndex.set(thisId, localStore);
      return () => {
        StoreIndex.delete(thisId);
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return createElement(
      context.Provider,
      { value: localStore },
      props.children,
    );
  };

  const useThisStore = () => useContext(context);

  function useContextValue(): StoreValue;
  function useContextValue<Slice>(
    selector: (state: StoreValue) => Slice,
    equalityFn?: (a: Slice, b: Slice) => boolean,
  ): Slice;
  function useContextValue<Slice>(
    selector?: (state: StoreValue) => Slice,
    equalityFn?: (a: Slice, b: Slice) => boolean,
  ) {
    const store = useThisStore();
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return selector ? useStore(store, selector, equalityFn) : useStore(store);
  }

  return {
    Provider,
    useContextValue,
    StoreIndex,
    useStore: useThisStore,
  };
}
