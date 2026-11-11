import { readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { expect, it } from 'vitest';

const src = fileURLToPath(new URL('../', import.meta.url));
function sources(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? sources(path) : path.endsWith('.ts') && !path.endsWith('.test.ts') ? [path] : [];
  });
}

/** Inspect static imports, re-exports and literal dynamic imports/require calls. */
function imports(file: string): string[] {
  const tree = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  const paths: string[] = [];
  function visit(node: ts.Node): void {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      paths.push(node.moduleSpecifier.text);
    }
    if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || node.expression.getText(tree) === 'require')) {
      const argument = node.arguments[0];
      if (argument && ts.isStringLiteralLike(argument)) paths.push(argument.text);
    }
    ts.forEachChild(node, visit);
  }
  visit(tree);
  return paths.map(path => resolve(dirname(file), path));
}

it('keeps render dependent only on render, model, trace and search contract', () => {
  for (const file of sources(resolve(src, 'render'))) {
    for (const dependency of imports(file)) {
      expect(dependency, `${file} imports ${dependency}`).toMatch(new RegExp(`^${src}(?:render/|model/|trace/|search/contract(?:\\.ts)?$)`));
    }
  }
});

it('keeps generation and search independent of render and controller', () => {
  for (const file of [...sources(resolve(src, 'generate')), ...sources(resolve(src, 'search'))]) {
    for (const dependency of imports(file)) expect(dependency).not.toMatch(/\/src\/(render|controller)(\/|$)/);
  }
});
