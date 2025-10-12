/**
 * AST-Based Bug Detector
 *
 * Production-grade bug detection using TypeScript AST parsing
 * instead of regex patterns for accuracy and reliability.
 */

import { ASTParser, TSESTree } from '../utils/ast-parser.js';
import { AST_NODE_TYPES } from '@typescript-eslint/typescript-estree';
import { logger } from '../utils/logger.js';

export interface BugIssue {
  file: string;
  line: number;
  column?: number;
  severity: 'error' | 'warning' | 'info';
  category: string;
  message: string;
  suggestion?: string;
  code?: string;
}

export class BugDetectorAST {
  private issues: BugIssue[] = [];

  async analyze(file: string, content: string): Promise<BugIssue[]> {
    this.issues = [];

    try {
      const ast = ASTParser.parse(content);
      if (!ast) {
        logger.debug(`Could not parse ${file}, skipping AST analysis`);
        return [];
      }

      // Run all AST-based detections
      this.detectEmptyCatchBlocks(file, ast);
      this.detectAsyncErrorHandling(file, ast);
      this.detectReactHookIssues(file, ast);
      this.detectUnhandledPromises(file, ast);
      this.detectResourceLeaks(file, ast);
      this.detectSecurityIssues(file, ast);
      this.detectLogicErrors(file, ast);
      this.detectTypeSafetyIssues(file, ast);
      this.detectComplexityIssues(file, ast);
      this.detectUnusedVariables(file, ast);

      return this.issues;
    } catch (error) {
      logger.error(`Error analyzing ${file}:`, error);
      return [];
    }
  }

  /**
   * Detect empty catch blocks that silently swallow errors
   */
  private detectEmptyCatchBlocks(file: string, ast: TSESTree.Program): void {
    const tryStatements = ASTParser.findTryCatchStatements(ast);

    for (const tryStmt of tryStatements) {
      if (!tryStmt.handler) continue;

      if (ASTParser.isCatchBlockEmpty(tryStmt.handler)) {
        this.addIssue(file, tryStmt.handler, 'warning', 'Error Handling',
          'Empty catch block silently swallows errors',
          'At minimum, log the error or add a comment explaining why it is safe to ignore'
        );
      }
    }
  }

  /**
   * Detect async functions without proper error handling
   */
  private detectAsyncErrorHandling(file: string, ast: TSESTree.Program): void {
    const asyncFunctions = ASTParser.findAsyncFunctions(ast);

    for (const func of asyncFunctions) {
      const hasAwait = this.hasAwaitExpression(func);
      if (!hasAwait) continue;

      const hasTryCatch = this.hasTryCatchInFunction(func);
      const hasCatchHandler = this.hasCatchHandler(func);

      if (!hasTryCatch && !hasCatchHandler) {
        this.addIssue(file, func, 'warning', 'Error Handling',
          'Async function with await but no error handling',
          'Add try-catch block or .catch() handler to handle promise rejections'
        );
      }
    }
  }

  /**
   * Detect React Hook issues (rules of hooks violations)
   */
  private detectReactHookIssues(file: string, ast: TSESTree.Program): void {
    if (!file.includes('component') && !file.includes('.tsx')) return;

    const hooks = ASTParser.findReactHooks(ast);

    for (const hook of hooks) {
      // Check for conditional hook calls
      if (this.isConditionallyExecuted(hook, ast)) {
        this.addIssue(file, hook, 'error', 'React Hooks',
          'Hook called conditionally - this breaks React rules',
          'Move hooks to top level of component, use conditional logic inside hook instead'
        );
      }

      // Check for hooks with missing dependencies
      if (this.isEffectHook(hook)) {
        const depsIssue = this.checkHookDependencies(hook);
        if (depsIssue) {
          this.addIssue(file, hook, 'warning', 'React Hooks',
            depsIssue,
            'Review if external variables should be in dependency array'
          );
        }
      }
    }
  }

