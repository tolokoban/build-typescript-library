#!/usr/bin/env node

import JSON5 from "json5"
import FS from "fs"
import Path from "path"
import Chalk from "chalk"
import Chokidar from "chokidar"
import { exec } from "child_process"
import { parseParams } from "./utils/params.mjs"
import { listLocalImportsJS } from "./utils/modules.mjs"
import { findFiles } from "./utils/fs.mjs"
import { AliasManager } from "./utils/aliases.mjs"
import PackageJSON from "./package.json" assert { type: "json" }
import { replaceAliasesInTypings } from "./utils/typing.mjs"
import { checkCircuilarDependencies } from "./utils/dependencies.mjs"

const title = ` ${PackageJSON.name} (v${PackageJSON.version}) `
const hruler = `+${"".padStart(title.length, "-")}+`
console.log(Chalk.whiteBright(hruler))
console.log(Chalk.whiteBright(`|${title}|`))
console.log(Chalk.whiteBright(hruler))
const params = parseParams()
const tsconfigFilename = Path.resolve(params.path, "tsconfig.json")
const tsconfig = JSON5.parse(FS.readFileSync(tsconfigFilename).toString())
if (!tsconfig.compilerOptions.outDir) {
    throw Error(
        "You must define compilerOptions.outDir in the tsconfig.json file!"
    )
}
const prjDir = params.path
const outDir = Path.resolve(prjDir, tsconfig.compilerOptions.outDir)
const srcDir = Path.resolve(prjDir, params.srcDir)
console.log(Chalk.yellowBright("Build path"), outDir)
const aliasManager = new AliasManager(tsconfigFilename, srcDir)
const aliases = aliasManager.paths
for (const [key, val] of aliases) {
    console.log(
        Chalk.yellow("Alias:"),
        Chalk.whiteBright(key),
        ">",
        Chalk.whiteBright(val)
    )
}

async function command(cmd) {
    return new Promise((resolve, reject) => {
        console.log(Chalk.cyanBright(cmd))
        exec(cmd, (err, stdout, stderr) => {
            if (err) {
                if (stdout) console.error(Chalk.redBright(stdout))
                if (stderr) console.error(Chalk.redBright(stderr))
                reject(err)
            } else {
                if (stdout) console.log(stdout)
                if (stderr) console.log(stderr)
                resolve({ stdout, stderr })
            }
        })
    })
}

let firstCompilation = true

async function start() {
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
    }
    try {
        if (firstCompilation) {
            console.log()
            firstCompilation = false
        } else {
            console.clear()
        }
        for (const task of params.runBefore) {
            await command(`npm run ${task}`)
        }
        await command(`npx tsc -p "${tsconfigFilename}"`)
        const modulesJS = await findFiles(outDir, [".js"])
        console.log(
            Chalk.yellowBright("Generated JS modules: "),
            modulesJS.length
        )
        const setRelativeImports = new Set()
        for (const module of modulesJS) {
            const relImports = listLocalImportsJS(
                Path.resolve(outDir, module),
                aliases,
                srcDir,
                outDir,
                stats
            )
            checkCircuilarDependencies(stats.dependencies)
            if (relImports.length === 0) continue
            const absImports = relImports.map(name =>
                Path.relative(outDir, name)
            )
            for (const imp of absImports) {
                if (setRelativeImports.has(imp)) continue

                setRelativeImports.add(imp)
                const src = Path.resolve(srcDir, imp)
                const dst = Path.resolve(outDir, imp)
                // console.log("copy", Chalk.whiteBright(imp))
                try {
                    const dir = Path.dirname(dst)
                    if (!FS.existsSync(dir)) {
                        FS.mkdirSync(dir, { recursive: true })
                    }
                    FS.copyFileSync(src, dst)
                } catch (ex) {
                    console.error(ex)
                    throw Error(
                        `Unable to copy file "${imp}\n  from ${src}\n    to ${dst}`
                    )
                }
            }
        }
        console.log(
            Chalk.yellowBright("Extra modules:        "),
            setRelativeImports.size,
            "   ",
            `(${Array.from(stats.extraModuleExtensions.keys())
                .map(
                    key =>
                        `${Chalk.greenBright(
                            stats.extraModuleExtensions.get(key)
                        )}${key}`
                )
                .join(", ")})`
        )
        console.log(
            Chalk.yellowBright("Replaced JS paths:    "),
            stats.importReplacementCountJS
        )
        const importReplacementCountDTS = await replaceAliasesInTypings(
            outDir,
            aliases
        )
        console.log(
            Chalk.yellowBright("Replaced DTS paths:   "),
            importReplacementCountDTS
        )
        for (const task of params.runAfter) {
            await command(`npm run ${task}`)
        }
    } catch (ex) {
        const msg = ex instanceof Error ? ex.message : JSON.stringify(ex)
        console.log()
        console.log(Chalk.redBright("Error!"))
        console.error(Chalk.bgRed.whiteBright(msg))
        if (ex instanceof Error) {
            console.log(Chalk.red(ex.stack))
        }
        console.log()
    }
    console.log()
    if (params.watch) {
        console.log(Chalk.greenBright("Waiting for file changes..."))
    }
}

await start()

/** @type {number | undefined | NodeJS.Timeout} */
let timeout = 0

if (params.watch) {
    Chokidar.watch(srcDir, {
        awaitWriteFinish: true,
    }).on("all", (event, path) => {
        if (event === "add" || event === "addDir") return

        clearTimeout(timeout)
        timeout = setTimeout(() => void start(), 200)
    })
}
