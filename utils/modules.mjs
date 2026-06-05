/** @import { Params, Stats, Replacement } from './types' */

import FS, { copyFileSync, existsSync } from "node:fs"
import Path from "node:path"
import Chalk from "chalk"
import { AliasManager } from "./aliases.mjs"
import { lookForDependenciesInCssFile } from "./css.mjs"
import { extractExtension, replaceInFile } from "./fs.mjs"
import { listImports } from "./imports.mjs"

/**
 *
 * @param {string} filename
 * @param {AliasManager} aliasManager
 * @param {Params} params
 * @param {Stats} stats
 * @returns
 */
export async function listLocalImportsJS(filename, aliasManager, params, stats) {
    const { srcDir, outDir, verbose } = params
    try {
        /** @type {string[]} */
        const dependencies = []
        stats.dependencies.set(Path.relative(outDir, filename), dependencies)
        const jsModuleDir = Path.dirname(filename)
        const importPositions = listImports(filename, verbose)
        /** @type {Replacement[]} */
        const replacements = []
        /** @type {string[]} */
        const importPaths = []
        for (const { start, end, value, codeLine } of importPositions) {
            if (verbose) {
                console.log(">", Chalk.greenBright(codeLine), value)
            }
            const importPath = aliasManager.resolve(value, filename)
            if (importPath !== value) {
                // It's an alias replacement
                replacements.push({ start, end, value: importPath })
                stats.importReplacementCountJS++
                if (verbose) {
                    console.log(Chalk.cyanBright("Import path:"), JSON.stringify(value), ">>", Chalk.bold(JSON.stringify(importPath)))
                }
            }
            if (!importPath.startsWith(".")) continue

            const importWithExtension = addJsExtensionIfNeeded(Path.resolve(jsModuleDir, importPath))
            const importFullpath = Path.relative(outDir, importWithExtension)
            dependencies.push(importFullpath)
            const ext = extractExtension(importFullpath)
            if (ext !== ".js" && ext !== ".jsx") {
                // This is special module (not a JS one).
                const specialModulePathDestination = Path.resolve(jsModuleDir, importPath)
                const specialModulePathSource = Path.resolve(srcDir, Path.relative(outDir, specialModulePathDestination))
                if (verbose) {
                    console.log(Chalk.cyanBright("Special module:"), specialModulePathDestination)
                    console.log(Chalk.cyanBright("Special module:"), specialModulePathSource)
                }
                copyFileSync(specialModulePathSource, specialModulePathDestination)
                importPaths.push(specialModulePathDestination)
                stats.extraModuleExtensions.set(
                    ext,
                    1 + (stats.extraModuleExtensions.get(ext) ?? 0)
                )
                if (ext === ".css") {
                    // Check for url() to see if this CSS has dependencies.
                    const cssDependencies = await lookForDependenciesInCssFile(jsModuleDir, importPath)
                    if (cssDependencies.length > 0) {
                        if (verbose) {
                            console.log(Chalk.cyanBright("CSS dependencies:"), importPath)
                        }
                        for (const cssDep of cssDependencies) {
                            if (verbose) {
                                console.log("  -", Chalk.cyanBright(cssDep))
                            }

                            const cssPath = Path.resolve(jsModuleDir, importPath)
                            const path = Path.resolve(Path.dirname(cssPath), cssDep)
                            const sourcePath = Path.resolve(
                                srcDir,
                                Path.relative(outDir, path)
                            )
                            if (!FS.existsSync(sourcePath)) {
                                throw new Error(`Missing file in CSS "${Path.relative(outDir, cssPath)}": "${cssDep}"
File not found: ${sourcePath}`)
                            }
                            const cssExt = extractExtension(cssDep)
                            importPaths.push(path)
                            stats.extraModuleExtensions.set(
                                cssExt,
                                1 + (stats.extraModuleExtensions.get(cssExt) ?? 0))
                        }
                    }
                }
            }
        }
        replaceInFile(filename, replacements)
        return importPaths
    } catch (ex) {
        const msg = ex instanceof Error ? ex.message : `${ex}`
        throw Error(
            `Error while parsing the imports of file:\n${filename}\n${msg}`
        )
    }
}

/**
 * @param {string} text
 * @param {number} pos
 */
function findLocation(text, pos) {
    const begin = text.substring(0, pos)
    const lines = begin.split("\n")
    const lastLine = lines.pop() ?? ""
    return `${lines.length + 1},${lastLine.length}`
}

/**
 * We take `paths` elements one by one and we check if
 * `path`, `${path}.js` or `${path}/index.js` exist.
 * we return the first match (with the potential `.js` extension).
 *
 * @param {string[]} paths
 * @param {string} jsModuleDir
 * @returns {string | null}
 */
function selectBestCandidate(paths, jsModuleDir) {
    for (const path of paths) {
        if (!path.startsWith(".")) {
            // This is an absolute path.
            // Must be something from "node_modules/".
            return path
        }
        const alternatives = ["", ".js", "/index.js", ".jsx", "/index.jsx"]
        for (const alternative of alternatives) {
            const candidate = `${path}${alternative}`
            if (isFileAndExists(Path.resolve(jsModuleDir, candidate)))
                return candidate
        }
    }
    const [path] = paths
    return path ?? null
}

/**
 * @param {string} path 
 * @returns 
 */
function isFileAndExists(path) {
    if (!existsSync(path)) return false

    const stat = FS.statSync(path)
    return stat.isFile()
}

/**
 * JS modules can be imported without the `.js` extension.
 * this function add the extension if it is missing.
 * @param {string} path 
 * @returns {string}
 */
function addJsExtensionIfNeeded(path) {
    const extensions = [
        "/index.js",
        "",
        ".js"
    ]
    for (const ext of extensions) {
        const candidate = `${path}${ext}`
        if (FS.existsSync(candidate)) return candidate
    }
    return path
}