  /**
   * Detect unhandled promises
   */
  private detectUnhandledPromises(file: string, ast: TSESTree.Program): void {
    const callExpressions = ASTParser.findCallExpressions(ast);

    for (const call of callExpressions) {
      // Check for Promise.all without error handling
      if (this.isPromiseAll(call)) {
        if (!this.hasErrorHandling(call, ast)) {
          this.addIssue(file, call, 'warning', 'Async/Await',
            'Promise.all without error handling - one failure rejects all',
            'Wrap in try-catch or add .catch() handler, or use Promise.allSettled'
          );
        }
      }

      // NOTE: Floating promise detection is intentionally disabled
      // Requires complex parent context analysis to avoid false positives
      // Consider re-enabling when AST parent traversal is implemented
    }
  }

  /**
   * Detect resource leaks (intervals, listeners, connections)
   */
  private detectResourceLeaks(file: string, ast: TSESTree.Program): void {
    const calls = ASTParser.findCallExpressions(ast);

    for (const call of calls) {
      const { callee } = call;

      // setInterval without clearInterval
      if (this.isCallTo(callee, 'setInterval')) {
        if (!this.hasCleanup(ast, 'clearInterval')) {
          this.addIssue(file, call, 'warning', 'Resource Leak',
            'setInterval without clearInterval may cause memory leak',
            'Store interval ID and clear it in cleanup function'
          );
        }
      }

      // addEventListener without removeEventListener
      if (this.isCallTo(callee, 'addEventListener')) {
        if (!this.hasCleanup(ast, 'removeEventListener')) {
          this.addIssue(file, call, 'warning', 'Resource Leak',
            'addEventListener without removeEventListener may cause memory leak',
            'Remove listener in cleanup function (e.g., useEffect return)'
          );
        }
      }
    }
  }

  /**
   * Detect security issues
   */
  private detectSecurityIssues(file: string, ast: TSESTree.Program): void {
    const calls = ASTParser.findCallExpressions(ast);

    for (const call of calls) {
      const { callee } = call;

      // Dangerous eval usage
      if (this.isCallTo(callee, 'eval')) {
        this.addIssue(file, call, 'error', 'Security',
          'eval() is dangerous and should be avoided',
          'Use safer alternatives like JSON.parse or new Function()'
        );
      }

      // SQL injection risk
      if (this.isCallTo(callee, 'query') || this.isCallTo(callee, 'execute')) {
        if (this.usesStringConcatenation(call)) {
          this.addIssue(file, call, 'error', 'Security',
            'Potential SQL injection - string concatenation in query',
            'Use parameterized queries or prepared statements'
          );
        }
      }

      // dangerouslySetInnerHTML
      if (this.hasProperty(call, 'dangerouslySetInnerHTML')) {
        if (!this.hasSanitization(ast)) {
          this.addIssue(file, call, 'error', 'Security',
            'dangerouslySetInnerHTML without sanitization - XSS risk',
            'Sanitize HTML content using DOMPurify or similar library'
          );
        }
      }
    }
  }

  /**
   * Detect logic errors
   */
  private detectLogicErrors(file: string, ast: TSESTree.Program): void {
    const nodes = ASTParser.findNodes(ast, (node): node is TSESTree.Node => true);

    for (const node of nodes) {
      // Assignment in if condition
      if (ASTParser.isNodeType(node, AST_NODE_TYPES.IfStatement)) {
        if ('test' in node && this.hasAssignmentInCondition(node.test)) {
          this.addIssue(file, node, 'error', 'Logic Error',
            'Assignment (=) in if condition instead of comparison (===)',
            'Use === for comparison or wrap assignment in parentheses if intentional'
          );
        }
      }

      // forEach with async callback
      if (ASTParser.isNodeType(node, AST_NODE_TYPES.CallExpression)) {
        if ('callee' in node && this.isCallTo(node.callee, 'forEach')) {
          if ('arguments' in node) {
            const callback = node.arguments[0];
            if (callback && ASTParser.isNodeType(callback, AST_NODE_TYPES.ArrowFunctionExpression)) {
              if ('async' in callback && callback.async) {
                this.addIssue(file, node, 'error', 'Logic Error',
                  'async callback in forEach does not wait for promises',
                  'Use for...of loop or Promise.all with map()'
                );
              }
            }
          }
        }
      }
    }
  }

