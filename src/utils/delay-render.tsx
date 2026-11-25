import { ReactNode, useState, useEffect } from "react";

interface DelayProps {
  delayMs?: number;
  children: ReactNode;
}

/**
 * delays rendering children until 200ms has passed.
 * helps to hide flickering loading spinners when loads
 * are fast
 **/
export function DelayRender(props: DelayProps) {
  const [display, setDisplay] = useState(false);
  useEffect(() => {
    const handle = setTimeout(() => {
      setDisplay(true);
    }, props.delayMs || 200);
    return () => clearTimeout(handle);
  }, [props.delayMs]);
  if (display) {
    return <>{props.children}</>;
  }
  return null;
}
