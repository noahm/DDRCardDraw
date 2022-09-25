import { useState } from "react";

export function useForceUpdate() {
  const [, incrementRenderCount] = useState(0);
  return () => {
    incrementRenderCount((prev) => prev + 1);
  };
}
