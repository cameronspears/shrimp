export interface NextJSIssue {
  file: string;
  line?: number;
  category: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  suggestion: string;
  bestPractice: string;
}

export class NextJSDetector {
  private issues: NextJSIssue[] = [];

  async analyzeFile(file: string, content: string): Promise<void> {
    const lines = content.split('\n');

    // Skip non-Next.js related files
    if (
      file.includes('/node_modules/') ||
      file.includes('/.next/') ||
      file.includes('/scripts/') ||
      file.includes('/tests/')
    ) {
      return;
    }

    this.detectImageOptimization(file, lines);
    this.detectServerClientPatterns(file, lines, content);
    this.detectMetadataPatterns(file, lines);
    this.detectCachingPatterns(file, lines);
    this.detectRouteHandlerPatterns(file, lines);
    this.detectDataFetchingPatterns(file, lines, content);
    this.detectErrorHandlingPatterns(file);
    this.detectFontOptimization(file, lines);
    this.detectRuntimeConfig(file, lines);
  }

  private detectImageOptimization(file: string, lines: string[]): void {
    // Check for <img> tags in components
    if (file.endsWith('.tsx') || file.endsWith('.jsx')) {
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Skip if it's in emails directory (emails can use <img>)
        if (file.includes('/emails/')) continue;

        if (line.includes('<img') && !line.includes('next/image')) {
          this.issues.push({
            file,
            line: i + 1,
            category: 'Image Optimization',
            severity: 'warning',
            message: 'Using <img> tag instead of next/image',
            suggestion: "Use Next.js Image component: import Image from 'next/image'",
            bestPractice: 'https://nextjs.org/docs/app/api-reference/components/image',
          });
        }
      }
    }
  }

  private detectServerClientPatterns(file: string, lines: string[], content: string): void {
    // Only check app directory files
    if (!file.includes('/app/') || !file.endsWith('.tsx')) return;

    // Check for actual 'use client' directives (not in comments)
    const hasUseClient = lines.some(
      (line) =>
        !line.trim().startsWith('//') &&
        !line.trim().startsWith('/*') &&
        (line.includes("'use client'") || line.includes('"use client"'))
    );
    const hasUseServer = lines.some(
      (line) =>
        !line.trim().startsWith('//') &&
        !line.trim().startsWith('/*') &&
        (line.includes("'use server'") || line.includes('"use server"'))
    );

    // Check for unnecessary 'use client'
    if (hasUseClient) {
      const hasInteractivity = [
        'useState',
        'useEffect',
        'useCallback',
        'useMemo',
        'useRef',
        'onClick',
        'onChange',
        'onSubmit',
        'useContext',
        'useReducer',
      ].some((pattern) => content.includes(pattern));

      const hasBrowserAPI = ['window.', 'document.', 'localStorage', 'sessionStorage'].some(
        (pattern) => content.includes(pattern)
      );

      if (!hasInteractivity && !hasBrowserAPI) {
        this.issues.push({
          file,
          category: 'Server Components',
          severity: 'info',
          message: "Component uses 'use client' but has no interactivity",
          suggestion: 'Consider removing "use client" to make this a Server Component',
          bestPractice: 'https://nextjs.org/docs/app/getting-started/server-and-client-components',
        });
      }
    }

    // Check if Server Component is doing client-side operations
    if (!hasUseClient && !hasUseServer) {
      const hasClientOnlyCode = ['useEffect', 'useState', 'onClick', 'onChange'].some((pattern) =>
        content.includes(pattern)
      );

      if (hasClientOnlyCode) {
        this.issues.push({
          file,
          category: 'Server Components',
          severity: 'error',
          message: 'Server Component using client-side hooks/events',
          suggestion: 'Add "use client" directive at the top of the file',
          bestPractice: 'https://nextjs.org/docs/app/getting-started/server-and-client-components',
        });
      }
    }
  }

  private detectMetadataPatterns(file: string, lines: string[]): void {
    // Check app directory page and layout files
    if (
      (file.includes('/app/') && (file.endsWith('page.tsx') || file.endsWith('layout.tsx'))) ||
      file.includes('/(marketing)/')
    ) {
      const hasMetadataExport = lines.some(
        (line) =>
          line.includes('export const metadata') ||
          line.includes('export async function generateMetadata')
      );

      if (!hasMetadataExport) {
        this.issues.push({
          file,
          category: 'Metadata & SEO',
          severity: 'warning',
          message: 'Page/Layout missing metadata export',
          suggestion:
            'Export metadata object for better SEO: export const metadata: Metadata = {...}',
          bestPractice: 'https://nextjs.org/docs/app/getting-started/metadata-and-og-images',
        });
      }
    }
  }

  private detectCachingPatterns(file: string, lines: string[]): void {
    // Check for fetch without cache configuration
    if (file.includes('/app/') && file.endsWith('.tsx')) {
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (line.includes('fetch(') && !line.includes('cache:') && !line.includes('next:')) {
          // Check next few lines for cache config
          const nextLines = lines.slice(i, Math.min(i + 5, lines.length)).join('');
          if (!nextLines.includes('cache:') && !nextLines.includes('revalidate')) {
            this.issues.push({
              file,
              line: i + 1,
              category: 'Caching',
              severity: 'info',
              message: 'fetch() call without explicit cache configuration',
              suggestion:
                'Add cache strategy: fetch(url, { cache: "no-store" }) or { next: { revalidate: 60 } }',
              bestPractice: 'https://nextjs.org/docs/app/getting-started/caching-and-revalidating',
            });
          }
        }
      }

      // Check for revalidate export on pages
      if (file.endsWith('page.tsx')) {
        const hasRevalidate = lines.some((line) => line.includes('export const revalidate'));
        const hasDynamicExport = lines.some((line) => line.includes('export const dynamic'));

        if (!hasRevalidate && !hasDynamicExport) {
          this.issues.push({
            file,
            category: 'Caching',
            severity: 'info',
            message: 'Page missing cache configuration (revalidate or dynamic export)',
            suggestion:
              'Add: export const revalidate = 60 (ISR) or export const dynamic = "force-dynamic"',
            bestPractice:
              'https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config',
          });
        }
      }
    }
  }

  private detectRouteHandlerPatterns(file: string, lines: string[]): void {
    // Check API route handlers in app/api
    if (file.includes('/app/api/') && file.endsWith('route.ts')) {
      // Check if exports proper HTTP methods (both function and const patterns)
      const hasExportedMethod = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].some((method) =>
        lines.some(
          (line) =>
            line.includes(`export async function ${method}`) ||
            line.includes(`export const ${method} =`) ||
            line.includes(`export const ${method}:`)
        )
      );

      if (!hasExportedMethod) {
        this.issues.push({
          file,
          category: 'Route Handlers',
          severity: 'error',
          message: 'Route handler missing exported HTTP method functions',
          suggestion: 'Export async functions: export async function GET(req: NextRequest) {...}',
          bestPractice: 'https://nextjs.org/docs/app/api-reference/file-conventions/route',
        });
      }

      // Check for runtime/region configuration for serverless optimization
      const hasRuntimeConfig = lines.some((line) => line.includes('export const runtime'));
      const hasRegionConfig = lines.some((line) => line.includes('export const preferredRegion'));

      if (!hasRuntimeConfig && !hasRegionConfig) {
        this.issues.push({
          file,
          category: 'Route Handlers',
          severity: 'info',
          message: 'Route handler missing runtime configuration',
          suggestion:
            'Add runtime config for optimization: export const runtime = "nodejs" or "edge"',
          bestPractice:
            'https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config#runtime',
        });
      }
    }
  }

  private detectDataFetchingPatterns(file: string, lines: string[], content: string): void {
    if (!file.includes('/app/') || !file.endsWith('.tsx')) return;

    // Check for sequential fetches that could be parallel
    const fetchCalls: number[] = [];
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('await fetch(') || lines[i].includes('await get')) {
        fetchCalls.push(i);
      }
    }

    // If multiple sequential awaits without Promise.all
    if (fetchCalls.length >= 2) {
      const hasPromiseAll = content.includes('Promise.all');
      if (!hasPromiseAll) {
        for (let i = 1; i < fetchCalls.length; i++) {
          const prevLine = fetchCalls[i - 1];
          const currLine = fetchCalls[i];

          // If within 10 lines of each other, likely sequential
          if (currLine - prevLine < 10) {
            this.issues.push({
              file,
              line: currLine + 1,
              category: 'Data Fetching',
              severity: 'warning',
              message: 'Sequential data fetches detected (waterfall pattern)',
              suggestion: 'Use Promise.all([fetch1, fetch2]) to fetch in parallel',
              bestPractice:
                'https://nextjs.org/docs/app/getting-started/fetching-data#parallel-and-sequential-data-fetching',
            });
            break; // Only report once per file
          }
        }
      }
    }

    // Check for data fetching in Client Components
    const isClientComponent = content.includes("'use client'") || content.includes('"use client"');
    if (isClientComponent) {
      const hasFetchInComponent = lines.some(
        (line) => line.includes('fetch(') && !line.includes('useEffect')
      );

      if (hasFetchInComponent) {
        this.issues.push({
          file,
          category: 'Data Fetching',
          severity: 'warning',
          message: 'Data fetching in Client Component outside useEffect',
          suggestion: 'Move data fetching to Server Component or use useEffect/React Query',
          bestPractice: 'https://nextjs.org/docs/app/getting-started/fetching-data',
        });
      }
    }
  }

  private detectErrorHandlingPatterns(file: string): void {
    // Check if directory has error.tsx
    if (file.includes('/app/') && file.endsWith('page.tsx')) {
      // Note: This is a placeholder - in practice we'd check the filesystem
      // For now, we'll mark it as info-level reminder
      const hasErrorFile = false;

      if (!hasErrorFile) {
        this.issues.push({
          file,
          category: 'Error Handling',
          severity: 'info',
          message: 'Consider adding error.tsx for error boundary',
          suggestion: 'Create error.tsx in same directory for graceful error handling',
          bestPractice: 'https://nextjs.org/docs/app/getting-started/error-handling',
        });
      }
    }
  }

  private detectFontOptimization(file: string, lines: string[]): void {
    if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Check for manual font imports in HTML/CSS
        if (line.includes('@import') && line.includes('fonts.googleapis')) {
          this.issues.push({
            file,
            line: i + 1,
            category: 'Font Optimization',
            severity: 'warning',
            message: 'Using manual Google Fonts import',
            suggestion: "Use next/font/google: import { Inter } from 'next/font/google'",
            bestPractice: 'https://nextjs.org/docs/app/getting-started/fonts',
          });
        }
      }
    }
  }

  private detectRuntimeConfig(file: string, lines: string[]): void {
    // Check for environment variable misuse
    if (file.includes('/app/') && (file.endsWith('.tsx') || file.endsWith('.ts'))) {
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Check for process.env in client components
        if (line.includes('process.env.') && !line.includes('NEXT_PUBLIC_')) {
          const content = lines.join('\n');
          const isClientComponent =
            content.includes("'use client'") || content.includes('"use client"');

          if (isClientComponent) {
            this.issues.push({
              file,
              line: i + 1,
              category: 'Runtime Config',
              severity: 'error',
              message: 'Using non-public env var in Client Component',
              suggestion: 'Use NEXT_PUBLIC_ prefix or move logic to Server Component',
              bestPractice: 'https://nextjs.org/docs/app/api-reference/next-config-js/env',
            });
          }
        }
      }
    }
  }

  getIssues(): NextJSIssue[] {
    return this.issues;
  }

  getSeverityCount(): { error: number; warning: number; info: number } {
    return {
      error: this.issues.filter((i) => i.severity === 'error').length,
      warning: this.issues.filter((i) => i.severity === 'warning').length,
      info: this.issues.filter((i) => i.severity === 'info').length,
    };
  }

  getIssuesByCategory(): Record<string, NextJSIssue[]> {
    return this.issues.reduce(
      (acc, issue) => {
        if (!acc[issue.category]) acc[issue.category] = [];
        acc[issue.category].push(issue);
        return acc;
      },
      {} as Record<string, NextJSIssue[]>
    );
  }
}
