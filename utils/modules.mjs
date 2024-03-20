import FS, { existsSync } from "node:fs"
import Path from "node:path"
import { extractExtension, replaceInFile } from "./fs.mjs"
import { applyAliases } from "./aliases.mjs"
import { listImports } from "./imports.mjs"

/**
 *
 * @param {string} filename
 * @param {Array<[string, string[]]>} aliases
 * @param {string} srcDir
 * @param {string} outDir
 * @param {{
 *   importReplacementCountJS: number
 *   importReplacementCountDTS: number
 *   extraModuleExtensions: Map<string, number>
 *   dependencies: Map<string, string[]>
 * }} stats
 * @returns
 */
export function listLocalImportsJS(filename, aliases, srcDir, outDir, stats) {
    try {
        /** @type {string[]} */
        const dependencies = []
        stats.dependencies.set(Path.relative(outDir, filename), dependencies)
        const jsModuleDir = Path.dirname(filename)
        const importPositions = listImports(filename)
        const replacements = []
        /** @type {string[]} */
        const importPaths = []
        for (const { start, end, value } of importPositions) {
            const dealiased = applyAliases(
                value,
                aliases,
                jsModuleDir,
                srcDir,
                outDir
            )
            let importPath =
                selectBestCandidate(dealiased, jsModuleDir) ?? value
            if (!importPath.startsWith(".")) continue

            dependencies.push(
                Path.relative(outDir, Path.resolve(jsModuleDir, importPath))
            )
            const ext = extractExtension(importPath)
            if (ext !== ".js") {
                // This is special module (not a JS one).
                importPaths.push(Path.resolve(jsModuleDir, importPath))
                stats.extraModuleExtensions.set(
                    ext,
                    1 + (stats.extraModuleExtensions.get(ext) ?? 0)
                )
            }
            if (importPath !== value) {
                replacements.push({
                    start,
                    end,
                    value: importPath,
                })
            }
        }
        replaceInFile(filename, replacements)
        stats.importReplacementCountJS += replacements.length
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
        if (isFileandExists(Path.resolve(jsModuleDir, path))) return path
        const path2 = `${path}/index.js`
        if (isFileandExists(Path.resolve(jsModuleDir, path2))) return path2
        const path3 = `${path}.js`
        if (isFileandExists(Path.resolve(jsModuleDir, path3))) return path3
    }
    return null
}

function isFileandExists(path) {
    if (!existsSync(path)) return false

    const stat = FS.statSync(path)
    return stat.isFile()
}
