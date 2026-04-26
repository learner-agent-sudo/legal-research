/**
 * Throw a clear error if an env var contains characters that will fail when
 * used in HTTP headers (e.g. an ellipsis from a copy-paste of an abbreviated
 * value, smart quotes, em-dashes, accidental whitespace).
 */
export function requireAscii(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(`${name} is not set.`);
  }
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code > 127) {
      throw new Error(
        `${name} contains a non-ASCII character at position ${i} ` +
          `(charCode ${code}, "${value[i]}"). This usually happens when you ` +
          `copy-paste an abbreviated value that included an ellipsis or smart quote. ` +
          `Recreate the value and paste again — make sure there are no "…" ` +
          `or other special characters.`
      );
    }
  }
  return value;
}
