export function withPayload<T>() {
  return (t: T) => ({ payload: t });
}
