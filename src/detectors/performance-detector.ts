export interface PerformanceIssue {
  file: string;
  line: number;
  severity: 'critical' | 'moderate' | 'minor';
  category: string;
  message: string;
  suggestion: string;
  impact?: string;
}

export class PerformanceDetector {
  private issues: PerformanceIssue[] = [];

  async analyze(file: string, content: string): Promise<PerformanceIssue[]> {
    this.issues = [];

    const lines = content.split('\n');
    const isReactFile = content.includes('React') || content.includes('use');

    if (isReactFile) {
      this.detectReactPerformanceIssues(file, lines, content);
    }

    this.detectGeneralPerformanceIssues(file, lines);
    this.detectDatabasePerformanceIssues(file, lines);
    this.detectNetworkPerformanceIssues(file, lines);
    this.detectMemoryIssues(file, lines);

    return this.issues;
  }

  private detectReactPerformanceIssues(file: string, lines: string[], content: string): void {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Expensive operations without useMemo
      if (
        (trimmed.includes('.map(') ||
          trimmed.includes('.filter(') ||
          trimmed.includes('.reduce(') ||
          trimmed.includes('.sort(')) &&
        !trimmed.startsWith('const ') &&
        !trimmed.startsWith('let ') &&
        !trimmed.startsWith('return ')
      ) {
        // Check if inside render (between return and closing brace)
        const isInRender = this.isInsideRender(lines, i);
        const hasUseMemo = content.includes('useMemo');

        if (isInRender && !hasUseMemo && !file.includes('.test.')) {
          this.issues.push({
            file,
            line: i + 1,
            severity: 'moderate',
            category: 'React Performance',
            message: 'Array operation in render without useMemo',
            suggestion: 'Wrap expensive array operations in useMemo to avoid recalculation',
            impact: 'Re-computes on every render',
          });
        }
      }

      // Missing key prop in lists
      if (trimmed.includes('.map(') && i < lines.length - 5) {
        const mapBlock = lines.slice(i, i + 6).join('\n');
        if (mapBlock.includes('return <') && !mapBlock.includes('key=')) {
          this.issues.push({
            file,
            line: i + 1,
            severity: 'moderate',
            category: 'React Performance',
            message: 'Missing key prop in mapped component',
            suggestion: 'Add unique key prop to help React optimize re-renders',
            impact: 'Inefficient reconciliation',
          });
        }
      }

      // useState with object/array literal
      if (trimmed.includes('useState({') || trimmed.includes('useState([')) {
        this.issues.push({
          file,
          line: i + 1,
          severity: 'minor',
          category: 'React Performance',
          message: 'useState initialized with object/array literal',
          suggestion: 'Use lazy initialization: useState(() => ({...}))',
          impact: 'Creates new object on every render',
        });
      }

      // Context value without useMemo
      if (trimmed.includes('value={{') && !trimmed.includes('useMemo')) {
        // Check if this is a Context.Provider
        const prevLines = lines.slice(Math.max(0, i - 3), i).join('\n');
        if (prevLines.includes('.Provider') || line.includes('.Provider')) {
          this.issues.push({
            file,
            line: i + 1,
            severity: 'moderate',
            category: 'React Performance',
            message: 'Context value created inline causes all consumers to re-render',
            suggestion: 'Wrap context value in useMemo',
            impact: 'All context consumers re-render on every update',
          });
        }
      }

      // Expensive component without React.memo
      if (trimmed.match(/^export (default )?function \w+\(/)) {
        const componentSize = this.getComponentSize(lines, i);
        const hasComplexLogic = this.hasComplexLogic(lines.slice(i, i + componentSize));
        const hasMemo =
          lines
            .slice(Math.max(0, i - 3), i)
            .some((l) => l.includes('React.memo') || l.includes('memo(')) ||
          lines.slice(i, i + 5).some((l) => l.includes('React.memo') || l.includes('memo('));

        if (componentSize > 50 && hasComplexLogic && !hasMemo && !file.includes('page.tsx')) {
          this.issues.push({
            file,
            line: i + 1,
            severity: 'moderate',
            category: 'React Performance',
            message: 'Complex component without React.memo',
            suggestion: 'Wrap component with React.memo to prevent unnecessary re-renders',
            impact: 'Re-renders even when props haven\'t changed',
          });
        }
      }

      // Effect with missing dependencies
      if (trimmed.includes('useEffect(') && i < lines.length - 10) {
        const effectBlock = lines.slice(i, Math.min(i + 15, lines.length)).join('\n');

        // Check if deps array is empty but uses external variables
        if (effectBlock.includes('[]')) {
          const varUsage = effectBlock.match(/\b[a-z]\w*\./g) || [];
          if (varUsage.length > 3) {
            this.issues.push({
              file,
              line: i + 1,
              severity: 'moderate',
              category: 'React Performance',
              message: 'useEffect with empty deps but uses external variables',
              suggestion: 'Add dependencies or use useCallback for functions',
              impact: 'Stale closure - may use outdated values',
            });
          }
        }
      }
    }
  }

