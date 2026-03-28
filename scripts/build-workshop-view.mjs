import { build } from "esbuild";

await build({
  entryPoints: ["apps/workshop-view/src/main.jsx"],
  bundle: true,
  format: "esm",
  jsx: "automatic",
  target: "es2022",
  outfile: "apps/workshop-view/main.js",
  define: {
    "process.env.NODE_ENV": "\"production\""
  },
  logLevel: "info",
  minify: true,
  sourcemap: false
});
