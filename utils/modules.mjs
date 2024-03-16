import FS, { existsSync } from "node:fs"
import Path from "node:path"
import * as Acorn from "acorn"
import { extractExtension, replaceInFile } from "./fs.mjs"
import { applyAliases } from "./aliases.mjs"

/**
 *
 * @param {string} filename
 * @param {Array<[string, string[]]>} aliases
 * @param {string} srcDir
 * @param {string} outDir
 * @param {{
 *   importReplacementCountJS: number
 *   extraModuleExtensions: Map<string, number>
 * }} stats
 * @returns
 */
export function listLocalImportsJS(filename, aliases, srcDir, outDir, stats) {
    try {
        const jsModuleDir = Path.dirname(filename)
        const content = FS.readFileSync(filename).toString()
        const tree = Acorn.parse(content, {
            ecmaVersion: 2020,
            sourceType: "module",
        })
        const { body } = tree
        if (!body || !Array.isArray(body)) return []

        const imports = []
        const replacements = []
        for (const node of body) {
            if (
                (node.type === "ExportNamedDeclaration" ||
                    node.type === "ExportAllDeclaration" ||
                    node.type === "ImportDeclaration") &&
                node.source
            ) {
                const { start, end, value } = node.source
                if (typeof value !== "string") continue

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

                const ext = extractExtension(importPath)
                if (ext !== ".js") {
                    // This is special module (not a JS one).
                    imports.push(Path.resolve(jsModuleDir, importPath))
                    stats.extraModuleExtensions.set(
                        ext,
                        1 + (stats.extraModuleExtensions.get(ext) ?? 0)
                    )
                }
                if (importPath !== value) {
                    replacements.push({
                        start,
                        end,
                        value: JSON.stringify(importPath),
                    })
                }
            } else {
                continue
            }
        }
        replaceInFile(filename, replacements)
        stats.importReplacementCountJS += replacements.length
        return imports
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