  /**
   * Detect type safety issues
   */
  private detectTypeSafetyIssues(file: string, ast: TSESTree.Program): void {
    const nodes = ASTParser.findNodes(ast, (node): node is TSESTree.Node => true);

    for (const node of nodes) {
      // Excessive any usage
      if (ASTParser.isNodeType(node, AST_NODE_TYPES.TSAnyKeyword)) {
        // Skip API routes and utils where 'any' is more acceptable
        if (file.includes('/api/') || file.includes('/utils/') || file.startsWith('api/')) continue;

        this.addIssue(file, node, 'info', 'Type Safety',
          'Using "any" type defeats TypeScript benefits',
          'Define proper types or use "unknown" for better type safety'
        );
      }

      // Non-null assertion overuse
      if (ASTParser.isNodeType(node, AST_NODE_TYPES.TSNonNullExpression)) {
        this.addIssue(file, node, 'warning', 'Type Safety',
          'Non-null assertion may cause runtime error if value is null/undefined',
          'Add proper null checks or use optional chaining (?.)'
        );
      }
    }
  }

  /**
   * Detect complexity issues
   */
  private detectComplexityIssues(file: string, ast: TSESTree.Program): void {
    const functions = [
      ...ASTParser.findFunctions(ast),
      ...ASTParser.findArrowFunctions(ast),
    ];

    for (const func of functions) {
      const complexity = ASTParser.getFunctionComplexity(func);

      // More lenient for UI components
      const threshold = file.includes('/components/') || file.includes('/app/') ? 12 : 8;

      if (complexity > threshold) {
        const funcName = this.getFunctionName(func) || 'anonymous';
        this.addIssue(file, func, 'info', 'Code Complexity',
          `Function '${funcName}' has high complexity (${complexity})`,
          'Consider breaking down into smaller functions for better maintainability'
        );
      }
    }
  }

  /**
   * Detect unused variables
   */
  private detectUnusedVariables(file: string, ast: TSESTree.Program): void {
    const declarations = ASTParser.findNodes(ast, (node): node is TSESTree.VariableDeclarator =>
      ASTParser.isNodeType(node, AST_NODE_TYPES.VariableDeclarator)
    );

    for (const decl of declarations) {
      if (!ASTParser.isNodeType(decl.id, AST_NODE_TYPES.Identifier)) continue;

      if ('name' in decl.id) {
        const varName = decl.id.name;
        // Skip private variables, React props, and common patterns
        if (varName.startsWith('_') || varName === 'props' || varName === 'children') continue;

        if (!ASTParser.isIdentifierUsed(ast, varName)) {
          this.addIssue(file, decl, 'info', 'Dead Code',
            `Variable '${varName}' is declared but never used`,
            'Remove unused variable or prefix with _ if intentionally unused'
          );
        }
      }
    }
  }

  // Helper methods

  private addIssue(
    file: string,
    node: TSESTree.Node,
    severity: BugIssue['severity'],
    category: string,
    message: string,
    suggestion?: string
  ): void {
    this.issues.push({
      file,
      line: node.loc?.start.line ?? 0,
      column: node.loc?.start.column,
      severity,
      category,
      message,
      suggestion,
    });
  }

  private hasAwaitExpression(func: TSESTree.Node): boolean {
    const awaits = ASTParser.findNodes(func as any, (node): node is TSESTree.AwaitExpression =>
      ASTParser.isNodeType(node, AST_NODE_TYPES.AwaitExpression)
    );
    return awaits.length > 0;
  }

  private hasTryCatchInFunction(func: TSESTree.Node): boolean {
    const tries = ASTParser.findNodes(func as any, (node): node is TSESTree.TryStatement =>
      ASTParser.isNodeType(node, AST_NODE_TYPES.TryStatement)
    );
    return tries.length > 0;
  }

  private hasCatchHandler(func: TSESTree.Node): boolean {
    const calls = ASTParser.findNodes(func as any, (node): node is TSESTree.CallExpression =>
      ASTParser.isNodeType(node, AST_NODE_TYPES.CallExpression)
    );
    return calls.some(call =>
      ASTParser.isNodeType(call.callee, AST_NODE_TYPES.MemberExpression) &&
      'property' in call.callee &&
      ASTParser.isNodeType(call.callee.property, AST_NODE_TYPES.Identifier) &&
      'name' in call.callee.property &&
      call.callee.property.name === 'catch'
    );
  }

