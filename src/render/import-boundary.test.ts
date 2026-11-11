import { readdirSync, readFileSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { expect, it } from 'vitest';

const src = fileURLToPath(new URL('../', import.meta.url));

function sourcePath(sourceRoot: string, dependency: string): string {
  return relative(sourceRoot, dependency).split(sep).join('/');
}

function isRenderDependency(sourceRoot: string, dependency: string): boolean {
  return /^(?:render\/|model\/|trace\/|search\/contract(?:\.(?:ts|js))?$)/.test(sourcePath(sourceRoot, dependency));
}

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
      expect(isRenderDependency(src, dependency), `${file} imports ${dependency}`).toBe(true);
    }
  }
});

it('keeps generation and search independent of render and controller', () => {
  for (const file of [...sources(resolve(src, 'generate')), ...sources(resolve(src, 'search'))]) {
    for (const dependency of imports(file)) expect(sourcePath(src, dependency)).not.toMatch(/^(render|controller)(\/|$)/);
  }
});

it.each(['checkout(copy)', 'checkout[copy]', 'checkout+copy', 'checkout.copy'])('checks boundaries inside %s without interpreting the checkout path', checkout => {
  const sourceRoot = resolve(checkout, 'src');
  for (const allowed of ['render/layout.ts', 'model/wall-maze', 'trace/trace-state', 'search/contract', 'search/contract.ts', 'search/contract.js']) {
    expect(isRenderDependency(sourceRoot, resolve(sourceRoot, allowed))).toBe(true);
  }
  for (const forbidden of ['search/bfs', 'search/astar', 'search/registry', 'search/contract-extra', 'controller/controller', '../other/src/model/wall-maze']) {
    expect(isRenderDependency(sourceRoot, resolve(sourceRoot, forbidden))).toBe(false);
  }
});
