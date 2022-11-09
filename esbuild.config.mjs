import esbuild from "esbuild";
import process from "process";
import builtins from "builtin-modules";
import { config } from "dotenv";
import { sassPlugin } from "esbuild-sass-plugin";

config();

const banner = `/*
THIS IS A GENERATED/BUNDLED FILE BY ESBUILD
if you want to view the source, please visit the github repository of this plugin
*/
`;

const prod = process.argv[2] === "production";

const dir = prod ? "./dist" : process.env.OUTDIR || "./dist";

esbuild
	.build({
		banner: {
			js: banner,
		},
		entryPoints: [
			"src/main.ts",
			// "src/manifest.json",
			"src/styles.css",
			"src/bin/order.bin.ts"
		],
		bundle: true,
		external: [
			"obsidian",
			"electron",
			"@codemirror/autocomplete",
			"@codemirror/collab",
			"@codemirror/commands",
			"@codemirror/language",
			"@codemirror/lint",
			"@codemirror/search",
			"@codemirror/state",
			"@codemirror/view",
			"@lezer/common",
			"@lezer/highlight",
			"@lezer/lr",
			...builtins,
		],
		format: "cjs",
		watch: !prod,
		target: "es2018",
		logLevel: "info",
		sourcemap: prod ? false : "inline",
		treeShaking: true,
		outdir: dir,
		plugins: [sassPlugin()],
	})
	.catch(() => process.exit(1));
