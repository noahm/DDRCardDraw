import { Loader } from "@mantine/core";
import { useState, useEffect } from "react";

export function DelayedSpinner(props: { timeout?: number }) {
  const [show, updateShow] = useState(false);
  useEffect(() => {
    if (show) return;

    const timeout = setTimeout(() => {
      updateShow(true);
    }, props.timeout || 250);
    return () => clearTimeout(timeout);
  }, [props.timeout, show]);
  if (show) {
    return <Loader style={{ marginTop: "15px" }} />;
  }
  return null;
}
