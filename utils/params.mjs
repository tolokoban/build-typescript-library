/** @import { Params } from './types' */

import FS from "node:fs"
import Path from "node:path"
import Chalk from "chalk"
import JSON5 from "json5"

/**
 * @returns {Readonly<Params>}
 */
export function parseParams() {
    const [_node, _program, ...args] = process.argv
    /**
     * @type {Params}
     */
    const params = {
        path: "",
        watch: false,
        verbose: false,
        prjDir: "",
        srcDir: "src",
        outDir: "",
        tsconfigFilename: "",
        dependencies: null,
        allowCircular: false,
        incrementalBuild: false,
        runBefore: [],
        runAfter: [],
        tsconfig: { compilerOptions: {} }
    }
    let hasPath = false
    while (args.length) {
        const arg = args.shift()
        if (!arg) break

        if (arg === "-w" || arg === "--watch") {
            params.watch = true
        } else if (arg === "-v" || arg === "--verbose") {
            params.verbose = true
        } else if (arg === "-c" || arg === "--allow-circular") {
            params.allowCircular = true
        } else if (arg === "-s" || arg === "--srcDir") {
            const srcDir = args.shift()
            if (srcDir) params.srcDir = srcDir
        } else if (arg === "-d" || arg === "--exportDependencies") {
            const depFilename = args.shift()
            if (depFilename) params.dependencies = depFilename
        } else if (arg === "-b" || arg === "--runBefore") {
            const task = args.shift()
            if (task) params.runBefore.push(task)
        } else if (arg === "-a" || arg === "--runAfter") {
            const task = args.shift()
            if (task) params.runAfter.push(task)
        } else {
            params.path = arg
            hasPath = true
        }
    }
    try {
        if (!hasPath) {
            throw new Error("Workspace folder is missing!")
        }
        const tsconfigFilename = Path.resolve(params.path, "tsconfig.json")
        if (!FS.existsSync(tsconfigFilename)) {
            throw new Error(`This workspace has no "tsconfig.json" file!\n${tsconfigFilename}`)
        }
        params.tsconfigFilename = tsconfigFilename
        const tsconfig = JSON5.parse(FS.readFileSync(tsconfigFilename).toString())
        if (!tsconfig.compilerOptions.outDir) {
            throw Error(
                "You must define compilerOptions.outDir in the tsconfig.json file!",
            )
        }
        params.tsconfig = tsconfig
        params.incrementalBuild = tsconfig.compilerOptions?.incremental ?? false
        const prjDir = params.path
        const outDir = Path.resolve(prjDir, tsconfig.compilerOptions.outDir)
        const srcDir = Path.resolve(prjDir, params.srcDir)
        params.prjDir = prjDir
        params.outDir = outDir
        params.srcDir = srcDir
    } catch (ex) {
        console.error(Chalk.bgRed.whiteBright.bold(
            ex instanceof Error ?
                ex.message : JSON.stringify(ex)
        ))
        console.log()
        console.log("Usage:")
        console.log(
            "  node build-typescript-library <destination folder> [--watch] [--scDir <source folder>] [--runBefore <tasks names>] [--runAfter <tasks names>]"
        )
        console.log()
        console.log("Options:")
        console.log(
            "  --versose, -v"
        )
        console.log(
            "  --watch, -w: Watch mode. Compilation will start again as soon as a file is changed in the source dir."
        )
        console.log(
            '  --srcDir, -s: Define the source dir. Default to "./src".'
        )
        console.log(
            "  --runBefore, -b: Task to run with npm just before the compilation starts. To start several tasks, just repeat the --runBefore option as many times as needed."
        )
        console.log(
            "  --runAfter, -a: Task to run with npm just after the compilation starts."
        )
        console.log(
            "  --allow-circular, -c: Allow circular dependencies. (default to false)"
        )
        console.log()
        process.exit(1)
    }
    return params
}