  private isConditionallyExecuted(node: TSESTree.Node, ast: TSESTree.Program): boolean {
    // This is a simplified check - a full implementation would traverse up the AST
    const ifs = ASTParser.findNodes(ast, (n): n is TSESTree.IfStatement =>
      ASTParser.isNodeType(n, AST_NODE_TYPES.IfStatement)
    );

    // Check if node is inside an if statement
    return ifs.some(ifStmt => this.nodeContains(ifStmt.consequent, node));
  }

  private nodeContains(parent: TSESTree.Node, child: TSESTree.Node): boolean {
    if (parent === child) return true;

    for (const key of Object.keys(parent)) {
      const value = (parent as any)[key];
      if (value && typeof value === 'object') {
        if (Array.isArray(value)) {
          if (value.some(v => v === child || (v.type && this.nodeContains(v, child)))) {
            return true;
          }
        } else if (value.type) {
          if (this.nodeContains(value, child)) return true;
        }
      }
    }

    return false;
  }

  private isEffectHook(call: TSESTree.CallExpression): boolean {
    const { callee } = call;
    if (ASTParser.isNodeType(callee, AST_NODE_TYPES.Identifier)) {
      if ('name' in callee) {
        return ['useEffect', 'useCallback', 'useMemo'].includes(callee.name);
      }
    }
    return false;
  }

  private checkHookDependencies(call: TSESTree.CallExpression): string | null {
    if (call.arguments.length < 2) return null;

    const depsArg = call.arguments[1];
    if (ASTParser.isNodeType(depsArg, AST_NODE_TYPES.ArrayExpression) && 'elements' in depsArg && depsArg.elements.length === 0) {
      // Check if the callback actually uses external variables
      const callback = call.arguments[0];
      if (callback && (ASTParser.isNodeType(callback, AST_NODE_TYPES.ArrowFunctionExpression) || ASTParser.isNodeType(callback, AST_NODE_TYPES.FunctionExpression))) {
        // Find all identifiers in the callback
        const identifiers = ASTParser.findNodes(callback as any, (node): node is TSESTree.Identifier =>
          ASTParser.isNodeType(node, AST_NODE_TYPES.Identifier)
        );

        // Filter to find potential dependencies (exclude built-ins and hook/setter functions)
        const builtIns = new Set(['console', 'log', 'error', 'warn', 'info', 'debug', 'window', 'document', 'Math', 'Date', 'JSON', 'localStorage', 'sessionStorage', 'undefined', 'null', 'true', 'false', 'Object', 'Array', 'String', 'Number', 'Boolean']);

        const externalRefs = identifiers.filter(id => {
          if (!('name' in id)) return false;
          const name = id.name;

          // Skip built-ins
          if (builtIns.has(name)) return false;

          // Skip React hooks (useState, useEffect, etc.)
          if (name.startsWith('use') && name[3] === name[3].toUpperCase()) return false;

          // Skip setter functions (setCount, setData, etc.)
          if (name.startsWith('set') && name[3] === name[3].toUpperCase()) return false;

          // Skip common JSX/HTML elements (must be common HTML tags, not variables)
          const htmlElements = new Set(['div', 'span', 'button', 'input', 'form', 'label', 'a', 'p', 'h1', 'h2', 'h3', 'img', 'ul', 'li', 'nav', 'header', 'footer', 'section']);
          if (htmlElements.has(name)) return false;

          return true;
        });

        // If using console.log('Mounted') with just a string literal, it's OK
        const callExpressions = ASTParser.findNodes(callback as any, (node): node is TSESTree.CallExpression =>
          ASTParser.isNodeType(node, AST_NODE_TYPES.CallExpression)
        );

        const isOnlyConsoleLogWithLiteral = callExpressions.length === 1 &&
          callExpressions.every(ce => {
            if (ASTParser.isNodeType(ce.callee, AST_NODE_TYPES.MemberExpression)) {
              const member = ce.callee;
              if (ASTParser.isNodeType(member.object, AST_NODE_TYPES.Identifier) &&
                  'name' in member.object && member.object.name === 'console') {
                // Check if arguments are all literals
                return ce.arguments.every(arg =>
                  ASTParser.isNodeType(arg, AST_NODE_TYPES.Literal) ||
                  ASTParser.isNodeType(arg, AST_NODE_TYPES.TemplateLiteral)
                );
              }
            }
            return false;
          });

        if (externalRefs.length > 0 && !isOnlyConsoleLogWithLiteral) {
          return 'Hook with empty dependency array may be missing dependencies';
        }
      }
    }

    return null;
  }

