import Path from "node:path"
import Micromatch from "micromatch"

/**
 *
 * @param {{
 *   compilerOptions?: {
 *     baseUrl?: string
 *     paths?: {
 *       [key: string]: string[]
 *     }
 *   }
 * }} tsconfig
 * @param {string} prjDir
 * @param {string} srcDir
 * @returns {Array<[string, string[]]>}
 */
export function parseAliases(tsconfig, prjDir, srcDir) {
    const { compilerOptions } = tsconfig
    if (!compilerOptions) return []

    const { baseUrl = Path.relative(prjDir, srcDir), paths = {} } =
        compilerOptions
    return Object.keys(paths).map(alias => [
        alias,
        paths[alias].map(
            value =>
                `./${Path.relative(
                    srcDir,
                    Path.resolve(prjDir, baseUrl, value)
                )}`
        ),
    ])
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
function applyPattern(path, pattern) {
    if (pattern.endsWith("*")) {
        const prefix = pattern.substring(0, pattern.length - "*".length)
        if (!path.startsWith(prefix)) {
            return null
        }
        return path.substring(prefix.length)
    }
    return path === pattern ? "" : null
}