  private detectGeneralPerformanceIssues(file: string, lines: string[]): void {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Nested loops - only flag actual for/while loops, not .map/.filter
      if (trimmed.match(/for\s*\(/) || trimmed.match(/while\s*\(/)) {
        let nestedLoops = 0;
        const nextLines = lines.slice(i + 1, Math.min(i + 20, lines.length));

        for (const nextLine of nextLines) {
          // Only count actual loops, not functional array methods
          if (nextLine.match(/for\s*\(/) || nextLine.match(/while\s*\(/)) {
            nestedLoops++;
          }
        }

        if (nestedLoops >= 2) {
          this.issues.push({
            file,
            line: i + 1,
            severity: 'critical',
            category: 'Algorithm Performance',
            message: 'Nested loops detected - O(n²) or worse complexity',
            suggestion: 'Consider using hash maps or different data structure',
            impact: 'Performance degrades with data size',
          });
        }
      }

      // Inefficient array methods
      if (trimmed.includes('.indexOf(') && lines.slice(Math.max(0, i - 5), i).some((l) => l.includes('for (') || l.includes('.forEach('))) {
        this.issues.push({
          file,
          line: i + 1,
          severity: 'moderate',
          category: 'Algorithm Performance',
          message: 'indexOf in loop - O(n²) complexity',
          suggestion: 'Convert array to Set for O(1) lookup',
          impact: 'Slow for large arrays',
        });
      }

      // Creating objects in loops
      if (
        (trimmed.includes('new ') || trimmed.includes('{}') || trimmed.includes('[]')) &&
        this.isInsideLoop(lines, i)
      ) {
        const isSimpleAssignment = trimmed.match(/^(const|let|var)\s+\w+\s*=\s*(\[\]|\{\})/);
        if (!isSimpleAssignment) {
          this.issues.push({
            file,
            line: i + 1,
            severity: 'minor',
            category: 'Memory Performance',
            message: 'Object/array creation inside loop',
            suggestion: 'Consider reusing objects or creating outside loop',
            impact: 'Increased garbage collection',
          });
        }
      }

      // JSON.parse in loop or hot path
      if (trimmed.includes('JSON.parse(') && this.isInsideLoop(lines, i)) {
        this.issues.push({
          file,
          line: i + 1,
          severity: 'moderate',
          category: 'Performance',
          message: 'JSON.parse in loop is expensive',
          suggestion: 'Parse once before loop or cache results',
          impact: 'Slow parsing on each iteration',
        });
      }

      // Synchronous file operations
      if (
        (trimmed.includes('readFileSync') ||
          trimmed.includes('writeFileSync') ||
          trimmed.includes('existsSync')) &&
        !file.includes('/scripts/') &&
        !file.includes('.config.')
      ) {
        this.issues.push({
          file,
          line: i + 1,
          severity: 'critical',
          category: 'Performance',
          message: 'Synchronous file operation blocks event loop',
          suggestion: 'Use async versions (readFile, writeFile, etc.)',
          impact: 'Blocks all requests in production',
        });
      }

      // Regex in loop without caching
      if (trimmed.includes('new RegExp(') && this.isInsideLoop(lines, i)) {
        this.issues.push({
          file,
          line: i + 1,
          severity: 'moderate',
          category: 'Performance',
          message: 'RegExp compilation in loop',
          suggestion: 'Define regex outside loop',
          impact: 'Recompiles regex on each iteration',
        });
      }
    }
  }

  private detectDatabasePerformanceIssues(file: string, lines: string[]): void {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // N+1 query pattern
      if (
        (trimmed.includes('.map(') || trimmed.includes('.forEach(')) &&
        i < lines.length - 10
      ) {
        const loopBody = lines.slice(i, Math.min(i + 15, lines.length)).join('\n');

        if (
          loopBody.includes('await') &&
          (loopBody.includes('query') ||
            loopBody.includes('findOne') ||
            loopBody.includes('findById') ||
            loopBody.includes('.get('))
        ) {
          this.issues.push({
            file,
            line: i + 1,
            severity: 'critical',
            category: 'Database Performance',
            message: 'Potential N+1 query - database call in loop',
            suggestion: 'Use batch query (findMany, whereIn) or eager loading',
            impact: 'Makes N database queries instead of 1',
          });
        }
      }

      // Missing indexes hint
      if (
        (trimmed.includes('findMany({') || trimmed.includes('query(')) &&
        !trimmed.includes('where')
      ) {
        this.issues.push({
          file,
          line: i + 1,
          severity: 'minor',
          category: 'Database Performance',
          message: 'Query without where clause may need indexes',
          suggestion: 'Ensure proper indexes exist for this query',
          impact: 'Full table scan on large tables',
        });
      }

      // Select * pattern
      if (trimmed.includes('SELECT *') || trimmed.includes('select *')) {
        this.issues.push({
          file,
          line: i + 1,
          severity: 'moderate',
          category: 'Database Performance',
          message: 'SELECT * fetches all columns',
          suggestion: 'Select only needed columns',
          impact: 'Transfers unnecessary data',
        });
      }
    }
  }

  private detectNetworkPerformanceIssues(file: string, lines: string[]): void {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Fetch in loop
      if (trimmed.includes('fetch(') && this.isInsideLoop(lines, i)) {
        this.issues.push({
          file,
          line: i + 1,
          severity: 'critical',
          category: 'Network Performance',
          message: 'fetch() call inside loop',
          suggestion: 'Batch requests or use Promise.all',
          impact: 'Sequential network requests are slow',
        });
      }

      // Missing request caching
      if (
        (trimmed.includes('fetch(') || trimmed.includes('axios.get')) &&
        !file.includes('/cache')
      ) {
        const hasCache = lines
          .slice(Math.max(0, i - 10), i + 10)
          .some((l) => l.includes('cache') || l.includes('Cache') || l.includes('revalidate'));

        if (!hasCache && !file.includes('.test.')) {
          this.issues.push({
            file,
            line: i + 1,
            severity: 'minor',
            category: 'Network Performance',
            message: 'API request without caching',
            suggestion: 'Consider caching response if data doesn\'t change frequently',
            impact: 'Repeated network calls for same data',
          });
        }
      }

      // Large payload in request
      if (trimmed.includes('JSON.stringify(') && trimmed.includes('fetch(')) {
        this.issues.push({
          file,
          line: i + 1,
          severity: 'minor',
          category: 'Network Performance',
          message: 'Large JSON payload in request',
          suggestion: 'Consider compression or pagination for large data',
          impact: 'Slow upload/download times',
        });
      }
    }
  }

  private detectMemoryIssues(file: string, lines: string[]): void {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Large array allocation
      if (trimmed.match(/new Array\((\d+)\)/)) {
        const sizeMatch = trimmed.match(/new Array\((\d+)\)/);
        if (sizeMatch && parseInt(sizeMatch[1]) > 10000) {
          this.issues.push({
            file,
            line: i + 1,
            severity: 'moderate',
            category: 'Memory Performance',
            message: 'Large array allocation',
            suggestion: 'Consider streaming or pagination for large datasets',
            impact: 'High memory usage',
          });
        }
      }

      // Global variables
      if (trimmed.match(/^(let|var)\s+\w+\s*=/) && !trimmed.includes('const ')) {
        const scope = this.getScope(lines, i);
        if (scope === 'global') {
          this.issues.push({
            file,
            line: i + 1,
            severity: 'minor',
            category: 'Memory Performance',
            message: 'Global mutable variable',
            suggestion: 'Use const or limit scope to prevent memory leaks',
            impact: 'Potential memory leak',
          });
        }
      }

      // Closures with large objects
      if (
        (trimmed.includes('function(') || trimmed.includes('=>')) &&
        this.isInsideLoop(lines, i)
      ) {
        const hasLargeCapture = lines
          .slice(Math.max(0, i - 5), i)
          .some(
            (l) =>
              l.includes('const ') && (l.includes('[') || l.includes('{')) && l.length > 100
          );

        if (hasLargeCapture) {
          this.issues.push({
            file,
            line: i + 1,
            severity: 'minor',
            category: 'Memory Performance',
            message: 'Function closure captures large object in loop',
            suggestion: 'Extract only needed values or define function outside loop',
            impact: 'Increased memory usage',
          });
        }
      }
    }
  }