  private isPromiseAll(call: TSESTree.CallExpression): boolean {
    const { callee } = call;
    return (
      ASTParser.isNodeType(callee, AST_NODE_TYPES.MemberExpression) &&
      'object' in callee &&
      ASTParser.isNodeType(callee.object, AST_NODE_TYPES.Identifier) &&
      'name' in callee.object &&
      callee.object.name === 'Promise' &&
      'property' in callee &&
      ASTParser.isNodeType(callee.property, AST_NODE_TYPES.Identifier) &&
      'name' in callee.property &&
      callee.property.name === 'all'
    );
  }

  private hasErrorHandling(node: TSESTree.Node, ast: TSESTree.Program): boolean {
    // Check if the node is inside a try block
    const tryStatements = ASTParser.findTryCatchStatements(ast);
    const isInTryBlock = tryStatements.some(tryStmt =>
      this.nodeContains(tryStmt.block, node)
    );

    if (isInTryBlock) return true;

    // Check if has .catch() handler
    return this.hasCatchHandler(node);
  }

  // Removed: isPromiseReturningCall and isPromiseHandled
  // These were placeholders for floating promise detection but were disabled
  // to avoid false positives. Will re-implement when parent context analysis is available.

  private isCallTo(callee: TSESTree.Node, name: string): boolean {
    if (ASTParser.isNodeType(callee, AST_NODE_TYPES.Identifier)) {
      if ('name' in callee) {
        return callee.name === name;
      }
    }
    if (ASTParser.isNodeType(callee, AST_NODE_TYPES.MemberExpression)) {
      if ('property' in callee) {
        const { property } = callee;
        if (ASTParser.isNodeType(property, AST_NODE_TYPES.Identifier)) {
          if ('name' in property) {
            return property.name === name;
          }
        }
      }
    }
    return false;
  }

  private hasCleanup(ast: TSESTree.Program, cleanupFn: string): boolean {
    const calls = ASTParser.findCallExpressions(ast, cleanupFn);
    return calls.length > 0;
  }

  private usesStringConcatenation(call: TSESTree.CallExpression): boolean {
    // Check if arguments contain template literals or binary expressions
    return call.arguments.some(arg =>
      ASTParser.isNodeType(arg, AST_NODE_TYPES.TemplateLiteral) ||
      ASTParser.isNodeType(arg, AST_NODE_TYPES.BinaryExpression)
    );
  }

  private hasProperty(_call: TSESTree.CallExpression, _prop: string): boolean {
    // Simplified - would need to check JSX attributes
    return false;
  }

  private hasSanitization(ast: TSESTree.Program): boolean {
    const calls = ASTParser.findCallExpressions(ast);
    return calls.some(call =>
      this.isCallTo(call.callee, 'sanitize') ||
      this.isCallTo(call.callee, 'DOMPurify')
    );
  }

  private hasAssignmentInCondition(test: TSESTree.Expression): boolean {
    return ASTParser.isNodeType(test, AST_NODE_TYPES.AssignmentExpression);
  }

  private getFunctionName(func: TSESTree.FunctionDeclaration | TSESTree.ArrowFunctionExpression | TSESTree.FunctionExpression): string | null {
    if ('id' in func && func.id && ASTParser.isNodeType(func.id, AST_NODE_TYPES.Identifier)) {
      if ('name' in func.id) {
        return func.id.name;
      }
    }
    return null;
  }

  getIssues(): BugIssue[] {
    return this.issues;
  }

  getIssuesByCategory(): Record<string, BugIssue[]> {
    return this.issues.reduce(
      (acc, issue) => {
        if (!acc[issue.category]) acc[issue.category] = [];
        acc[issue.category].push(issue);
        return acc;
      },
      {} as Record<string, BugIssue[]>
    );
  }

  getSeverityCount(): { error: number; warning: number; info: number } {
    return {
      error: this.issues.filter((i) => i.severity === 'error').length,
      warning: this.issues.filter((i) => i.severity === 'warning').length,
      info: this.issues.filter((i) => i.severity === 'info').length,
    };
  }
}
