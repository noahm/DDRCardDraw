import {
  createContext,
  ReactNode,
  useContext,
  useState,
  createElement,
} from "react";
import { StoreApi, useStore, createStore } from "zustand";

export function createContextualStore<
  StoreValue,
  ProviderProps extends { children?: ReactNode }
>(
  creator: (
    p: ProviderProps,
    set: StoreApi<StoreValue>["setState"],
    get: StoreApi<StoreValue>["getState"]
  ) => StoreValue,
  globalProps: ProviderProps
) {
  const globalStore = createStore(creator.bind(undefined, globalProps));
  const context = createContext(globalStore);

  const Provider = (props: ProviderProps) => {
    const [localStore] = useState(() =>
      createStore(creator.bind(undefined, props))
    );
    return createElement(
      context.Provider,
      { value: localStore },
      props.children
    );
  };

  const useThisStore = () => useContext(context);

  function useContextValue(): StoreValue;
  function useContextValue<Slice>(
    selector: (state: StoreValue) => Slice,
    equalityFn?: (a: Slice, b: Slice) => boolean
  ): Slice;
  function useContextValue<Slice>(
    selector?: (state: StoreValue) => Slice,
    equalityFn?: (a: Slice, b: Slice) => boolean
  ) {
    const store = useThisStore();
    return selector ? useStore(store, selector, equalityFn) : useStore(store);
  }

  return {
    Provider,
    useStore: useThisStore,
    useContextValue,
  };
}
