function hasToString(i: any): i is { toString(): string } {
  return "toString" in i && typeof i["toString"] === "function";
}

export function convertErrorToString(err: unknown, withStack = false): string {
  if (typeof err === "string") {
    return err;
  }
  if (err instanceof Error) {
    let ret = err.message;
    if (withStack && err.stack) {
      ret = ret + "\n\n" + err.stack;
    }
    return ret;
  }
  if (hasToString(err)) {
    return err.toString();
  }
  return "unknown error";
}
