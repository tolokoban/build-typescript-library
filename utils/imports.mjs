// @see https://ts-ast-viewer.com

import FS from "node:fs";
import Path from "node:path";
import { SyntaxKind, Project } from "ts-morph";

/**
 * @param {string} filename
 * @param {boolean} verbose
 * @returns {Array<{ start: number, end: number, value: string, codeLine: string }>}
 */
export function listImports(filename, verbose) {
  const content = FS.readFileSync(filename).toString();
  const project = new Project();
  const root = project.createSourceFile(Path.basename(filename), content);

  /** @type {Array<{ start: number, end: number, value: string, codeLine: string }>} */
  const imports = [];
  root.forEachChild((node) => {
    if (
      node.isKind(SyntaxKind.ImportDeclaration) ||
      node.isKind(SyntaxKind.ExportDeclaration)
    ) {
      const name = node.getFirstChildByKind(SyntaxKind.StringLiteral);
      if (!name) return;

      const text = name.getText();
      const start = name.getStart() + 1;
      const end = name.getEnd() - 1;
      imports.push({
        start,
        end,
        value: text.substring(1, text.length - 1),
        codeLine: getCodeLine(content, start, end)
      });
    }
  });

  // Search for imports of the form `import("./translate.en")`
  root.forEachDescendant((child) => {
    if (child.isKind(SyntaxKind.CallExpression)) {
      const expression = child.getExpression();
      if (!expression.isKind(SyntaxKind.ImportKeyword)) return;

      const args = child.getArguments();
      if (args.length < 1) return;

      const [argument] = args;
      if (!argument.isKind(SyntaxKind.StringLiteral)) return;

      const text = argument.getText();
      imports.push({
        start: argument.getStart() + 1,
        end: argument.getEnd() - 1,
        value: text.substring(1, text.length - 1),
      });
      console.log(">", argument.print());
    }
  });
  return imports;
}

/**
 * @param {string} content 
 * @param {number} start 
 * @param {number} end 
 * @returns {string}
 */
function getCodeLine(content, start, end) {
    let a = start
    while (a>-1 && content.charAt(a) !== "\n") a--
    a++
    return content.slice(a, end + 1)
}

