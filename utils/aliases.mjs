/** @import { Params } from './types' */

import FS from "node:fs"
import Path from "node:path"
import Chalk from "chalk"

export class AliasManager {
    /**
     * @type {Array<[string, string[]]>}
     */
    paths = []

    /**
     * @param {Params} params
     */
    constructor(params) {
        this.srcDir = params.srcDir
        this.outDir = params.outDir
        const baseUrl = Path.resolve(
            params.prjDir,
            params.tsconfig.compilerOptions?.baseUrl ?? "."
        )
        const paths = params.tsconfig.compilerOptions?.paths ?? {}
        for (const key of Object.keys(paths)) {
            this.paths.push([
                key,
                paths[key].map(val =>
                    Path.relative(params.srcDir, Path.resolve(baseUrl, val))
                ),
            ])
        }
        for (const [key, val] of this.paths) {
            console.log(
                Chalk.yellow("Alias:"),
                Chalk.whiteBright(key),
                ">",
                Chalk.whiteBright(val),
            )
        }
    }

    /**
     * Expand the alias if any.
     * Otherwise, return `importPath` verbatim.
     * @param {string} importPath - The string inside the `import ... from` statement.
     * @param {string} moduleFilename - The full path of the module file (in `outDir`) that does the import.
     * @returns {string} The unaliased import path.
     */
    resolve(importPath, moduleFilename) {
        const candidates = getAliases(importPath, this.paths)
        if (!candidates) return importPath

        const moduleDirnameRel = Path.relative(this.outDir, Path.dirname(moduleFilename))
        const moduleDirnameSrc = Path.resolve(this.srcDir, moduleDirnameRel)
        for (const candidate of candidates) {
            const path = Path.resolve(this.srcDir, candidate)
            const variants = getVariants(path)
            for (const probe of variants) {
                if (FS.existsSync(probe)) {
                    const fullpath = Path.resolve(this.srcDir, candidate)
                    return `./${Path.relative(moduleDirnameSrc, fullpath)}`
                }
            }
        }

        throw new Error(`Import not found in ${Path.relative(this.outDir, moduleFilename)}\n${[importPath, ...candidates].map(
            path => `   ... from "${path}"`
        ).join("\n")
            }`)
    }
}

/**
 * A `*.js` file can have been compiled from a `*.ts`, `*.tsx`, `*.js` or `*.jsx` source.
 * @param {string} path 
 * @returns {string[]}
 */
function getVariants(path) {
    const prefix = path.endsWith(".js") ? path.slice(0, -".js".length) : path
    return ["/index.ts", "/index.tsx", ".ts", ".tsx", ".js", ".jsx", ""].map(ext => `${prefix}${ext}`)
}

/**
 * @param {string} path String found in the "from" clause of an "import".
 * @param {Array<[string, string[]]>} aliases
 * @param {string} jsModuleDir Full path of the Javascript module.
 * @param {string} srcDir Full path where to find Typescript sources.
 * @param {string} outDir Full path where to find Javascript sources.
 * @returns {string[]}
 */
export function _applyAliases(path, aliases, jsModuleDir, srcDir, outDir) {
    /** @type {string[] | null} */
    const candidates = getAliases(path, aliases)
    if (!candidates) return [path]

    const tsModuleDir = Path.resolve(srcDir, Path.relative(outDir, jsModuleDir))
    return candidates.map(
        newPath =>
            `./${Path.relative(tsModuleDir, Path.resolve(srcDir, newPath))}`
    )
}

/**
 * If the path is matched by an alias, return the candidates
 * with the wildcard replaced by the correct string.
 *
 * Example:
 * ```ts
 * getAliases(
 *   "@/toto",
 *   [
 *     ["@/*", ["src/*", "node_modules/*"]]
 *   ]
 * ) === ["src/toto", "node_modules/toto"]
 * ```
 * @param {string} path
 * @param {Array<[string, string[]]>} aliases
 * @returns {string[] | null} `null` if no alias exists for this path.
 */
function getAliases(path, aliases) {
    for (const [pattern, val] of aliases) {
        const match = applyPattern(path, pattern)
        if (match === null) continue

        if (match.length > 0) {
            /** @type {string[]} */
            const result = []
            val.forEach(item => {
                const newItem = item.replace("*", match)
                result.push(newItem)
            })
            return result
        }
        return val
    }
    return null
}

/**
 *
 * @param {string} path
 * @param {string} pattern
 * @returns {string | null}
 */
export function applyPattern(path, pattern) {
    if (pattern.endsWith("*")) {
        const prefix = pattern.substring(0, pattern.length - "*".length)
        if (!path.startsWith(prefix)) {
            return null
        }
        return `./${path.substring(prefix.length)}`
    }
    return path === pattern ? "." : null
}
