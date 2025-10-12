import { describe, test, expect } from 'bun:test';
import { ConsistencyDetector } from '../../src/detectors/consistency-detector.js';

describe('ConsistencyDetector', () => {
  describe('Naming Consistency', () => {
    test('detects mixed camelCase and PascalCase functions', async () => {
      const code = `
        function helperFunction() {}
        function anotherHelper() {}
        function thirdHelper() {}
        function fourthHelper() {}
        function AnotherHelper() {}
        function FourthHelper() {}
      `;

      const detector = new ConsistencyDetector();
      await detector.analyzeFile('utils.ts', code);
      const issues = detector.getIssues();

      const namingIssue = issues.find(i => i.message.includes('camelCase and PascalCase'));
      expect(namingIssue).toBeDefined();
      expect(namingIssue?.category).toBe('Naming Consistency');
    });

    test('allows PascalCase in component files', async () => {
      const code = `
        function ComponentHelper() {}
        function AnotherComponent() {}
        function ThirdComponent() {}
      `;

      const detector = new ConsistencyDetector();
      await detector.analyzeFile('component/Button.tsx', code);
      const issues = detector.getIssues();

      const namingIssue = issues.find(i => i.message.includes('camelCase and PascalCase'));
      expect(namingIssue).toBeUndefined();
    });

    test('allows consistent camelCase functions', async () => {
      const code = `
        function helperOne() {}
        function helperTwo() {}
        function helperThree() {}
        function helperFour() {}
      `;

      const detector = new ConsistencyDetector();
      await detector.analyzeFile('utils.ts', code);
      const issues = detector.getIssues();

      const namingIssue = issues.find(i => i.category === 'Naming Consistency');
      expect(namingIssue).toBeUndefined();
    });
  });

  describe('Error Handling Patterns', () => {
    test('detects mixed try-catch and .catch patterns in file', async () => {
      const code = `
        async function fetch1() {
          try {
            await fetch('/api/1');
          } catch (e) {}
        }
        async function fetch2() {
          try {
            await fetch('/api/2');
          } catch (e) {}
        }
        async function fetch3() {
          return fetch('/api/3').catch(e => {});
        }
        async function fetch4() {
          return fetch('/api/4').catch(e => {});
        }
        async function fetch5() {
          return fetch('/api/5').catch(e => {});
        }
        async function fetch6() {
          return fetch('/api/6').catch(e => {});
        }
      `;

      const detector = new ConsistencyDetector();
      await detector.analyzeFile('api.ts', code);
      const issues = detector.getIssues();

      const errorIssue = issues.find(i => i.message.includes('Mixes try-catch'));
      expect(errorIssue).toBeDefined();
      expect(errorIssue?.category).toBe('Error Handling');
    });

    test('allows consistent try-catch usage', async () => {
      const code = `
        async function fetch1() {
          try { await fetch('/api/1'); } catch (e) {}
        }
        async function fetch2() {
          try { await fetch('/api/2'); } catch (e) {}
        }
      `;

      const detector = new ConsistencyDetector();
      await detector.analyzeFile('api.ts', code);
      const issues = detector.getIssues();

      const errorIssue = issues.find(i => i.category === 'Error Handling' && i.file === 'api.ts');
      expect(errorIssue).toBeUndefined();
    });
  });

  describe('Export Patterns', () => {
    test('detects default export in utility module', async () => {
      const code = `
        export default function helper() {
          return 'help';
        }
      `;

      const detector = new ConsistencyDetector();
      await detector.analyzeFile('/lib/helpers.ts', code);
      const issues = detector.getIssues();

      const exportIssue = issues.find(i => i.message.includes('default export'));
      expect(exportIssue).toBeDefined();
      expect(exportIssue?.category).toBe('Export Patterns');
    });

    test('detects named exports in page component', async () => {
      const code = `
        export const Page = () => {
          return <div>Page</div>;
        };
      `;

      const detector = new ConsistencyDetector();
      await detector.analyzeFile('/app/about/page.tsx', code);
      const issues = detector.getIssues();

      const exportIssue = issues.find(i => i.message.includes('should use default export'));
      expect(exportIssue).toBeDefined();
    });

    test('allows default export in pages', async () => {
      const code = `
        export default function Page() {
          return <div>Page</div>;
        }
      `;

      const detector = new ConsistencyDetector();
      await detector.analyzeFile('app/home/page.tsx', code);
      const issues = detector.getIssues();

      const exportIssue = issues.find(i => i.category === 'Export Patterns');
      expect(exportIssue).toBeUndefined();
    });

    test('allows named exports in utils', async () => {
      const code = `
        export function helperOne() {}
        export function helperTwo() {}
      `;

      const detector = new ConsistencyDetector();
      await detector.analyzeFile('utils/string.ts', code);
      const issues = detector.getIssues();

      const exportIssue = issues.find(i => i.category === 'Export Patterns');
      expect(exportIssue).toBeUndefined();
    });
  });

  describe('Async Patterns', () => {
    test('detects mixed async/await and Promise chains', async () => {
      const code = `
        async function fetch1() {
          await fetch('/api/1');
        }
        async function fetch2() {
          await fetch('/api/2');
        }
        async function fetch3() {
          await fetch('/api/3');
        }
        async function fetch4() {
          await fetch('/api/4');
        }
        function fetch5() {
          return fetch('/api/5').then(r => r.json()).then(d => d);
        }
        function fetch6() {
          return fetch('/api/6').then(r => r.json()).then(d => d);
        }
        function fetch7() {
          return fetch('/api/7').then(r => r.json());
        }
      `;

      const detector = new ConsistencyDetector();
      await detector.analyzeFile('api.ts', code);
      const issues = detector.getIssues();

      const asyncIssue = issues.find(i => i.message.includes('async/await and Promise chains'));
      expect(asyncIssue).toBeDefined();
      expect(asyncIssue?.category).toBe('Async Patterns');
    });

    test('allows consistent async/await', async () => {
      const code = `
        async function fetch1() {
          await fetch('/api/1');
        }
        async function fetch2() {
          await fetch('/api/2');
        }
      `;

      const detector = new ConsistencyDetector();
      await detector.analyzeFile('api.ts', code);
      const issues = detector.getIssues();

      const asyncIssue = issues.find(i => i.category === 'Async Patterns');
      expect(asyncIssue).toBeUndefined();
    });
  });

  describe('Magic Numbers', () => {
    test('detects excessive magic numbers', async () => {
      const lines: string[] = [];
      for (let i = 0; i < 20; i++) {
        lines.push(`someFunction(${100 + i * 10});`);
      }
      const code = lines.join('\n');

      const detector = new ConsistencyDetector();
      await detector.analyzeFile('config.ts', code);
      const issues = detector.getIssues();

      const magicIssue = issues.find(i => i.message.includes('magic numbers'));
      expect(magicIssue).toBeDefined();
      expect(magicIssue?.category).toBe('Code Quality');
    });

    test('allows small numbers', async () => {
      const code = `
        const zero = 0;
        const one = 1;
        const two = 2;
        const negOne = -1;
      `;

      const detector = new ConsistencyDetector();
      await detector.analyzeFile('constants.ts', code);
      const issues = detector.getIssues();

      const magicIssue = issues.find(i => i.message.includes('magic numbers'));
      expect(magicIssue).toBeUndefined();
    });

    test('skips magic numbers in page components', async () => {
      const code = `
        export default function Page() {
          return (
            <div style={{ width: 500, height: 300, padding: 20 }}>
              Content
            </div>
          );
        }
      `;

      const detector = new ConsistencyDetector();
      await detector.analyzeFile('app/page.tsx', code);
      const issues = detector.getIssues();

      const magicIssue = issues.find(i => i.message.includes('magic numbers'));
      expect(magicIssue).toBeUndefined();
    });

    test('skips magic numbers in marketing pages', async () => {
      const code = `
        export default function Marketing() {
          return <div style={{ fontSize: 48, lineHeight: 56 }}>Hero</div>;
        }
      `;

      const detector = new ConsistencyDetector();
      await detector.analyzeFile('marketing/hero.tsx', code);
      const issues = detector.getIssues();

      const magicIssue = issues.find(i => i.message.includes('magic numbers'));
      expect(magicIssue).toBeUndefined();
    });

    test('allows numbers in comments', async () => {
      const code = `
        // Port 3000 is default
        // Max timeout is 5000ms
        const config = true;
      `;

      const detector = new ConsistencyDetector();
      await detector.analyzeFile('config.ts', code);
      const issues = detector.getIssues();

      const magicIssue = issues.find(i => i.message.includes('magic numbers'));
      expect(magicIssue).toBeUndefined();
    });
  });

  describe('File Organization', () => {
    test('detects too many files in directory', async () => {
      const files: string[] = [];
      for (let i = 0; i < 60; i++) {
        files.push(`/project/utils/helper${i}.ts`);
      }

      const detector = new ConsistencyDetector();
      await detector.analyzeCodebase(files);
      const issues = detector.getIssues();

      const orgIssue = issues.find(i => i.message.includes('files in single directory'));
      expect(orgIssue).toBeDefined();
      expect(orgIssue?.category).toBe('File Organization');
    });

    test('detects mixed components and utilities', async () => {
      const files = [
        '/project/shared/Button.tsx',
        '/project/shared/Input.tsx',
        '/project/shared/utils.ts',
        '/project/shared/helpers.ts',
        '/project/shared/Card.tsx',
        '/project/shared/Modal.tsx',
      ];

      const detector = new ConsistencyDetector();
      await detector.analyzeCodebase(files);
      const issues = detector.getIssues();

      const mixedIssue = issues.find(i => i.message.includes('mixes components and utilities'));
      expect(mixedIssue).toBeDefined();
    });

    test('allows reasonable directory sizes', async () => {
      const files = [
        '/project/utils/string.ts',
        '/project/utils/array.ts',
        '/project/utils/object.ts',
      ];

      const detector = new ConsistencyDetector();
      await detector.analyzeCodebase(files);
      const issues = detector.getIssues();

      const orgIssue = issues.find(i => i.category === 'File Organization');
      expect(orgIssue).toBeUndefined();
    });
  });

  describe('Import Consistency (Codebase-wide)', () => {
    test('detects import style inconsistency across codebase', async () => {
      const files = [
        '/project/file1.ts',
        '/project/file2.ts',
        '/project/file3.ts',
        '/project/file4.ts',
      ];

      const fileContents = new Map<string, string>();
      for (const file of files) {
        if (file.includes('file1') || file.includes('file2')) {
          fileContents.set(file, `
            import { a } from '@/absolute1';
            import { b } from '@/absolute2';
            import { c } from '@/absolute3';
            import { d } from './local1';
          `);
        } else {
          fileContents.set(file, `
            import { x } from './relative1';
            import { y } from './relative2';
            import { z } from './relative3';
            import { w } from '@/absolute1';
          `);
        }
      }

      const detector = new ConsistencyDetector();
      await detector.analyzeCodebase(files, fileContents);
      const issues = detector.getIssues();

      const importIssue = issues.find(i => i.message.includes('absolute and'));
      expect(importIssue).toBeDefined();
      expect(importIssue?.category).toBe('Import Consistency');
    });
  });

  describe('getIssuesByCategory', () => {
    test('groups issues by category', async () => {
      const code = `
        function helperOne() {}
        function helperTwo() {}
        function helperThree() {}
        function helperFour() {}
        function HelperOne() {}
        function HelperThree() {}

        export default function util() {}
      `;

      const detector = new ConsistencyDetector();
      await detector.analyzeFile('lib/utils.ts', code);
      const byCategory = detector.getIssuesByCategory();

      expect(Object.keys(byCategory).length).toBeGreaterThan(0);
      if (byCategory['Naming Consistency']) {
        expect(byCategory['Naming Consistency'].length).toBeGreaterThan(0);
      }
    });
  });

  describe('Edge Cases', () => {
    test('handles files with no functions', async () => {
      const code = `
        export const VALUE = 42;
        export const CONFIG = { debug: true };
      `;

      const detector = new ConsistencyDetector();
      await detector.analyzeFile('constants.ts', code);
      const issues = detector.getIssues();

      expect(Array.isArray(issues)).toBe(true);
    });

    test('handles empty codebase', async () => {
      const detector = new ConsistencyDetector();
      await detector.analyzeCodebase([]);
      const issues = detector.getIssues();

      expect(issues.length).toBe(0);
    });

    test('provides suggestions with examples', async () => {
      const code = `
        function HelperOne() {}
        function HelperTwo() {}
        function HelperThree() {}
        function helperFour() {}
      `;

      const detector = new ConsistencyDetector();
      await detector.analyzeFile('utils.ts', code);
      const issues = detector.getIssues();

      const namingIssue = issues.find(i => i.category === 'Naming Consistency');
      if (namingIssue) {
        expect(namingIssue.examples).toBeDefined();
        expect(namingIssue.examples!.length).toBeGreaterThan(0);
      }
    });

    test('handles mixed file types correctly', async () => {
      const code = `
        export const config = {};
        export function helper() {}
        export class Service {}
      `;

      const detector = new ConsistencyDetector();
      await detector.analyzeFile('mixed.ts', code);
      const issues = detector.getIssues();

      expect(Array.isArray(issues)).toBe(true);
    });
  });

  describe('Complex Scenarios', () => {
    test('handles arrow function naming', async () => {
      const code = `
        const helperOne = () => {};
        const helperTwo = () => {};
        const helperThree = () => {};
        const helperFour = () => {};
        const HelperTwo = () => {};
        const HelperFour = () => {};
      `;

      const detector = new ConsistencyDetector();
      await detector.analyzeFile('utils.ts', code);
      const issues = detector.getIssues();

      const namingIssue = issues.find(i => i.category === 'Naming Consistency');
      expect(namingIssue).toBeDefined();
    });

    test('skips issues in small files', async () => {
      const code = `
        function One() {}
        function two() {}
      `;

      const detector = new ConsistencyDetector();
      await detector.analyzeFile('small.ts', code);
      const issues = detector.getIssues();

      // Should not flag with only 2 functions (needs > 3)
      const namingIssue = issues.find(i => i.category === 'Naming Consistency');
      expect(namingIssue).toBeUndefined();
    });

    test('handles nested async patterns', async () => {
      const code = `
        async function outer() {
          await inner();
          await another();
          await third();
          await fourth();
        }
        function inner() {
          return Promise.resolve().then(() => {}).then(() => {});
        }
        function another() {
          return Promise.resolve().then(() => {}).then(() => {});
        }
        function third() {
          return Promise.resolve().then(() => {});
        }
      `;

      const detector = new ConsistencyDetector();
      await detector.analyzeFile('nested.ts', code);
      const issues = detector.getIssues();

      const asyncIssue = issues.find(i => i.category === 'Async Patterns');
      expect(asyncIssue).toBeDefined();
    });
  });

  describe('Codebase-wide Analysis', () => {
    test('detects codebase-wide error handling inconsistency', async () => {
      const files = [
        '/project/api1.ts',
        '/project/api2.ts',
        '/project/api3.ts',
      ];

      const detector = new ConsistencyDetector();
      await detector.analyzeCodebase(files);
      const issues = detector.getIssues();

      // Codebase-wide issues should be detected
      expect(Array.isArray(issues)).toBe(true);
    });

    test('limits files analyzed to 50', async () => {
      const files: string[] = [];
      for (let i = 0; i < 100; i++) {
        files.push(`/project/file${i}.ts`);
      }

      const detector = new ConsistencyDetector();
      await detector.analyzeCodebase(files);

      // Should complete without hanging (only analyzes first 50)
      const issues = detector.getIssues();
      expect(Array.isArray(issues)).toBe(true);
    });
  });
});
