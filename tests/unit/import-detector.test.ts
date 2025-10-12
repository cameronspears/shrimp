import { describe, test, expect } from 'bun:test';
import { ImportDetector } from '../../src/detectors/import-detector.js';

describe('ImportDetector', () => {
  describe('Unused Imports', () => {
    test('detects completely unused import', async () => {
      const code = `
        import { unused } from './module';

        export function test() {
          return 'hello';
        }
      `;

      const detector = new ImportDetector();
      const issues = await detector.analyze('file.ts', code);

      const unusedIssue = issues.find(i => i.message.includes('Unused import: unused'));
      expect(unusedIssue).toBeDefined();
      expect(unusedIssue?.category).toBe('Unused Imports');
    });

    test('allows used imports', async () => {
      const code = `
        import { useState } from 'react';

        export function Component() {
          const [state, setState] = useState(0);
          return state;
        }
      `;

      const detector = new ImportDetector();
      const issues = await detector.analyze('Component.tsx', code);

      const unusedIssue = issues.find(i => i.message.includes('Unused import'));
      expect(unusedIssue).toBeUndefined();
    });

    test('detects partially unused symbols', async () => {
      const code = `
        import { used, unused } from './module';

        export function test() {
          return used();
        }
      `;

      const detector = new ImportDetector();
      const issues = await detector.analyze('file.ts', code);

      const unusedIssue = issues.find(i => i.message.includes('Unused symbols'));
      expect(unusedIssue).toBeDefined();
      expect(unusedIssue?.message).toContain('unused');
    });

    test('detects unused default import', async () => {
      const code = `
        import React from 'react';

        export const value = 42;
      `;

      const detector = new ImportDetector();
      const issues = await detector.analyze('file.tsx', code);

      const unusedIssue = issues.find(i => i.message.includes('Unused import: React'));
      expect(unusedIssue).toBeDefined();
    });

    test('detects unused namespace import', async () => {
      const code = `
        import * as Utils from './utils';

        export const value = 42;
      `;

      const detector = new ImportDetector();
      const issues = await detector.analyze('file.ts', code);

      const unusedIssue = issues.find(i => i.message.includes('Unused import: Utils'));
      expect(unusedIssue).toBeDefined();
    });

    test('allows imports with static methods', async () => {
      const code = `
        import { Redis } from '@upstash/redis';

        export const redis = Redis.fromEnv();
      `;

      const detector = new ImportDetector();
      const issues = await detector.analyze('redis.ts', code);

      const unusedIssue = issues.find(i => i.message.includes('Unused import: Redis'));
      expect(unusedIssue).toBeUndefined();
    });

    test('allows imports with aliased names', async () => {
      const code = `
        import { useState as useReactState } from 'react';

        export function Component() {
          const [state] = useReactState(0);
          return state;
        }
      `;

      const detector = new ImportDetector();
      const issues = await detector.analyze('Component.tsx', code);

      const unusedIssue = issues.find(i => i.message.includes('Unused'));
      expect(unusedIssue).toBeUndefined();
    });
  });

  describe('Import Organization', () => {
    test.skip('detects poorly organized imports (DISABLED: import organization is stylistic)', async () => {
      const code = `
        import { local1 } from './local';
        import { external1 } from 'external';
        import { absolute1 } from '@/absolute';
        import { local2 } from './local2';
        import { external2 } from 'external2';
        import { absolute2 } from '@/absolute2';
      `;

      const detector = new ImportDetector();
      const issues = await detector.analyze('file.ts', code);

      const orgIssue = issues.find(i => i.message.includes('not grouped by type'));
      expect(orgIssue).toBeDefined();
      expect(orgIssue?.category).toBe('Import Organization');
    });

    test('allows well-organized imports', async () => {
      const code = `
        import { external1 } from 'external1';
        import { external2 } from 'external2';
        import { absolute1 } from '@/absolute1';
        import { absolute2 } from '@/absolute2';
        import { local1 } from './local1';
        import { local2 } from './local2';
      `;

      const detector = new ImportDetector();
      const issues = await detector.analyze('file.ts', code);

      const orgIssue = issues.find(i => i.message.includes('not grouped'));
      expect(orgIssue).toBeUndefined();
    });

    test.skip('detects unsorted imports within group (DISABLED: import organization is stylistic)', async () => {
      const code = `
        import { z } from 'z-package';
        import { a } from 'a-package';
        import { m } from 'm-package';
      `;

      const detector = new ImportDetector();
      const issues = await detector.analyze('file.ts', code);

      const sortIssue = issues.find(i => i.message.includes('not sorted alphabetically'));
      expect(sortIssue).toBeDefined();
    });

    test('skips organization check for small files', async () => {
      const code = `
        import { a } from 'a';
        import { b } from 'b';
      `;

      const detector = new ImportDetector();
      const issues = await detector.analyze('file.ts', code);

      const orgIssue = issues.find(i => i.category === 'Import Organization');
      expect(orgIssue).toBeUndefined();
    });
  });

  describe('Circular Dependencies', () => {
    test('detects potential circular dependency', async () => {
      const code = `
        import { helper } from './file';

        export function test() {
          return helper();
        }
      `;

      const detector = new ImportDetector();
      const issues = await detector.analyze('src/file.ts', code);

      const circularIssue = issues.find(i => i.message.includes('circular dependency'));
      expect(circularIssue).toBeDefined();
      expect(circularIssue?.category).toBe('Circular Dependencies');
    });

    test('does not flag normal relative imports', async () => {
      const code = `
        import { helper } from './utils';

        export function test() {
          return helper();
        }
      `;

      const detector = new ImportDetector();
      const issues = await detector.analyze('src/components/Button.tsx', code);

      const circularIssue = issues.find(i => i.message.includes('circular dependency'));
      expect(circularIssue).toBeUndefined();
    });
  });

  describe('Duplicate Imports', () => {
    test('detects multiple value imports from same source', async () => {
      const code = `
        import { a } from 'module';
        import { b } from 'module';

        export const combined = a + b;
      `;

      const detector = new ImportDetector();
      const issues = await detector.analyze('file.ts', code);

      const dupIssue = issues.find(i => i.message.includes('Multiple value imports'));
      expect(dupIssue).toBeDefined();
      expect(dupIssue?.category).toBe('Duplicate Imports');
    });

    test('allows mixed type and value imports from same source', async () => {
      const code = `
        import type { User } from './types';
        import { getUser } from './types';

        export const user: User = getUser();
      `;

      const detector = new ImportDetector();
      const issues = await detector.analyze('file.ts', code);

      const dupIssue = issues.find(i => i.message.includes('Multiple'));
      expect(dupIssue).toBeUndefined();
    });

    test('detects multiple type imports from same source', async () => {
      const code = `
        import type { User } from './types';
        import type { Post } from './types';

        export function test(user: User, post: Post) {}
      `;

      const detector = new ImportDetector();
      const issues = await detector.analyze('file.ts', code);

      const dupIssue = issues.find(i => i.message.includes('Multiple type imports'));
      expect(dupIssue).toBeDefined();
    });
  });

  describe('Heavy Imports', () => {
    test('detects full lodash import', async () => {
      const code = `
        import lodash from 'lodash';

        export const result = lodash.map([1, 2, 3], x => x * 2);
      `;

      const detector = new ImportDetector();
      const issues = await detector.analyze('utils/helpers.ts', code);

      const heavyIssue = issues.find(i => i.message.includes('entire') && i.message.includes('lodash'));
      expect(heavyIssue).toBeDefined();
      expect(heavyIssue?.category).toBe('Heavy Imports');
    });

    test('allows specific lodash imports', async () => {
      const code = `
        import { map } from 'lodash';

        export const result = map([1, 2, 3], x => x * 2);
      `;

      const detector = new ImportDetector();
      const issues = await detector.analyze('utils/helpers.ts', code);

      const heavyIssue = issues.find(i => i.message.includes('entire') && i.message.includes('lodash'));
      expect(heavyIssue).toBeUndefined();
    });

    test('detects full moment import', async () => {
      const code = `
        import moment from 'moment';

        export const date = moment().format();
      `;

      const detector = new ImportDetector();
      const issues = await detector.analyze('utils/date.ts', code);

      const heavyIssue = issues.find(i => i.message.includes('moment'));
      expect(heavyIssue).toBeDefined();
    });

    test('allows heavy imports in app directory', async () => {
      const code = `
        import lodash from 'lodash';

        export default function Page() {
          return <div>{lodash.VERSION}</div>;
        }
      `;

      const detector = new ImportDetector();
      const issues = await detector.analyze('app/page.tsx', code);

      const heavyIssue = issues.find(i => i.category === 'Heavy Imports');
      expect(heavyIssue).toBeUndefined();
    });

    test('detects large barrel imports', async () => {
      const code = `
        import { a, b, c, d, e, f, g } from './index';

        export const all = [a, b, c, d, e, f, g];
      `;

      const detector = new ImportDetector();
      const issues = await detector.analyze('file.ts', code);

      const barrelIssue = issues.find(i => i.message.includes('Large barrel import'));
      expect(barrelIssue).toBeDefined();
    });

    test('allows small barrel imports', async () => {
      const code = `
        import { a, b } from './index';

        export const both = [a, b];
      `;

      const detector = new ImportDetector();
      const issues = await detector.analyze('file.ts', code);

      const barrelIssue = issues.find(i => i.message.includes('Large barrel import'));
      expect(barrelIssue).toBeUndefined();
    });
  });

  describe('getIssuesByCategory', () => {
    test('groups issues by category', async () => {
      const code = `
        import { unused } from './module';
        import lodash from 'lodash';
        import { a } from 'source';
        import { b } from 'source';

        export const result = lodash.map([1, 2], x => x);
      `;

      const detector = new ImportDetector();
      await detector.analyze('file.ts', code);
      const byCategory = detector.getIssuesByCategory();

      expect(Object.keys(byCategory).length).toBeGreaterThan(0);
      if (byCategory['Unused Imports']) {
        expect(byCategory['Unused Imports'].length).toBeGreaterThan(0);
      }
    });
  });

  describe('Edge Cases', () => {
    test('handles files with no imports', async () => {
      const code = `
        export function test() {
          return 'hello';
        }
      `;

      const detector = new ImportDetector();
      const issues = await detector.analyze('file.ts', code);

      expect(issues.length).toBe(0);
    });

    test('handles import with side effects', async () => {
      const code = `
        import './styles.css';

        export function Component() {
          return <div>Styled</div>;
        }
      `;

      const detector = new ImportDetector();
      const issues = await detector.analyze('Component.tsx', code);

      // Side-effect imports don't have symbols, should not cause errors
      expect(Array.isArray(issues)).toBe(true);
    });

    test('handles multi-line imports', async () => {
      const code = `
        import {
          useState,
          useEffect,
          useMemo
        } from 'react';

        export function Component() {
          useState(0);
          useEffect(() => {}, []);
          useMemo(() => 1, []);
        }
      `;

      const detector = new ImportDetector();
      const issues = await detector.analyze('Component.tsx', code);

      const unusedIssue = issues.find(i => i.message.includes('Unused'));
      expect(unusedIssue).toBeUndefined();
    });

    test('handles imports in JSX', async () => {
      const code = `
        import { Button } from './Button';

        export function Page() {
          return <Button>Click</Button>;
        }
      `;

      const detector = new ImportDetector();
      const issues = await detector.analyze('Page.tsx', code);

      const unusedIssue = issues.find(i => i.message.includes('Unused import: Button'));
      expect(unusedIssue).toBeUndefined();
    });

    test('provides line numbers for all issues', async () => {
      const code = `
        import { unused } from './module';
        import { a } from 'source';
        import { b } from 'source';

        export const test = 42;
      `;

      const detector = new ImportDetector();
      const issues = await detector.analyze('file.ts', code);

      for (const issue of issues) {
        expect(issue.line).toBeGreaterThan(0);
      }
    });
  });

  describe('Complex Scenarios', () => {
    test('handles destructuring with renamed imports', async () => {
      const code = `
        import { original as renamed } from './module';

        export function test() {
          return renamed();
        }
      `;

      const detector = new ImportDetector();
      const issues = await detector.analyze('file.ts', code);

      const unusedIssue = issues.find(i => i.message.includes('Unused'));
      expect(unusedIssue).toBeUndefined();
    });

    test('handles usage in template literals', async () => {
      const code = `
        import { API_URL } from './config';

        export function fetchData() {
          return fetch(\`\${API_URL}/data\`);
        }
      `;

      const detector = new ImportDetector();
      const issues = await detector.analyze('api.ts', code);

      const unusedIssue = issues.find(i => i.message.includes('Unused import: API_URL'));
      expect(unusedIssue).toBeUndefined();
    });

    test('detects unused when only import statement', async () => {
      const code = `
        import { unused } from './module';
      `;

      const detector = new ImportDetector();
      const issues = await detector.analyze('file.ts', code);

      const unusedIssue = issues.find(i => i.message.includes('Unused import: unused'));
      expect(unusedIssue).toBeDefined();
    });
  });
});
