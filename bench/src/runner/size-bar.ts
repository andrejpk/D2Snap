export function sizeBar(bytes: number, maximumBytes: number) {
  if (!Number.isFinite(bytes) || !Number.isFinite(maximumBytes) || bytes < 0 || maximumBytes < bytes) {
    throw new RangeError("Size bars require nonnegative bytes and a maximum at least as large as the output.");
  }
  const percentage = maximumBytes === 0 ? 0 : bytes / maximumBytes * 100;
  const kb = (bytes / 1000).toFixed(3);
  return {
    kb, percentage,
    description: `${kb} KB (${bytes} bytes); ${percentage.toFixed(1)}% of the largest output in this state, including Raw. `
      + (maximumBytes ? `100% = ${maximumBytes} bytes.` : "All outputs are zero bytes; bars are empty."),
  };
}
