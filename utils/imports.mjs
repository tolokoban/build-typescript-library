import FS from "node:fs"
import Path from "node:path"
import { SyntaxKind, Project } from "ts-morph"

/**
 *
 * @param {string} filename
 * @returns {Array<{ start: number, end: number, value: string }>}
 */
export function listImports(filename) {
    const content = FS.readFileSync(filename).toString()
    const project = new Project()
    const root = project.createSourceFile(Path.basename(filename), content)

    /** @type {Array<{ start: number, end: number, value: string }>} */
    const imports = []
    root.forEachChild(node => {
        if (
            node.isKind(SyntaxKind.ImportDeclaration) ||
            node.isKind(SyntaxKind.ExportDeclaration)
        ) {
            const name = node.getFirstChildByKind(SyntaxKind.StringLiteral)
            if (!name) return

            const text = name.getText()
            imports.push({
                start: name.getStart() + 1,
                end: name.getEnd() - 1,
                value: text.substring(1, text.length - 1),
            })
        }
    })
    return imports
}
