import FS from "node:fs"
import Path from "node:path"
import JSON5 from "json5"

export class AliasManager {
    /**
     * @type {Array<[string, string[]]>}
     */
    paths = []

    /**
     * @param {string} tsconfigFilename Full path of the `tsconfig.json` file.
     * @param {string} srcDir Absolute path of the source directory.
     */
    constructor(tsconfigFilename, srcDir) {
        /**
         * @type {{
         *   compilerOptions?: {
         *     baseUrl?: string
         *     paths?: {
         *       [key: string]: string[]
         *     }
         *   }
         * }}
         */
        const tsconfig = JSON5.parse(
            FS.readFileSync(tsconfigFilename).toString()
        )
        const baseUrl = Path.resolve(
            Path.dirname(tsconfigFilename),
            tsconfig.compilerOptions?.baseUrl ?? "."
        )
        const paths = tsconfig.compilerOptions?.paths ?? {}
        for (const key of Object.keys(paths)) {
            this.paths.push([
                key,
                paths[key].map(val =>
                    Path.relative(srcDir, Path.resolve(baseUrl, val))
                ),
            ])
        }
    }

    /**
     * Expand the alias is any.
     * Otherwise, return `path` verbatim.
     * @param {string} path
     * @returns {string}
     */
    parse(path) {}
}

/**
 * @param {string} path String found in the "from" clause of an "import".
 * @param {Array<[string, string[]]>} aliases
 * @param {string} jsModuleDir Full path of the Javascript module.
 * @param {string} srcDir Full path where to find Typescript sources.
 * @param {string} outDir Full path where to find Javascript sources.
 * @returns {string[]}
 */
export function applyAliases(path, aliases, jsModuleDir, srcDir, outDir) {
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
