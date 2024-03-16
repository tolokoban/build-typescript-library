import FS from "node:fs"
import Path from "node:path"
import { findFiles, replaceInFile } from "./fs.mjs"
import { listImports } from "./imports.mjs"
import { applyPattern } from "./aliases.mjs"

/**
 * @param {string} outDir
 * @param {Array<[string, string[]]>} aliases
 */
export async function replaceAliasesInTypings(outDir, aliases) {
    let totalReplacementCount = 0
    const files = await findFiles(outDir, [".d.ts"])
    for (const filename of files) {
        const path = Path.resolve(outDir, filename)
        const modDir = Path.dirname(path)
        const imports = listImports(path)
        /** @type {Array<{ start: number, end: number, value: string }>} */
        const replacements = []
        for (const { start, end, value } of imports) {
            const importPath = realizePath(value, aliases, outDir, modDir)
            if (importPath !== value) {
                replacements.push({
                    start,
                    end,
                    value: importPath.endsWith(".d.ts")
                        ? importPath.substring(
                              0,
                              importPath.length - ".d.ts".length
                          )
                        : importPath,
                })
            }
        }
        replaceInFile(path, replacements)
        totalReplacementCount += replacements.length
    }
    return totalReplacementCount
}

/**
 *
 * @param {string} path
 * @param {Array<[string, string[]]>} aliases
 * @param {string} outDir
 * @param {string} modDir
 */
function realizePath(
    path,
    aliases,
    outDir,
    modDir,
    extensions = ["/index.d.ts", ".d.ts"]
) {
    if (path.startsWith(".")) {
        // This is not an alias: this is a relative path.
        return path
    }

    const candidates = [path]
    for (const [pattern, alias] of aliases) {
        const match = applyPattern(path, pattern)
        if (!match) continue

        const newPaths = alias.map(item => item.replace("*", match))
        newPaths.forEach(newPath => {
            if (newPath.startsWith(".")) {
                const relPath = Path.relative(
                    modDir,
                    Path.resolve(outDir, newPath)
                )
                candidates.push(
                    relPath.startsWith(".") ? relPath : `./${relPath}`
                )
            } else {
                candidates.push(newPath)
            }
        })
    }
    for (const candidate of candidates) {
        const items = [
            candidate,
            ...extensions.map(ext => `${candidate}${ext}`),
        ]
        for (const item of items) {
            if (item.startsWith(".")) {
                const absPath = Path.resolve(modDir, item)
                if (FS.existsSync(absPath)) {
                    return item
                }
            }
        }
    }
    return path
}
