import Path from "node:path"
import { findModules } from "./modules.mjs"
import { listImports } from "./imports.mjs"

/**
 * @param {string} outDir
 * @param {Array<[string, string[]]>} aliases
 */
export async function replaceAliasesInTypings(outDir, aliases) {
    const files = await findModules(outDir, [".d.ts"])
    for (const filename of files) {
        console.log(filename)
        const path = Path.resolve(outDir, filename)
        const imports = listImports(path)
        console.log(JSON.stringify(imports))
    }
}
