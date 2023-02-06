import process from 'process';
import fs from 'node:fs';
import esbuild from 'esbuild';
import builtins from 'builtin-modules';
import esbuildSvelte from 'esbuild-svelte';
import watPlugin from 'esbuild-plugin-wat';
import sveltePreprocess from 'svelte-preprocess';
import { config } from 'dotenv';
import { sassPlugin } from 'esbuild-sass-plugin';
import { default as pluginVue } from 'esbuild-plugin-vue-next';
import Vue from '@the_tree/esbuild-plugin-vue3';

config();

const banner = `/*
THIS IS A GENERATED/BUNDLED FILE BY ESBUILD
if you want to view the source, please visit the github repository of this plugin
*/
`;

const prod = process.argv[2] === 'production';
const dir = process.env.OUTDIR ? process.env.OUTDIR : 'dest';
const copyFiles = ['.hotreload', 'manifest.json', 'versions.json'];

if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
}
copyFiles.forEach(file => {
    fs.copyFileSync(file, dir + '/' + file);
});
esbuild
    .build({
        banner: {
            js: banner,
        },
        entryPoints: ['src/main.ts', 'src/styles.css', 'src/bin/order.bin.ts'],
        bundle: true,
        // drop: prod ? ['console', 'debugger'] : [],
        external: [
            'obsidian',
            'electron',
            '@codemirror/autocomplete',
            '@codemirror/collab',
            '@codemirror/commands',
            '@codemirror/language',
            '@codemirror/lint',
            '@codemirror/search',
            '@codemirror/state',
            '@codemirror/view',
            '@lezer/common',
            '@lezer/highlight',
            '@lezer/lr',
            ...builtins,
        ],
        format: 'cjs',
        watch: !prod,
        target: 'es2018',
        logLevel: 'info',
        sourcemap: prod ? false : 'inline',
        treeShaking: true,
        outdir: dir,
        plugins: [
            watPlugin(),
            Vue({ isProd: true }),
            // pluginVue(),
            esbuildSvelte({
                preprocess: sveltePreprocess(),
            }),
            sassPlugin(),
        ],
    })
    .catch(() => process.exit(1));
