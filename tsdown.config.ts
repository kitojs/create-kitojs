import { defineConfig } from "tsdown";

export default defineConfig({
  entry: "bin/index.ts",
  outDir: "dist",

  minify: true,

  dts: false,
  tsconfig: "tsconfig.json",
});
