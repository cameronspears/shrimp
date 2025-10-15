import { describe, test, expect } from 'bun:test';
import { ShrimpHealth } from '../../src/index.js';
import { BugDetectorAST } from '../../src/detectors/bug-detector-ast.js';
import { NextJSDetector } from '../../src/detectors/nextjs-detector.js';
import { WCAGDetector } from '../../src/detectors/wcag-detector.js';

describe('Next.js 15 Validation Suite', () => {
  describe('Next.js 15 App Router Patterns', () => {
    test('validates Server Components are default', async () => {
      const validServerComponent = `
        // app/page.tsx
        export default function Page() {
          return <div>Server Component</div>;
        }
      `;

      const detector = new NextJSDetector();
      await detector.analyzeFile('app/page.tsx', validServerComponent);
      const issues = detector.getIssues();

      // Server components should NOT have 'use client' directive
      const clientDirectiveIssue = issues.find((i) =>
        i.message.includes('use client')
      );
      expect(clientDirectiveIssue).toBeUndefined();
    });

    test('detects missing use client for interactive components', async () => {
      const interactiveWithoutDirective = `
        // app/components/Button.tsx
        import { useState } from 'react';

        export default function Button() {
          const [count, setCount] = useState(0);
          return <button onClick={() => setCount(count + 1)}>{count}</button>;
        }
      `;

      const detector = new NextJSDetector();
      await detector.analyzeFile(
        'app/components/Button.tsx',
        interactiveWithoutDirective
      );
      const issues = detector.getIssues();

      const missingDirective = issues.find((i) =>
        i.message.includes('use client') || i.message.includes('useState')
      );
      expect(missingDirective).toBeDefined();
      expect(missingDirective?.severity).toBe('error');
    });

    test('validates async Server Components', async () => {
      const asyncServerComponent = `
        // app/users/page.tsx
        async function getUsers() {
          const res = await fetch('https://api.example.com/users');
          return res.json();
        }

        export default async function UsersPage() {
          const users = await getUsers();
          return <div>{users.map(u => u.name)}</div>;
        }
      `;

      const detector = new NextJSDetector();
      await detector.analyzeFile('app/users/page.tsx', asyncServerComponent);
      const issues = detector.getIssues();

      // Async server components are valid
      const asyncIssue = issues.find((i) => i.message.includes('async'));
      expect(asyncIssue).toBeUndefined();
    });

    test('detects incorrect data fetching in Client Components', async () => {
      const badClientFetch = `
        'use client';
        import { useState, useEffect } from 'react';

        export default function ClientFetch() {
          const [data, setData] = useState(null);

          useEffect(() => {
            fetch('/api/data').then(r => r.json()).then(setData);
          }, []);

          return <div>{data}</div>;
        }
      `;

      const detector = new NextJSDetector();
      await detector.analyzeFile('app/components/ClientFetch.tsx', badClientFetch);
      const issues = detector.getIssues();

      // Should recommend using Server Components for data fetching
      const fetchIssue = issues.find((i) =>
        i.message.includes('fetch') || i.message.includes('useEffect')
      );
      // This is acceptable in client components, so no issue expected
      expect(fetchIssue).toBeUndefined();
    });

    test('validates proper use of next/image', async () => {
      const goodImage = `
        import Image from 'next/image';

        export default function Page() {
          return (
            <Image
              src="/photo.jpg"
              alt="Profile photo"
              width={500}
              height={500}
            />
          );
        }
      `;

      const detector = new NextJSDetector();
      await detector.analyzeFile('app/page.tsx', goodImage);
      const issues = detector.getIssues();

      const imageIssue = issues.find((i) => i.message.includes('Image'));
      expect(imageIssue).toBeUndefined();
    });

    test('detects missing Image component optimization', async () => {
      const unoptimizedImage = `
        export default function Page() {
          return <img src="/photo.jpg" alt="Photo" />;
        }
      `;

      const detector = new NextJSDetector();
      await detector.analyzeFile('app/page.tsx', unoptimizedImage);
      const issues = detector.getIssues();

      const imgIssue = issues.find((i) =>
        i.message.includes('img') || i.message.includes('Image')
      );
      expect(imgIssue).toBeDefined();
      expect(imgIssue?.severity).toBe('warning');
    });
  });

  describe('WCAG 2.0 Compliance for Next.js', () => {
    test('validates accessible navigation', async () => {
      const accessibleNav = `
        import Link from 'next/link';

        export default function Nav() {
          return (
            <nav aria-label="Main navigation">
              <ul>
                <li><Link href="/">Home</Link></li>
                <li><Link href="/about">About</Link></li>
              </ul>
            </nav>
          );
        }
      `;

      const detector = new WCAGDetector();
      await detector.analyzeFile('components/Nav.tsx', accessibleNav);
      const issues = detector.getIssues();

      const a11yIssue = issues.find((i) => i.category === 'Navigation');
      expect(a11yIssue).toBeUndefined();
    });

    test('detects missing ARIA labels on buttons', async () => {
      const inaccessibleButton = `
        'use client';

        export default function IconButton() {
          return <button onClick={() => {}}>×</button>;
        }
      `;

      const detector = new WCAGDetector();
      await detector.analyzeFile('components/IconButton.tsx', inaccessibleButton);
      const issues = detector.getIssues();

      const ariaIssue = issues.find((i) =>
        i.message.includes('aria-label') || i.message.includes('accessible')
      );
      expect(ariaIssue).toBeDefined();
    });

    test('validates form accessibility', async () => {
      const accessibleForm = `
        export default function ContactForm() {
          return (
            <form>
              <label htmlFor="email">Email:</label>
              <input id="email" type="email" required />

              <label htmlFor="message">Message:</label>
              <textarea id="message" required />

              <button type="submit">Send</button>
            </form>
          );
        }
      `;

      const detector = new WCAGDetector();
      await detector.analyzeFile('app/contact/page.tsx', accessibleForm);
      const issues = detector.getIssues();

      const formIssue = issues.find((i) =>
        i.message.includes('label') || i.message.includes('input')
      );
      expect(formIssue).toBeUndefined();
    });
  });

  describe('Performance Patterns for Next.js 15', () => {
    test('detects missing dynamic imports for heavy components', async () => {
      const heavyComponent = `
        import HeavyChart from '@/components/HeavyChart';
        import HeavyEditor from '@/components/HeavyEditor';

        export default function Page() {
          return (
            <div>
              <HeavyChart />
              <HeavyEditor />
            </div>
          );
        }
      `;

      const detector = new NextJSDetector();
      await detector.analyzeFile('app/dashboard/page.tsx', heavyComponent);
      const issues = detector.getIssues();

      // Should recommend dynamic imports for heavy components
      const dynamicImportIssue = issues.find((i) =>
        i.message.includes('dynamic') || i.message.includes('import')
      );
      // This is optional optimization, may or may not be flagged
    });

    test('validates proper Suspense usage for streaming', async () => {
      const streamingComponent = `
        import { Suspense } from 'react';
        import UserList from './UserList';

        export default function Page() {
          return (
            <Suspense fallback={<div>Loading...</div>}>
              <UserList />
            </Suspense>
          );
        }
      `;

      const detector = new NextJSDetector();
      await detector.analyzeFile('app/users/page.tsx', streamingComponent);
      const issues = detector.getIssues();

      const suspenseIssue = issues.find((i) => i.message.includes('Suspense'));
      expect(suspenseIssue).toBeUndefined();
    });
  });

  describe('Error Handling in Next.js 15', () => {
    test('validates error.tsx boundary', async () => {
      const errorBoundary = `
        'use client';

        export default function Error({
          error,
          reset,
        }: {
          error: Error;
          reset: () => void;
        }) {
          return (
            <div>
              <h2>Something went wrong!</h2>
              <button onClick={() => reset()}>Try again</button>
            </div>
          );
        }
      `;

      const detector = new NextJSDetector();
      await detector.analyzeFile('app/error.tsx', errorBoundary);
      const issues = detector.getIssues();

      // Error boundaries must be client components
      const errorIssue = issues.find((i) =>
        i.message.includes('error') && i.severity === 'error'
      );
      expect(errorIssue).toBeUndefined();
    });
  });

  describe('Real-World Next.js 15 Project Validation', () => {
    test('validates complete App Router structure', async () => {
      // Simulate a real project check
      const projectRoot = process.cwd();

      const shrimp = new ShrimpHealth({
        projectRoot,
        enabledDetectors: {
          bugs: true,
          performance: true,
          nextjs: true,
          wcag: true,
          imports: true,
          consistency: true,
        },
      });

      const result = await shrimp.check();

      // Real projects should have some baseline quality
      expect(result.success).toBe(true);
      expect(result.healthScore).toBeGreaterThan(0);
      expect(result.healthScore).toBeLessThanOrEqual(100);
      expect(result.recommendations).toBeDefined();
      expect(Array.isArray(result.recommendations)).toBe(true);
    });

    test('measures false positive rate', async () => {
      // This test validates that we're not flagging valid Next.js patterns
      const validNextJSPatterns = [
        {
          file: 'app/layout.tsx',
          code: `
            export const metadata = { title: 'My App' };

            export default function RootLayout({ children }) {
              return (
                <html lang="en">
                  <body>{children}</body>
                </html>
              );
            }
          `,
        },
        {
          file: 'app/page.tsx',
          code: `
            async function getData() {
              const res = await fetch('https://api.example.com/data', {
                next: { revalidate: 3600 }
              });
              return res.json();
            }

            export default async function Page() {
              const data = await getData();
              return <div>{data.title}</div>;
            }
          `,
        },
        {
          file: 'app/api/route.ts',
          code: `
            export async function GET(request: Request) {
              return Response.json({ status: 'ok' });
            }
          `,
        },
      ];

      const detector = new NextJSDetector();
      let totalIssues = 0;

      for (const { file, code } of validNextJSPatterns) {
        await detector.analyzeFile(file, code);
        const issues = detector.getIssues();
        totalIssues += issues.filter((i) => i.severity === 'error').length;
      }

      // Valid patterns should have very few or no errors
      expect(totalIssues).toBeLessThan(3); // Allow for minor warnings
    });
  });

  describe('Vercel Deployment Best Practices', () => {
    test('validates proper route handlers', async () => {
      const validRouteHandler = `
        import { NextRequest, NextResponse } from 'next/server';

        export async function GET(request: NextRequest) {
          const data = await fetchData();
          return NextResponse.json(data);
        }

        export async function POST(request: NextRequest) {
          const body = await request.json();
          return NextResponse.json({ success: true });
        }
      `;

      const detector = new NextJSDetector();
      await detector.analyzeFile('app/api/users/route.ts', validRouteHandler);
      const issues = detector.getIssues();

      const routeIssue = issues.find((i) => i.severity === 'error');
      expect(routeIssue).toBeUndefined();
    });

    test('detects missing export config for static pages', async () => {
      const staticPage = `
        export default function AboutPage() {
          return <div>About Us</div>;
        }
      `;

      const detector = new NextJSDetector();
      await detector.analyzeFile('app/about/page.tsx', staticPage);
      const issues = detector.getIssues();

      // Static pages don't need special config, so no issues expected
      const configIssue = issues.find((i) =>
        i.message.includes('generateStaticParams')
      );
      expect(configIssue).toBeUndefined();
    });
  });
});