  // Helper methods
  private isInsideRender(lines: string[], currentLine: number): boolean {
    // Simple heuristic: between 'return (' and closing of component
    let foundReturn = false;

    for (let i = currentLine; i >= Math.max(0, currentLine - 30); i--) {
      if (lines[i].includes('return (') || lines[i].includes('return(')) {
        foundReturn = true;
        break;
      }
      if (lines[i].match(/^export (default )?function/)) {
        break;
      }
    }

    return foundReturn;
  }

  private isInsideLoop(lines: string[], currentLine: number): boolean {
    let braceCount = 0;

    for (let i = currentLine; i >= Math.max(0, currentLine - 30); i--) {
      const line = lines[i];
      braceCount += (line.match(/\}/g) || []).length;
      braceCount -= (line.match(/\{/g) || []).length;

      if (
        braceCount <= 0 &&
        (line.match(/for\s*\(/) ||
          line.includes('.forEach(') ||
          line.includes('.map(') ||
          line.includes('while ('))
      ) {
        return true;
      }
    }

    return false;
  }

  private getComponentSize(lines: string[], startLine: number): number {
    let braceCount = 0;

    for (let i = startLine; i < lines.length; i++) {
      const line = lines[i];
      braceCount += (line.match(/\{/g) || []).length;
      braceCount -= (line.match(/\}/g) || []).length;

      if (braceCount === 0 && i > startLine) {
        return i - startLine;
      }
    }

    return lines.length - startLine;
  }

  private hasComplexLogic(componentLines: string[]): boolean {
    const complexIndicators = componentLines.filter(
      (line) =>
        line.includes('useEffect') ||
        line.includes('useMemo') ||
        line.includes('useCallback') ||
        line.includes('useState') ||
        line.includes('.map(') ||
        line.includes('.filter(') ||
        line.match(/if\s*\(/)
    );

    return complexIndicators.length > 5;
  }

  private getScope(lines: string[], currentLine: number): 'global' | 'function' | 'block' {
    let braceCount = 0;

    for (let i = currentLine; i >= 0; i--) {
      const line = lines[i];
      braceCount += (line.match(/\}/g) || []).length;
      braceCount -= (line.match(/\{/g) || []).length;

      if (braceCount === 0 && (line.includes('function ') || line.includes('=>'))) {
        return 'function';
      }
    }

    return currentLine < 50 && braceCount === 0 ? 'global' : 'block';
  }

  getIssues(): PerformanceIssue[] {
    return this.issues;
  }

  getIssuesByCategory(): Record<string, PerformanceIssue[]> {
    return this.issues.reduce(
      (acc, issue) => {
        if (!acc[issue.category]) acc[issue.category] = [];
        acc[issue.category].push(issue);
        return acc;
      },
      {} as Record<string, PerformanceIssue[]>
    );
  }

  getSeverityCount(): { critical: number; moderate: number; minor: number } {
    return {
      critical: this.issues.filter((i) => i.severity === 'critical').length,
      moderate: this.issues.filter((i) => i.severity === 'moderate').length,
      minor: this.issues.filter((i) => i.severity === 'minor').length,
    };
  }
}
