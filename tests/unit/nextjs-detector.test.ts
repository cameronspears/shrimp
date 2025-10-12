import { describe, test, expect } from 'bun:test';
import { NextJSDetector } from '../../src/detectors/nextjs-detector.js';

describe('NextJSDetector', () => {
  describe('Image Optimization', () => {
    test('detects <img> tag instead of next/image', async () => {
      const code = `
        export default function Page() {
          return <img src="/logo.png" alt="Logo" />;
        }
      `;

      const detector = new NextJSDetector();
      await detector.analyzeFile('page.tsx', code);
      const issues = detector.getIssues();

      const imgIssue = issues.find(i => i.message.includes('instead of next/image'));
      expect(imgIssue).toBeDefined();
      expect(imgIssue?.severity).toBe('warning');
      expect(imgIssue?.category).toBe('Image Optimization');
    });

    test('allows <img> in email templates', async () => {
      const code = `
        export function EmailTemplate() {
          return <img src="/logo.png" alt="Logo" />;
        }
      `;

      const detector = new NextJSDetector();
      await detector.analyzeFile('emails/welcome.tsx', code);
      const issues = detector.getIssues();

      const imgIssue = issues.find(i => i.message.includes('instead of next/image'));
      expect(imgIssue).toBeUndefined();
    });

    test('allows next/image imports', async () => {
      const code = `
        import Image from 'next/image';
        export default function Page() {
          return <Image src="/logo.png" alt="Logo" width={100} height={100} />;
        }
      `;

      const detector = new NextJSDetector();
      await detector.analyzeFile('page.tsx', code);
      const issues = detector.getIssues();

      const imgIssue = issues.find(i => i.message.includes('instead of next/image'));
      expect(imgIssue).toBeUndefined();
    });
  });

  describe('Server/Client Component Patterns', () => {
    test('detects unnecessary use client directive', async () => {
      const code = `
        'use client';
        export default function Page() {
          return <div>Static content</div>;
        }
      `;

      const detector = new NextJSDetector();
      await detector.analyzeFile('app/page.tsx', code);
      const issues = detector.getIssues();

      const clientIssue = issues.find(i => i.message.includes('no interactivity'));
      expect(clientIssue).toBeDefined();
      expect(clientIssue?.severity).toBe('info');
    });

    test('allows use client with hooks', async () => {
      const code = `
        'use client';
        import { useState } from 'react';
        export default function Page() {
          const [count, setCount] = useState(0);
          return <button onClick={() => setCount(count + 1)}>{count}</button>;
        }
      `;

      const detector = new NextJSDetector();
      await detector.analyzeFile('app/page.tsx', code);
      const issues = detector.getIssues();

      const clientIssue = issues.find(i => i.message.includes('no interactivity'));
      expect(clientIssue).toBeUndefined();
    });

    test('detects client-side code in server component', async () => {
      const code = `
        export default function Page() {
          const [count, setCount] = useState(0);
          return <div>{count}</div>;
        }
      `;

      const detector = new NextJSDetector();
      await detector.analyzeFile('app/page.tsx', code);
      const issues = detector.getIssues();

      const serverIssue = issues.find(i => i.message.includes('Server Component using client-side'));
      expect(serverIssue).toBeDefined();
      expect(serverIssue?.severity).toBe('error');
    });

    test('allows use client with onClick handlers', async () => {
      const code = `
        'use client';
        export default function Button() {
          return <button onClick={() => alert('Hi')}>Click</button>;
        }
      `;

      const detector = new NextJSDetector();
      await detector.analyzeFile('app/Button.tsx', code);
      const issues = detector.getIssues();

      const clientIssue = issues.find(i => i.message.includes('no interactivity'));
      expect(clientIssue).toBeUndefined();
    });

    test('allows use client with browser APIs', async () => {
      const code = `
        'use client';
        export default function Page() {
          const data = localStorage.getItem('key');
          return <div>{data}</div>;
        }
      `;

      const detector = new NextJSDetector();
      await detector.analyzeFile('app/page.tsx', code);
      const issues = detector.getIssues();

      const clientIssue = issues.find(i => i.message.includes('no interactivity'));
      expect(clientIssue).toBeUndefined();
    });

    test('ignores comments with use client', async () => {
      const code = `
        // TODO: Add 'use client' later
        export default function Page() {
          return <div>Content</div>;
        }
      `;

      const detector = new NextJSDetector();
      await detector.analyzeFile('app/page.tsx', code);
      const issues = detector.getIssues();

      const clientIssue = issues.find(i => i.message.includes('no interactivity'));
      expect(clientIssue).toBeUndefined();
    });
  });

  describe('Metadata & SEO', () => {
    test('detects missing metadata in page', async () => {
      const code = `
        export default function Page() {
          return <div>Content</div>;
        }
      `;

      const detector = new NextJSDetector();
      await detector.analyzeFile('app/page.tsx', code);
      const issues = detector.getIssues();

      const metadataIssue = issues.find(i => i.message.includes('missing metadata'));
      expect(metadataIssue).toBeDefined();
      expect(metadataIssue?.severity).toBe('warning');
    });

    test('allows static metadata export', async () => {
      const code = `
        export const metadata = {
          title: 'Home',
          description: 'Welcome'
        };
        export default function Page() {
          return <div>Content</div>;
        }
      `;

      const detector = new NextJSDetector();
      await detector.analyzeFile('app/page.tsx', code);
      const issues = detector.getIssues();

      const metadataIssue = issues.find(i => i.message.includes('missing metadata'));
      expect(metadataIssue).toBeUndefined();
    });

    test('allows generateMetadata function', async () => {
      const code = `
        export async function generateMetadata() {
          return {
            title: 'Dynamic Title'
          };
        }
        export default function Page() {
          return <div>Content</div>;
        }
      `;

      const detector = new NextJSDetector();
      await detector.analyzeFile('app/page.tsx', code);
      const issues = detector.getIssues();

      const metadataIssue = issues.find(i => i.message.includes('missing metadata'));
      expect(metadataIssue).toBeUndefined();
    });

    test('detects missing metadata in layout', async () => {
      const code = `
        export default function Layout({ children }) {
          return <html><body>{children}</body></html>;
        }
      `;

      const detector = new NextJSDetector();
      await detector.analyzeFile('app/layout.tsx', code);
      const issues = detector.getIssues();

      const metadataIssue = issues.find(i => i.message.includes('missing metadata'));
      expect(metadataIssue).toBeDefined();
    });
  });

  describe('Caching Patterns', () => {
    test('detects fetch without cache config', async () => {
      const code = `
        export default async function Page() {
          const data = await fetch('https://api.example.com/data');
          return <div>{JSON.stringify(data)}</div>;
        }
      `;

      const detector = new NextJSDetector();
      await detector.analyzeFile('app/page.tsx', code);
      const issues = detector.getIssues();

      const cacheIssue = issues.find(i => i.message.includes('without explicit cache'));
      expect(cacheIssue).toBeDefined();
      expect(cacheIssue?.severity).toBe('info');
    });

    test('allows fetch with cache option', async () => {
      const code = `
        export default async function Page() {
          const data = await fetch('https://api.example.com/data', {
            cache: 'no-store'
          });
          return <div>{JSON.stringify(data)}</div>;
        }
      `;

      const detector = new NextJSDetector();
      await detector.analyzeFile('app/page.tsx', code);
      const issues = detector.getIssues();

      const cacheIssue = issues.find(i => i.message.includes('without explicit cache'));
      expect(cacheIssue).toBeUndefined();
    });

    test('allows fetch with next revalidate', async () => {
      const code = `
        export default async function Page() {
          const data = await fetch('https://api.example.com/data', {
            next: { revalidate: 60 }
          });
          return <div>{JSON.stringify(data)}</div>;
        }
      `;

      const detector = new NextJSDetector();
      await detector.analyzeFile('app/page.tsx', code);
      const issues = detector.getIssues();

      const cacheIssue = issues.find(i => i.message.includes('without explicit cache'));
      expect(cacheIssue).toBeUndefined();
    });

    test('detects missing revalidate export on page', async () => {
      const code = `
        export default function Page() {
          return <div>Static</div>;
        }
      `;

      const detector = new NextJSDetector();
      await detector.analyzeFile('app/page.tsx', code);
      const issues = detector.getIssues();

      const revalidateIssue = issues.find(i => i.message.includes('missing cache configuration'));
      expect(revalidateIssue).toBeDefined();
      expect(revalidateIssue?.severity).toBe('info');
    });
  });

  describe('Route Handlers', () => {
    test('detects route without exported HTTP methods', async () => {
      const code = `
        export default function handler(req) {
          return new Response('Hello');
        }
      `;

      const detector = new NextJSDetector();
      await detector.analyzeFile('app/api/hello/route.ts', code);
      const issues = detector.getIssues();

      const methodIssue = issues.find(i => i.message.includes('missing exported HTTP method'));
      expect(methodIssue).toBeDefined();
      expect(methodIssue?.severity).toBe('error');
    });

    test('allows GET export', async () => {
      const code = `
        export async function GET(req) {
          return Response.json({ data: 'test' });
        }
      `;

      const detector = new NextJSDetector();
      await detector.analyzeFile('app/api/users/route.ts', code);
      const issues = detector.getIssues();

      const methodIssue = issues.find(i => i.message.includes('missing exported HTTP method'));
      expect(methodIssue).toBeUndefined();
    });

    test('allows POST const export', async () => {
      const code = `
        export const POST = async (req: NextRequest) => {
          return Response.json({ success: true });
        };
      `;

      const detector = new NextJSDetector();
      await detector.analyzeFile('app/api/create/route.ts', code);
      const issues = detector.getIssues();

      const methodIssue = issues.find(i => i.message.includes('missing exported HTTP method'));
      expect(methodIssue).toBeUndefined();
    });

    test('detects missing runtime config', async () => {
      const code = `
        export async function GET() {
          return Response.json({ data: 'test' });
        }
      `;

      const detector = new NextJSDetector();
      await detector.analyzeFile('app/api/data/route.ts', code);
      const issues = detector.getIssues();

      const runtimeIssue = issues.find(i => i.message.includes('missing runtime configuration'));
      expect(runtimeIssue).toBeDefined();
      expect(runtimeIssue?.severity).toBe('info');
    });

    test('allows runtime export', async () => {
      const code = `
        export const runtime = 'edge';
        export async function GET() {
          return Response.json({ data: 'test' });
        }
      `;

      const detector = new NextJSDetector();
      await detector.analyzeFile('app/api/data/route.ts', code);
      const issues = detector.getIssues();

      const runtimeIssue = issues.find(i => i.message.includes('missing runtime configuration'));
      expect(runtimeIssue).toBeUndefined();
    });
  });

  describe('Data Fetching Patterns', () => {
    test('detects sequential data fetches', async () => {
      const code = `
        export default async function Page() {
          const user = await fetch('/api/user');
          const posts = await fetch('/api/posts');
          return <div>Data</div>;
        }
      `;

      const detector = new NextJSDetector();
      await detector.analyzeFile('app/page.tsx', code);
      const issues = detector.getIssues();

      const waterfallIssue = issues.find(i => i.message.includes('Sequential data fetches'));
      expect(waterfallIssue).toBeDefined();
      expect(waterfallIssue?.severity).toBe('warning');
    });

    test('allows parallel fetching with Promise.all', async () => {
      const code = `
        export default async function Page() {
          const [user, posts] = await Promise.all([
            fetch('/api/user'),
            fetch('/api/posts')
          ]);
          return <div>Data</div>;
        }
      `;

      const detector = new NextJSDetector();
      await detector.analyzeFile('app/page.tsx', code);
      const issues = detector.getIssues();

      const waterfallIssue = issues.find(i => i.message.includes('Sequential data fetches'));
      expect(waterfallIssue).toBeUndefined();
    });

    test('detects fetch in Client Component outside useEffect', async () => {
      const code = `
        'use client';
        export default function Page() {
          const data = fetch('/api/data');
          return <div>Data</div>;
        }
      `;

      const detector = new NextJSDetector();
      await detector.analyzeFile('app/page.tsx', code);
      const issues = detector.getIssues();

      const fetchIssue = issues.find(i => i.message.includes('outside useEffect'));
      expect(fetchIssue).toBeDefined();
      expect(fetchIssue?.severity).toBe('warning');
    });

    test('allows fetch in useEffect', async () => {
      const code = `
        'use client';
        import { useEffect } from 'react';
        export default function Page() {
          useEffect(() => {
            fetch('/api/data');
          }, []);
          return <div>Data</div>;
        }
      `;

      const detector = new NextJSDetector();
      await detector.analyzeFile('app/page.tsx', code);
      const issues = detector.getIssues();

      const fetchIssue = issues.find(i => i.message.includes('outside useEffect'));
      expect(fetchIssue).toBeUndefined();
    });
  });

  describe('Font Optimization', () => {
    test('detects manual Google Fonts import', async () => {
      const code = `
        import '@import url("https://fonts.googleapis.com/css2?family=Inter")';
        export default function Page() {
          return <div>Content</div>;
        }
      `;

      const detector = new NextJSDetector();
      await detector.analyzeFile('app/page.tsx', code);
      const issues = detector.getIssues();

      const fontIssue = issues.find(i => i.message.includes('manual Google Fonts'));
      expect(fontIssue).toBeDefined();
      expect(fontIssue?.severity).toBe('warning');
    });

    test('allows next/font/google usage', async () => {
      const code = `
        import { Inter } from 'next/font/google';
        const inter = Inter({ subsets: ['latin'] });
        export default function Page() {
          return <div className={inter.className}>Content</div>;
        }
      `;

      const detector = new NextJSDetector();
      await detector.analyzeFile('app/page.tsx', code);
      const issues = detector.getIssues();

      const fontIssue = issues.find(i => i.message.includes('manual Google Fonts'));
      expect(fontIssue).toBeUndefined();
    });
  });

  describe('Runtime Configuration', () => {
    test('detects non-public env var in Client Component', async () => {
      const code = `
        'use client';
        export default function Page() {
          const apiKey = process.env.API_KEY;
          return <div>{apiKey}</div>;
        }
      `;

      const detector = new NextJSDetector();
      await detector.analyzeFile('app/page.tsx', code);
      const issues = detector.getIssues();

      const envIssue = issues.find(i => i.message.includes('non-public env var'));
      expect(envIssue).toBeDefined();
      expect(envIssue?.severity).toBe('error');
    });

    test('allows NEXT_PUBLIC_ prefix in Client Component', async () => {
      const code = `
        'use client';
        export default function Page() {
          const apiUrl = process.env.NEXT_PUBLIC_API_URL;
          return <div>{apiUrl}</div>;
        }
      `;

      const detector = new NextJSDetector();
      await detector.analyzeFile('app/page.tsx', code);
      const issues = detector.getIssues();

      const envIssue = issues.find(i => i.message.includes('non-public env var'));
      expect(envIssue).toBeUndefined();
    });

    test('allows private env vars in Server Component', async () => {
      const code = `
        export default function Page() {
          const apiKey = process.env.API_KEY;
          return <div>Secure</div>;
        }
      `;

      const detector = new NextJSDetector();
      await detector.analyzeFile('app/page.tsx', code);
      const issues = detector.getIssues();

      const envIssue = issues.find(i => i.message.includes('non-public env var'));
      expect(envIssue).toBeUndefined();
    });
  });

  describe('Error Handling', () => {
    test('suggests error.tsx for pages', async () => {
      const code = `
        export default function Page() {
          return <div>Content</div>;
        }
      `;

      const detector = new NextJSDetector();
      await detector.analyzeFile('app/dashboard/page.tsx', code);
      const issues = detector.getIssues();

      const errorIssue = issues.find(i => i.message.includes('error.tsx'));
      expect(errorIssue).toBeDefined();
      expect(errorIssue?.severity).toBe('info');
    });
  });

  describe('getSeverityCount', () => {
    test('correctly counts issues by severity', async () => {
      const code = `
        export default function Page() {
          const [state, setState] = useState(0);
          return <img src="/test.png" />;
        }
      `;

      const detector = new NextJSDetector();
      await detector.analyzeFile('app/page.tsx', code);
      const counts = detector.getSeverityCount();

      expect(counts.error).toBeGreaterThan(0);
      expect(counts.warning).toBeGreaterThan(0);
      expect(counts.info).toBeGreaterThan(0);
    });
  });

  describe('getIssuesByCategory', () => {
    test('groups issues by category', async () => {
      const code = `
        export default function Page() {
          return (
            <div>
              <img src="/logo.png" />
              <video src="/video.mp4" />
            </div>
          );
        }
      `;

      const detector = new NextJSDetector();
      await detector.analyzeFile('app/page.tsx', code);
      const byCategory = detector.getIssuesByCategory();

      expect(Object.keys(byCategory).length).toBeGreaterThan(0);
      expect(byCategory['Image Optimization']).toBeDefined();
    });
  });

  describe('File Filtering', () => {
    test('skips node_modules files', async () => {
      const code = `export default function Component() { return <img src="/test.png" />; }`;

      const detector = new NextJSDetector();
      await detector.analyzeFile('node_modules/package/index.tsx', code);
      const issues = detector.getIssues();

      expect(issues.length).toBe(0);
    });

    test('skips test files', async () => {
      const code = `test('component', () => { render(<img src="/test.png" />); });`;

      const detector = new NextJSDetector();
      await detector.analyzeFile('tests/component.test.tsx', code);
      const issues = detector.getIssues();

      expect(issues.length).toBe(0);
    });

    test('analyzes app directory files', async () => {
      const code = `export default function Page() { return <img src="/logo.png" />; }`;

      const detector = new NextJSDetector();
      await detector.analyzeFile('app/about/page.tsx', code);
      const issues = detector.getIssues();

      expect(issues.length).toBeGreaterThan(0);
    });
  });
});
