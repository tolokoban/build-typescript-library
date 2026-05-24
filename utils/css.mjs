import FS from "node:fs"
import AsyncFS from "node:fs/promises"
import Path from "node:path"
import * as csstree from "css-tree"

/**
 * Look for any "url()" in a CSS file.
 * It would be something to import.
 * 
 * @param {string} jsModuleDir 
 * @param {string} importPath 
 * @return {Promise<string[]>}
 */
export async function lookForDependenciesInCssFile(jsModuleDir, importPath) {
    const cssContent = (await AsyncFS.readFile(Path.resolve(jsModuleDir, importPath))).toString()
    const urls = extractUrlsInCSS(cssContent)
    return urls.map(item => item.trim()).filter(item => item.startsWith("./") || item.startsWith("../"))
}

/**
 * 
 * @param {string} cssContent 
 * @returns {string[]}
 */
function extractUrlsInCSS(cssContent) {
    /** @type {string[]} */
    const urls = []
    const ast = csstree.parse(cssContent)
    csstree.walk(ast, {
        visit: "Url",
        enter(node) {
            urls.push(node.value)
        },
    })
    return urls
}
