/* `src/` is written for the bundler, which resolves `./blocks` to `blocks.ts`
 * on its own. Node's ESM resolver does not, so tests would otherwise need a
 * whole test runner just to load the modules they are testing. This hook adds
 * the extension back on the way through and nothing else. */
export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (err) {
    if (specifier.startsWith(".") && !/\.[cm]?[jt]sx?$/.test(specifier)) {
      return nextResolve(`${specifier}.ts`, context);
    }
    throw err;
  }
}
