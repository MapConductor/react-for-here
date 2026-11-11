import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { after } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { build } from 'tsup';

// src/*.ts をエントリごとに tsup で ESM にして読み込む。出力は build/ 下の一時ディレクトリで、
// テストの終わりに消す。js-sdk-core は外部扱いにして、地図 SDK（グローバル H）は
// テスト側の偽物（fakeHere.mjs）で置き換える。
export async function buildSources(name, entry) {
    mkdirSync(new URL('../../build/', import.meta.url), { recursive: true });
    const outDir = mkdtempSync(fileURLToPath(new URL(`../../build/${name}-`, import.meta.url)));
    after(() => rmSync(outDir, { recursive: true, force: true }));
    await build({
        entry, outDir, format: ['esm'], platform: 'node',
        // 共有モジュール（helpers の重なり順の表など）をエントリ間で 1 つにするため分割する。
        splitting: true,
        dts: false, sourcemap: false, config: false, silent: true,
        external: ['@mapconductor/js-sdk-core', '@mapconductor/js-sdk-react', 'react'],
    });
    const modules = {};
    for (const key of Object.keys(entry)) {
        modules[key] = await import(pathToFileURL(resolve(outDir, `${key}.mjs`)));
    }
    return modules;
}
