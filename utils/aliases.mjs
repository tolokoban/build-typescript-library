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
 * @param {string} projectDir
 * @param {string} srcDir
 * @returns {Array<[string, string[]]>}
 */
export function parseAliases(tsconfig, projectDir, srcDir) {
    const { compilerOptions } = tsconfig
    if (!compilerOptions) return []

    const { baseUrl = "", paths = {} } = compilerOptions
    return Object.keys(paths).map(alias => [
        alias,
        paths[alias].map(
            value =>
                `./${Path.relative(
                    srcDir,
                    Path.resolve(projectDir, baseUrl, value)
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
    return candidates.map(newPath =>
        Path.relative(tsModuleDir, Path.resolve(srcDir, newPath))
    )
}

/**
 * @param {string} path
 * @param {Array<[string, string[]]>} aliases
 * @returns {string[] | null} `null` if no alias exists for this path.
 */
function getAliases(path, aliases) {
    for (const [pattern, val] of aliases) {
        if (!Micromatch.isMatch(path, pattern)) continue

        const match = Micromatch.capture(pattern, path)
        if (!match) {
            return val
        }
        const [capture] = match
        return capture ? val.map(item => item.replace("*", capture)) : val
    }
    return null
}
