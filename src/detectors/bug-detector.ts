export interface BugIssue {
  file: string;
  line: number;
  severity: 'error' | 'warning' | 'info';
  category: string;
  message: string;
  suggestion?: string;
}

export class BugDetector {
  private issues: BugIssue[] = [];

  async analyze(file: string, content: string): Promise<BugIssue[]> {
    this.issues = [];

    const lines = content.split('\n');

    // Run all bug detection checks
    this.detectReactHookIssues(file, lines);
    this.detectAsyncAwaitIssues(file, lines);
    this.detectTypeSafetyIssues(file, lines);
    this.detectErrorHandlingIssues(file, lines);
    this.detectResourceLeaks(file, lines);
    this.detectSecurityIssues(file, lines);
    this.detectPromiseIssues(file, lines);
    this.detectCommonLogicErrors(file, lines);
    this.detectReactPerformanceIssues(file, lines);

    return this.issues;
  }

  private detectReactHookIssues(file: string, lines: string[]): void {
    // Missing dependencies in useEffect
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // useEffect with empty deps but using external variables
      if (
        line.includes('useEffect(') ||
        line.includes('useCallback(') ||
        line.includes('useMemo(')
      ) {
        let hookBlock = '';
        let braceCount = 0;
        let foundStart = false;

        for (let j = i; j < Math.min(i + 30, lines.length); j++) {
          hookBlock += lines[j] + '\n';
          braceCount += (lines[j].match(/\{/g) || []).length;
          braceCount -= (lines[j].match(/\}/g) || []).length;

          if (lines[j].includes('(')) foundStart = true;
          if (foundStart && braceCount === 0) break;
        }

        // Check for missing deps
        const depsMatch = hookBlock.match(/\]\s*\)/);
        if (depsMatch && hookBlock.includes('[]')) {
          // Extract variables used in the hook
          const usedVars = hookBlock.match(/\b[a-z][a-zA-Z0-9]*\b(?=\(|\[|\.|\s)/g) || [];
          const hasExternalRefs = usedVars.some(
            (v) => !['console', 'set', 'get', 'return', 'const', 'let', 'var'].includes(v)
          );

          if (hasExternalRefs && hookBlock.includes('[]')) {
            this.issues.push({
              file,
              line: i + 1,
              severity: 'warning',
              category: 'React Hooks',
              message: 'useEffect/useCallback/useMemo with empty deps may be missing dependencies',
              suggestion: 'Review if external variables should be in dependency array',
            });
          }
        }
      }

      // Conditional hooks (hooks inside if statements)
      if ((line.includes('if (') || line.includes('if(')) && i < lines.length - 3) {
        const nextFewLines = lines.slice(i + 1, i + 5).join('\n');
        if (
          nextFewLines.includes('useState') ||
          nextFewLines.includes('useEffect') ||
          nextFewLines.includes('useCallback')
        ) {
          this.issues.push({
            file,
            line: i + 1,
            severity: 'error',
            category: 'React Hooks',
            message: 'Hook called conditionally - this breaks React rules',
            suggestion: 'Move hooks to top level of component',
          });
        }
      }
    }
  }

  private detectAsyncAwaitIssues(file: string, lines: string[]): void {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Async function without try-catch
      if (trimmed.startsWith('async ') || trimmed.includes('async function')) {
        let hasErrorHandling = false;
        let hasCatch = false;

        // Look ahead for error handling
        for (let j = i; j < Math.min(i + 40, lines.length); j++) {
          const nextLine = lines[j];
          if (nextLine.includes('try {') || nextLine.includes('try{')) hasErrorHandling = true;
          if (nextLine.includes('.catch(')) hasCatch = true;
        }

        // Only flag if it's not a simple one-liner or test file
        if (
          !hasErrorHandling &&
          !hasCatch &&
          !file.includes('.test.') &&
          !file.includes('/tests/') &&
          line.includes('{')
        ) {
          const functionContent = lines.slice(i, Math.min(i + 20, lines.length)).join('\n');
          const hasAwait = functionContent.includes('await');

          if (hasAwait) {
            this.issues.push({
              file,
              line: i + 1,
              severity: 'warning',
              category: 'Error Handling',
              message: 'Async function missing error handling',
              suggestion: 'Add try-catch block or .catch() handler',
            });
          }
        }
      }

      // Floating promises (await missing)
      if (
        trimmed.match(/^\s*(const|let|var)?\s*\w+\s*=\s*fetch\(/) ||
        (trimmed.includes('.then(') && !trimmed.includes('await') && !trimmed.includes('return'))
      ) {
        if (!trimmed.includes('await') && !trimmed.includes('.catch(')) {
          this.issues.push({
            file,
            line: i + 1,
            severity: 'warning',
            category: 'Async/Await',
            message: 'Unhandled promise - missing await or .catch()',
            suggestion: 'Add await or .catch() to handle promise rejection',
          });
        }
      }

      // Promise constructor anti-pattern
      if (trimmed.includes('return new Promise(') && trimmed.includes('async')) {
        this.issues.push({
          file,
          line: i + 1,
          severity: 'info',
          category: 'Async/Await',
          message: 'Async function returning new Promise() is redundant',
          suggestion: 'Remove Promise wrapper, async functions return promises automatically',
        });
      }
    }
  }

  private detectTypeSafetyIssues(file: string, lines: string[]): void {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Excessive use of 'any' - but be lenient in API routes and utility files
      // These often deal with external data where 'any' is acceptable
      const isApiOrUtil =
        file.includes('/api/') ||
        file.includes('/utils/') ||
        file.includes('/lib/') ||
        file.includes('Schema') ||
        file.includes('validation');

      if (
        trimmed.includes(': any') &&
        !trimmed.includes('// @ts-expect-error') &&
        !isApiOrUtil &&
        !trimmed.includes('Record<string, any>') // Common pattern for JSON
      ) {
        this.issues.push({
          file,
          line: i + 1,
          severity: 'info', // Downgrade from warning to info
          category: 'Type Safety',
          message: 'Using "any" type defeats TypeScript benefits',
          suggestion: 'Define proper types or use "unknown" for better type safety',
        });
      }

      // Non-null assertion operator overuse
      const nonNullCount =
        (trimmed.match(/!\./g) || []).length + (trimmed.match(/!\[/g) || []).length;
      if (nonNullCount >= 2) {
        this.issues.push({
          file,
          line: i + 1,
          severity: 'warning',
          category: 'Type Safety',
          message: 'Multiple non-null assertions - potential runtime error',
          suggestion: 'Add proper null checks or use optional chaining (?.)',
        });
      }

      // Type assertions (as keyword) - potential issues
      if (trimmed.includes(' as ') && !trimmed.includes(' as const')) {
        const hasUnsafeAssertion =
          trimmed.includes(' as any') ||
          trimmed.includes(' as unknown') ||
          trimmed.includes('as Record<');

        if (hasUnsafeAssertion) {
          this.issues.push({
            file,
            line: i + 1,
            severity: 'info',
            category: 'Type Safety',
            message: 'Type assertion may hide type errors',
            suggestion: 'Consider using type guards or proper type definitions',
          });
        }
      }
    }
  }

  private detectErrorHandlingIssues(file: string, lines: string[]): void {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Empty catch blocks
      if (trimmed.includes('catch') && i < lines.length - 2) {
        // Check for .catch() with arrow function that has error handling
        if (trimmed.includes('.catch(')) {
          // .catch(() => console.error(...)) is valid error handling
          if (trimmed.includes('console.error') || trimmed.includes('console.warn')) {
            continue; // Skip - this has error handling
          }
        }

        const nextLine = lines[i + 1].trim();
        const lineAfter = i + 2 < lines.length ? lines[i + 2].trim() : '';

        // Check for empty try-catch blocks (not .catch())
        if (
          !trimmed.includes('.catch(') &&
          (nextLine === '}' || (nextLine === '{' && lineAfter === '}')) &&
          !file.includes('/tests/')
        ) {
          this.issues.push({
            file,
            line: i + 1,
            severity: 'warning',
            category: 'Error Handling',
            message: 'Empty catch block silently swallows errors',
            suggestion:
              'At minimum, log the error or add a comment explaining why it is safe to ignore',
          });
        }
      }

      // Generic error messages
      if (
        trimmed.includes("throw new Error('Error')") ||
        trimmed.includes('throw new Error("Error")')
      ) {
        this.issues.push({
          file,
          line: i + 1,
          severity: 'info',
          category: 'Error Handling',
          message: 'Generic error message is not helpful for debugging',
          suggestion: 'Provide descriptive error message with context',
        });
      }

      // Console.error without actual error handling
      if (trimmed.startsWith('console.error(') && !file.includes('/scripts/')) {
        const prevLine = i > 0 ? lines[i - 1].trim() : '';
        const nextLine = i < lines.length - 1 ? lines[i + 1].trim() : '';

        if (!prevLine.includes('catch') && !nextLine.includes('throw')) {
          this.issues.push({
            file,
            line: i + 1,
            severity: 'info',
            category: 'Error Handling',
            message: 'console.error without proper error handling',
            suggestion: 'Consider throwing error or returning error state',
          });
        }
      }
    }
  }

  private detectResourceLeaks(file: string, lines: string[]): void {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // setInterval without clearInterval
      if (line.includes('setInterval(')) {
        let hasCleanup = false;

        // Look for cleanup in useEffect or component
        for (let j = Math.max(0, i - 20); j < Math.min(i + 30, lines.length); j++) {
          if (lines[j].includes('clearInterval')) hasCleanup = true;
        }

        if (!hasCleanup) {
          this.issues.push({
            file,
            line: i + 1,
            severity: 'warning',
            category: 'Resource Leak',
            message: 'setInterval without clearInterval may cause memory leak',
            suggestion: 'Add cleanup in useEffect return or component unmount',
          });
        }
      }

      // addEventListener without removeEventListener
      if (line.includes('.addEventListener(')) {
        let hasCleanup = false;

        for (let j = Math.max(0, i - 20); j < Math.min(i + 30, lines.length); j++) {
          if (lines[j].includes('removeEventListener')) hasCleanup = true;
        }

        if (!hasCleanup && file.includes('component')) {
          this.issues.push({
            file,
            line: i + 1,
            severity: 'warning',
            category: 'Resource Leak',
            message: 'addEventListener without removeEventListener may cause memory leak',
            suggestion: 'Remove listener in cleanup function',
          });
        }
      }

      // Database connections without close
      if (
        (line.includes('createConnection') || line.includes('connect(')) &&
        !file.includes('/lib/')
      ) {
        let hasClose = false;

        for (let j = i; j < Math.min(i + 50, lines.length); j++) {
          if (lines[j].includes('.close(') || lines[j].includes('.end(')) hasClose = true;
        }

        if (!hasClose) {
          this.issues.push({
            file,
            line: i + 1,
            severity: 'warning',
            category: 'Resource Leak',
            message: 'Connection opened but never closed',
            suggestion: 'Ensure connection is properly closed in finally block',
          });
        }
      }
    }
  }

  private detectSecurityIssues(file: string, lines: string[]): void {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Potential SQL injection
      if (
        (trimmed.includes('query(') || trimmed.includes('execute(')) &&
        (trimmed.includes('${') || trimmed.includes('" + ') || trimmed.includes("' + "))
      ) {
        this.issues.push({
          file,
          line: i + 1,
          severity: 'error',
          category: 'Security',
          message: 'Potential SQL injection - string concatenation in query',
          suggestion: 'Use parameterized queries or prepared statements',
        });
      }

      // Eval usage
      if (trimmed.includes('eval(') && !file.includes('/tests/')) {
        this.issues.push({
          file,
          line: i + 1,
          severity: 'error',
          category: 'Security',
          message: 'eval() is dangerous and should be avoided',
          suggestion: 'Use safer alternatives like JSON.parse or Function constructor',
        });
      }

      // dangerouslySetInnerHTML without sanitization
      if (trimmed.includes('dangerouslySetInnerHTML')) {
        const hasSanitization = lines
          .slice(Math.max(0, i - 5), i)
          .some((l) => l.includes('sanitize') || l.includes('DOMPurify'));

        if (!hasSanitization) {
          this.issues.push({
            file,
            line: i + 1,
            severity: 'error',
            category: 'Security',
            message: 'dangerouslySetInnerHTML without sanitization - XSS risk',
            suggestion: 'Sanitize HTML content using DOMPurify or similar',
          });
        }
      }

      // Hardcoded secrets patterns
      const secretPatterns = [
        { pattern: /api[_-]?key\s*=\s*["'][^"'\s]+["']/i, name: 'API key' },
        { pattern: /secret\s*=\s*["'][^"'\s]{10,}["']/i, name: 'secret' },
        { pattern: /password\s*=\s*["'][^"'\s]+["']/i, name: 'password' },
        { pattern: /token\s*=\s*["'][^"'\s]{20,}["']/i, name: 'token' },
      ];

      for (const { pattern, name } of secretPatterns) {
        if (
          pattern.test(trimmed) &&
          !trimmed.includes('process.env') &&
          !trimmed.includes('TODO') &&
          !trimmed.includes('example')
        ) {
          this.issues.push({
            file,
            line: i + 1,
            severity: 'error',
            category: 'Security',
            message: `Hardcoded ${name} detected`,
            suggestion: 'Move sensitive data to environment variables',
          });
        }
      }
    }
  }

  private detectPromiseIssues(file: string, lines: string[]): void {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Promise.all without error handling
      if (trimmed.includes('Promise.all(') || trimmed.includes('Promise.allSettled(')) {
        const hasErrorHandling =
          trimmed.includes('await') ||
          trimmed.includes('.catch(') ||
          (i > 0 && lines[i - 1].includes('try'));

        if (!hasErrorHandling && !file.includes('/tests/')) {
          this.issues.push({
            file,
            line: i + 1,
            severity: 'warning',
            category: 'Async/Await',
            message: 'Promise.all without error handling',
            suggestion: 'Wrap in try-catch or add .catch() handler',
          });
        }
      }

      // Sequential awaits that could be parallel
      if (trimmed.startsWith('await ') && i < lines.length - 1) {
        const nextLine = lines[i + 1].trim();
        if (nextLine.startsWith('await ')) {
          // Check if they're independent
          const currentVar = trimmed.match(/await\s+(\w+)/)?.[1];
          const nextVar = nextLine.match(/await\s+(\w+)/)?.[1];

          if (currentVar !== nextVar && !nextLine.includes(currentVar || '___')) {
            this.issues.push({
              file,
              line: i + 1,
              severity: 'info',
              category: 'Performance',
              message: 'Sequential awaits could be parallelized',
              suggestion: 'Consider using Promise.all() for independent async operations',
            });
          }
        }
      }
    }
  }

  private detectCommonLogicErrors(file: string, lines: string[]): void {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Assignment in if condition
      if (
        trimmed.match(/if\s*\([^=]*=\s*[^=]/) &&
        !trimmed.includes('==') &&
        !trimmed.includes('===') &&
        !trimmed.includes('>=') &&
        !trimmed.includes('<=') &&
        !trimmed.includes('!=')
      ) {
        this.issues.push({
          file,
          line: i + 1,
          severity: 'error',
          category: 'Logic Error',
          message: 'Assignment (=) in if condition instead of comparison (===)',
          suggestion: 'Use === for comparison or wrap assignment in parentheses if intentional',
        });
      }

      // Comparing to boolean literals
      if (
        trimmed.match(/===\s*(true|false)\b/) ||
        trimmed.match(/\b(true|false)\s*===/) ||
        trimmed.match(/==\s*(true|false)\b/)
      ) {
        this.issues.push({
          file,
          line: i + 1,
          severity: 'info',
          category: 'Code Quality',
          message: 'Comparing to boolean literal is redundant',
          suggestion: 'Use the boolean directly or negate it with !',
        });
      }

      // Array.forEach with async
      if (trimmed.includes('.forEach(async') || trimmed.includes('.forEach( async')) {
        this.issues.push({
          file,
          line: i + 1,
          severity: 'error',
          category: 'Logic Error',
          message: 'async callback in forEach does not wait for promises',
          suggestion: 'Use for...of loop or Promise.all with map()',
        });
      }

      // Unreachable code after return - skip Next.js server components (early returns are normal)
      if (
        trimmed.startsWith('return ') &&
        i < lines.length - 1 &&
        !file.includes('/app/') && // Skip Next.js app directory
        !file.includes('/pages/') // Skip Next.js pages directory
      ) {
        const nextLine = lines[i + 1].trim();
        if (
          nextLine &&
          !nextLine.startsWith('}') &&
          !nextLine.startsWith('//') &&
          !nextLine.startsWith('/*') &&
          !nextLine.startsWith('case ') && // Skip switch cases
          !nextLine.startsWith('default:') // Skip default cases
        ) {
          const nextNonEmpty = lines
            .slice(i + 1)
            .find((l) => l.trim() && !l.trim().startsWith('//'));
          if (nextNonEmpty && !nextNonEmpty.trim().startsWith('}')) {
            this.issues.push({
              file,
              line: i + 2,
              severity: 'warning',
              category: 'Logic Error',
              message: 'Unreachable code after return statement',
              suggestion: 'Remove unreachable code or fix control flow',
            });
          }
        }
      }
    }
  }

  private detectReactPerformanceIssues(file: string, lines: string[]): void {
    if (!file.includes('component') && !file.includes('/app/')) return;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Inline object in JSX props
      if (trimmed.includes('={') && trimmed.includes('}') && trimmed.match(/\w+={{/)) {
        this.issues.push({
          file,
          line: i + 1,
          severity: 'info',
          category: 'React Performance',
          message: 'Inline object creation in JSX causes re-renders',
          suggestion: 'Extract to useMemo or move outside component',
        });
      }

      // Inline function in JSX props
      if (
        trimmed.match(/\w+={(\(|function)/) ||
        trimmed.match(/\w+={\s*\(\s*\)\s*=>/) ||
        trimmed.match(/\w+={async\s*\(/)
      ) {
        this.issues.push({
          file,
          line: i + 1,
          severity: 'info',
          category: 'React Performance',
          message: 'Inline function in JSX causes re-renders',
          suggestion: 'Extract to useCallback or component method',
        });
      }

      // Large component without React.memo
      if (trimmed.match(/^export (default )?function \w+\(/)) {
        const componentLines = lines.slice(i, Math.min(i + 200, lines.length));
        const hasJSX = componentLines.some((l) => l.includes('return (') || l.includes('return <'));
        const componentSize = componentLines.findIndex((l) => l.trim() === '}');

        if (hasJSX && componentSize > 100) {
          const hasMemo = lines.slice(Math.max(0, i - 2), i).some((l) => l.includes('React.memo'));

          if (!hasMemo) {
            this.issues.push({
              file,
              line: i + 1,
              severity: 'info',
              category: 'React Performance',
              message: 'Large component without React.memo may cause unnecessary re-renders',
              suggestion: 'Consider wrapping with React.memo if props are stable',
            });
          }
        }
      }
    }
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
