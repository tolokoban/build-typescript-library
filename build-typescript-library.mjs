#!/usr/bin/env node

import JSON5 from "json5";
import FS from "fs";
import Path from "path";
import Chalk from "chalk";
import Chokidar from "chokidar";
import { readFile } from "node:fs/promises";
import { exec } from "child_process";
import { parseParams } from "./utils/params.mjs";
import { listLocalImportsJS } from "./utils/modules.mjs";
import { findFiles } from "./utils/fs.mjs";
import { AliasManager } from "./utils/aliases.mjs";
import { replaceAliasesInTypings } from "./utils/typing.mjs";
import { checkCircuilarDependencies as checkCircularDependencies } from "./utils/dependencies.mjs";

const fileUrl = new URL("./package.json", import.meta.url);
const PackageJSON = JSON.parse(await readFile(fileUrl, "utf8"));

const title = ` ${PackageJSON.name} (v${PackageJSON.version}) `;
const hruler = `+${"".padStart(title.length, "-")}+`;
console.log(Chalk.whiteBright(hruler));
console.log(Chalk.whiteBright(`|${title}|`));
console.log(Chalk.whiteBright(hruler));
const params = parseParams();
const tsconfigFilename = Path.resolve(params.path, "tsconfig.json");
const tsconfig = JSON5.parse(FS.readFileSync(tsconfigFilename).toString());
if (!tsconfig.compilerOptions.outDir) {
  throw Error(
    "You must define compilerOptions.outDir in the tsconfig.json file!",
  );
}
const prjDir = params.path;
const outDir = Path.resolve(prjDir, tsconfig.compilerOptions.outDir);
const srcDir = Path.resolve(prjDir, params.srcDir);
console.log(Chalk.yellowBright("Input path "), srcDir);
console.log(Chalk.yellowBright("Output path"), outDir);
const aliasManager = new AliasManager(tsconfigFilename, srcDir);
const aliases = aliasManager.paths;
for (const [key, val] of aliases) {
  console.log(
    Chalk.yellow("Alias:"),
    Chalk.whiteBright(key),
    ">",
    Chalk.whiteBright(val),
  );
}

/**
 * @param {string} cmd
 */
async function command(cmd) {
  return new Promise((resolve, reject) => {
    console.log(Chalk.cyanBright(cmd));
    exec(cmd, (err, stdout, stderr) => {
      if (err) {
        if (stdout) console.error(Chalk.redBright(stdout));
        if (stderr) console.error(Chalk.redBright(stderr));
        reject(err);
      } else {
        if (stdout) console.log(stdout);
        if (stderr) console.log(stderr);
        resolve({ stdout, stderr });
      }
    });
  });
}

let firstCompilation = true;
let needToRecompile = false;
let isCompiling = false;

async function start() {
  isCompiling = true;
  /**
   * @type {{
   *   importReplacementCountJS: number
   *   importReplacementCountDTS: number
   *   extraModuleExtensions: Map<string, number>
   *   dependencies: Map<string, string[]>
   * }}
   */
  const stats = {
    importReplacementCountJS: 0,
    importReplacementCountDTS: 0,
    extraModuleExtensions: new Map(),
    dependencies: new Map(),
  };
  try {
    if (firstCompilation) {
      console.log();
      firstCompilation = false;
    } else {
      console.clear();
    }
    for (const task of params.runBefore) {
      if (params.verbose) {
        console.log("Run before:", Chalk.yellowBright(task));
      }
      await command(`npm run ${task}`);
    }
    await command(`npx -p typescript tsc -p "${tsconfigFilename}"`);
    const modulesJS = await findFiles(outDir, [".js"]);
    console.log(Chalk.yellowBright("Generated JS modules: "), modulesJS.length);
    const setRelativeImports = new Set();
    for (const module of modulesJS) {
        if (params.verbose) {
          console.log(Chalk.yellowBright(module));
        }
      const extraImportOutDirs = listLocalImportsJS(
        Path.resolve(outDir, module),
        aliases,
        srcDir,
        outDir,
        stats,
        !!params.verbose
      );
      if (!params.allowCircular) checkCircularDependencies(stats.dependencies);
      if (extraImportOutDirs.length === 0) continue;

      const extraImportRelDirs = extraImportOutDirs.map((name) =>
        Path.relative(outDir, name),
      );
      if (params.verbose && extraImportRelDirs.length > 0) {
        console.log("Module:", Chalk.blueBright(module), srcDir, outDir);
        console.log(
          "Extra imports:",
          extraImportRelDirs.map((name) => Chalk.blue(name)).join(", "),
        );
      }
      for (const imp of extraImportRelDirs) {
        if (setRelativeImports.has(imp)) continue;

        setRelativeImports.add(imp);
        const src = Path.resolve(srcDir, imp);
        const dst = Path.resolve(outDir, imp);
        if (params.verbose) {
          console.log("Copy:", Chalk.whiteBright(src));
          console.log("  to:", Chalk.whiteBright(dst));
        }
        try {
          const dir = Path.dirname(dst);
          if (!FS.existsSync(dir)) {
            FS.mkdirSync(dir, { recursive: true });
          }
          FS.copyFileSync(src, dst);
        } catch (ex) {
          console.error(ex);
          throw Error(
            `Unable to copy file "${imp}\n  from ${src}\n    to ${dst}`,
          );
        }
      }
    }
    console.log(
      Chalk.yellowBright("Extra modules:        "),
      setRelativeImports.size,
      "   ",
      `(${Array.from(stats.extraModuleExtensions.keys())
        .map(
          (key) =>
            `${Chalk.greenBright(stats.extraModuleExtensions.get(key))}${key}`,
        )
        .join(", ")})`,
    );
    console.log(
      Chalk.yellowBright("Replaced JS paths:    "),
      stats.importReplacementCountJS,
    );
    const importReplacementCountDTS = await replaceAliasesInTypings(
      outDir,
      aliases,
    );
    console.log(
      Chalk.yellowBright("Replaced DTS paths:   "),
      importReplacementCountDTS,
    );
    for (const task of params.runAfter) {
      await command(`npm run ${task}`);
    }
  } catch (ex) {
    const msg = ex instanceof Error ? ex.message : JSON.stringify(ex);
    console.log();
    console.log(Chalk.redBright("Error!"));
    console.error(Chalk.bgRed.whiteBright(msg));
    if (ex instanceof Error) {
      console.log(Chalk.red(ex.stack));
    }
    console.log();
  } finally {
    isCompiling = false;
  }
  console.log();
  if (params.watch) {
    console.log(Chalk.greenBright("Waiting for file changes..."));
  }
  if (needToRecompile) {
    needToRecompile = false;
    setTimeout(start, 1);
  }
}

await start();

/** @type {number | undefined | NodeJS.Timeout} */
let timeout = 0;

if (params.watch) {
  Chokidar.watch(srcDir, {
    awaitWriteFinish: true,
  }).on("all", (event, path) => {
    if (event === "add" || event === "addDir") return;

    clearTimeout(timeout);
    timeout = setTimeout(() => {
      if (!isCompiling) void start();
      else needToRecompile = true;
    }, 200);
  });
}
