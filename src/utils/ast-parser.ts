import { parse, TSESTree, AST_NODE_TYPES } from '@typescript-eslint/typescript-estree';
import { logger } from './logger.js';

export interface ASTParseOptions {
  jsx?: boolean;
  loc?: boolean;
  range?: boolean;
  tokens?: boolean;
  comment?: boolean;
}

export class ASTParser {
  /**
   * Parse TypeScript/JavaScript code into an AST
   */
  static parse(
    code: string,
    options: ASTParseOptions = {}
  ): TSESTree.Program | null {
    try {
      return parse(code, {
        jsx: options.jsx ?? true,
        loc: options.loc ?? true,
        range: options.range ?? true,
        tokens: options.tokens ?? false,
        comment: options.comment ?? false,
        errorOnUnknownASTType: false,
        errorOnTypeScriptSyntacticAndSemanticIssues: false,
      });
    } catch (error) {
      logger.debug(`Failed to parse code: ${error}`);
      return null;
    }
  }

  /**
   * Traverse AST and find nodes matching a predicate
   */
  static findNodes<T extends TSESTree.Node>(
    ast: TSESTree.Program,
    predicate: (node: TSESTree.Node) => node is T
  ): T[] {
    const results: T[] = [];

    function traverse(node: TSESTree.Node | null | undefined) {
      if (!node) return;

      if (predicate(node)) {
        results.push(node);
      }

      // Traverse children
      for (const key of Object.keys(node)) {
        const value = (node as any)[key];
        if (value && typeof value === 'object') {
          if (Array.isArray(value)) {
            value.forEach(traverse);
          } else if (value.type) {
            traverse(value);
          }
        }
      }
    }

    traverse(ast);
    return results;
  }

  /**
   * Check if node is a specific type
   */
  static isNodeType<T extends AST_NODE_TYPES>(
    node: TSESTree.Node,
    type: T
  ): node is Extract<TSESTree.Node, { type: T }> {
    return node.type === type;
  }

  /**
   * Find all function declarations
   */
  static findFunctions(ast: TSESTree.Program): TSESTree.FunctionDeclaration[] {
    return this.findNodes(ast, (node): node is TSESTree.FunctionDeclaration =>
      this.isNodeType(node, AST_NODE_TYPES.FunctionDeclaration)
    );
  }

  /**
   * Find all arrow functions
   */
  static findArrowFunctions(ast: TSESTree.Program): TSESTree.ArrowFunctionExpression[] {
    return this.findNodes(ast, (node): node is TSESTree.ArrowFunctionExpression =>
      this.isNodeType(node, AST_NODE_TYPES.ArrowFunctionExpression)
    );
  }

  /**
   * Find all try-catch statements
   */
  static findTryCatchStatements(ast: TSESTree.Program): TSESTree.TryStatement[] {
    return this.findNodes(ast, (node): node is TSESTree.TryStatement =>
      this.isNodeType(node, AST_NODE_TYPES.TryStatement)
    );
  }

  /**
   * Find all async functions
   */
  static findAsyncFunctions(ast: TSESTree.Program): (TSESTree.FunctionDeclaration | TSESTree.ArrowFunctionExpression | TSESTree.FunctionExpression)[] {
    return this.findNodes(ast, (node): node is TSESTree.FunctionDeclaration | TSESTree.ArrowFunctionExpression | TSESTree.FunctionExpression => {
      return (
        (this.isNodeType(node, AST_NODE_TYPES.FunctionDeclaration) ||
          this.isNodeType(node, AST_NODE_TYPES.ArrowFunctionExpression) ||
          this.isNodeType(node, AST_NODE_TYPES.FunctionExpression)) &&
        'async' in node && node.async === true
      );
    });
  }

  /**
   * Find all React hooks (useState, useEffect, etc.)
   */
  static findReactHooks(ast: TSESTree.Program): TSESTree.CallExpression[] {
    return this.findNodes(ast, (node): node is TSESTree.CallExpression => {
      if (!this.isNodeType(node, AST_NODE_TYPES.CallExpression)) return false;

      const { callee } = node;
      if (this.isNodeType(callee, AST_NODE_TYPES.Identifier)) {
        return /^use[A-Z]/.test(callee.name);
      }
      return false;
    });
  }

  /**
   * Find all CallExpressions matching a pattern
   */
  static findCallExpressions(
    ast: TSESTree.Program,
    pattern?: string | RegExp
  ): TSESTree.CallExpression[] {
    const calls = this.findNodes(ast, (node): node is TSESTree.CallExpression =>
      this.isNodeType(node, AST_NODE_TYPES.CallExpression)
    );

    if (!pattern) return calls;

    return calls.filter((call) => {
      const { callee } = call;
      if (this.isNodeType(callee, AST_NODE_TYPES.Identifier)) {
        return typeof pattern === 'string'
          ? callee.name === pattern
          : pattern.test(callee.name);
      }
      if (this.isNodeType(callee, AST_NODE_TYPES.MemberExpression)) {
        const { property } = callee;
        if (this.isNodeType(property, AST_NODE_TYPES.Identifier)) {
          return typeof pattern === 'string'
            ? property.name === pattern
            : pattern.test(property.name);
        }
      }
      return false;
    });
  }

  /**
   * Check if a catch block is empty
   */
  static isCatchBlockEmpty(catchClause: TSESTree.CatchClause): boolean {
    return catchClause.body.body.length === 0;
  }

  /**
   * Get function complexity (cyclomatic complexity)
   */
  static getFunctionComplexity(func: TSESTree.FunctionDeclaration | TSESTree.FunctionExpression | TSESTree.ArrowFunctionExpression): number {
    let complexity = 1; // Base complexity

    const incrementNodes = [
      'IfStatement',
      'ForStatement',
      'ForInStatement',
      'ForOfStatement',
      'WhileStatement',
      'DoWhileStatement',
      'SwitchCase',
      'CatchClause',
      'ConditionalExpression',
      'LogicalExpression',
    ];

    function traverse(node: TSESTree.Node | null | undefined) {
      if (!node) return;

      if (incrementNodes.includes(node.type)) {
        complexity++;
      }

      for (const key of Object.keys(node)) {
        const value = (node as any)[key];
        if (value && typeof value === 'object') {
          if (Array.isArray(value)) {
            value.forEach(traverse);
          } else if (value.type) {
            traverse(value);
          }
        }
      }
    }

    traverse(func.body);
    return complexity;
  }

  /**
   * Extract imports from file
   */
  static findImports(ast: TSESTree.Program): TSESTree.ImportDeclaration[] {
    return ast.body.filter((node): node is TSESTree.ImportDeclaration =>
      this.isNodeType(node, AST_NODE_TYPES.ImportDeclaration)
    );
  }

  /**
   * Check if identifier is referenced in scope
   */
  static isIdentifierUsed(ast: TSESTree.Program, identifier: string): boolean {
    const identifiers = this.findNodes(ast, (node): node is TSESTree.Identifier =>
      this.isNodeType(node, AST_NODE_TYPES.Identifier) && 'name' in node && node.name === identifier
    );
    // If found more than once (once for declaration, rest for usage)
    return identifiers.length > 1;
  }
}

export type { TSESTree };
