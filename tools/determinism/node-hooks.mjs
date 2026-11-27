// Module hooks that let Node import the client chunks as they are served.
// Registered by harness.mjs. Nothing here changes what the game code does;
// one thing is added to it: the fixture encounter of test/fixtures/, which
// the harness registers the way a contributor registers an encounter.
//
//   "/toa/zebak/native.js"   web-root imports resolve under client/
//   "*.css"                  stylesheet imports become empty modules
//   "@foxglove/wasm-bz2/..." the bzip2 decoder's Node branch asks for the npm
//                            package; give it the copy the browser loads
//   "/test-fixtures/..."     the fixture's modules, from test/fixtures/
//   two client modules       get the fixture's lines when they are loaded
//                            (test/fixtures/register.mjs says which)
//   import.meta.glob(...)    Vite's glob import, by which the registry finds
//                            the encounters, is written out (import-glob.mjs)
import module from "node:module";
import { dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { fixtureDirectory, fixtureUrlPrefix, registerFixture } from "../../test/fixtures/register.mjs";
import { expandImportGlobs } from "./import-glob.mjs";

const clientRoot = pathToFileURL(process.cwd() + "/client/").href;
const bzip2 = "determinism:bzip2";

function resolveHook(specifier, context, nextResolve) {
  if (specifier === "@foxglove/wasm-bz2/wasm/module.js") return { url: bzip2, shortCircuit: true };
  if (specifier.startsWith(fixtureUrlPrefix)) return nextResolve(new URL(specifier.slice(fixtureUrlPrefix.length), fixtureDirectory).href, context);
  if (specifier.startsWith("/")) return nextResolve(clientRoot + specifier.slice(1), context);
  return nextResolve(specifier, context);
}

// A client module as loaded, with the fixture's lines and the glob imports written out.
function rewritten(url, loaded) {
  if (loaded.source === undefined || loaded.source === null) return loaded;
  const source = String(loaded.source);
  const registered = expandImportGlobs(registerFixture(url.slice(clientRoot.length), source), dirname(fileURLToPath(url)));
  return registered === source ? loaded : { ...loaded, source: registered };
}

function loadHook(url, context, nextLoad) {
  if (url.endsWith(".css")) return { format: "module", source: "", shortCircuit: true };
  if (url.startsWith(clientRoot)) return rewritten(url, nextLoad(url, context));
  if (url !== bzip2) return nextLoad(url, context);
  return bzip2Module();
}

// The hooks of module.register (a loader thread, asynchronous), for a Node without module.registerHooks.
export async function resolve(specifier, context, nextResolve) {
  return resolveHook(specifier, context, nextResolve);
}
export async function load(url, context, nextLoad) {
  if (url.endsWith(".css")) return { format: "module", source: "", shortCircuit: true };
  if (url.startsWith(clientRoot)) return rewritten(url, await nextLoad(url, context));
  if (url !== bzip2) return nextLoad(url, context);
  return bzip2Module();
}

// Installs the hooks, once. module.register() is deprecated from Node 26 (DEP0205): module.registerHooks() (Node
// 22.15, 23.5) runs the same hooks synchronously, on the thread that imports; module.register() only where it's missing.
let installed = false;
export function installHooks() {
  if (installed) return;
  installed = true;
  if (typeof module.registerHooks === "function") module.registerHooks({ resolve: resolveHook, load: loadHook });
  else module.register(import.meta.url);
}

function bzip2Module() {
  // client/bzip2-module.js is a CommonJS script; run it with a module object
  // and hand the factory the wasm bytes, as the browser branch does.
  const root = JSON.stringify(clientRoot);
  return {
    format: "module",
    shortCircuit: true,
    source: `
      import { readFileSync } from "node:fs";
      const module = { exports: {} };
      new Function("module", "exports", "require", "__filename", "__dirname", readFileSync(new URL("bzip2-module.js", ${root}), "utf8"))(
        module, module.exports, () => "", "bzip2-module.js", ".");
      export default () => module.exports({ wasmBinary: readFileSync(new URL("bzip2.wasm", ${root})) });`,
  };
}
