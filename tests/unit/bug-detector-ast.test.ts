import { describe, test, expect } from 'bun:test';
import { BugDetectorAST } from '../../src/detectors/bug-detector-ast';

describe('BugDetectorAST', () => {
  describe('Empty Catch Blocks', () => {
    test('detects empty catch blocks', async () => {
      const code = `
        try {
          riskyOperation();
        } catch (error) {
          // Empty catch - bad!
        }
      `;

      const detector = new BugDetectorAST();
      const issues = await detector.analyze('test.ts', code);

      expect(issues.length).toBeGreaterThan(0);
      const emptyCatchIssue = issues.find(i => i.category === 'Error Handling');
      expect(emptyCatchIssue).toBeDefined();
      expect(emptyCatchIssue?.message).toContain('Empty catch block');
    });

    test('allows catch blocks with error handling', async () => {
      const code = `
        try {
          riskyOperation();
        } catch (error) {
          console.error('Operation failed:', error);
        }
      `;

      const detector = new BugDetectorAST();
      const issues = await detector.analyze('test.ts', code);

      const emptyCatchIssue = issues.find(i => i.message.includes('Empty catch block'));
      expect(emptyCatchIssue).toBeUndefined();
    });
  });

  describe('Async/Await Error Handling', () => {
    test('detects async functions without error handling', async () => {
      const code = `
        async function fetchData() {
          const data = await fetch('/api/data');
          return data.json();
        }
      `;

      const detector = new BugDetectorAST();
      const issues = await detector.analyze('test.ts', code);

      const asyncIssue = issues.find(i =>
        i.category === 'Error Handling' && i.message.includes('error handling')
      );
      expect(asyncIssue).toBeDefined();
    });

    test('allows async functions with try-catch', async () => {
      const code = `
        async function fetchData() {
          try {
            const data = await fetch('/api/data');
            return data.json();
          } catch (error) {
            console.error(error);
            throw error;
          }
        }
      `;

      const detector = new BugDetectorAST();
      const issues = await detector.analyze('test.ts', code);

      const asyncIssue = issues.find(i =>
        i.category === 'Error Handling' && i.message.includes('missing error handling')
      );
      expect(asyncIssue).toBeUndefined();
    });

    test('allows async functions with .catch() handler', async () => {
      const code = `
        async function fetchData() {
          return fetch('/api/data')
            .then(res => res.json())
            .catch(error => console.error(error));
        }
      `;

      const detector = new BugDetectorAST();
      const issues = await detector.analyze('test.ts', code);

      const asyncIssue = issues.find(i =>
        i.category === 'Error Handling' && i.message.includes('missing error handling')
      );
      expect(asyncIssue).toBeUndefined();
    });
  });

  describe('React Hook Issues', () => {
    test('detects conditional hook calls', async () => {
      const code = `
        function MyComponent() {
          if (condition) {
            useState(0); // Wrong!
          }
          return <div>Hello</div>;
        }
      `;

      const detector = new BugDetectorAST();
      const issues = await detector.analyze('MyComponent.tsx', code);

      const hookIssue = issues.find(i =>
        i.category === 'React Hooks' && i.message.includes('conditional')
      );
      expect(hookIssue).toBeDefined();
      expect(hookIssue?.severity).toBe('error');
    });

    test('detects hooks with empty dependency arrays', async () => {
      const code = `
        function MyComponent() {
          const [count, setCount] = useState(0);
          useEffect(() => {
            console.log(count);
          }, []); // Missing 'count' in deps!
          return <div>{count}</div>;
        }
      `;

      const detector = new BugDetectorAST();
      const issues = await detector.analyze('MyComponent.tsx', code);

      const depsIssue = issues.find(i =>
        i.category === 'React Hooks' && i.message.includes('dependency')
      );
      expect(depsIssue).toBeDefined();
    });

    test('allows proper hook usage', async () => {
      const code = `
        function MyComponent() {
          const [count, setCount] = useState(0);
          useEffect(() => {
            console.log('Mounted');
          }, []);
          return <div>{count}</div>;
        }
      `;

      const detector = new BugDetectorAST();
      const issues = await detector.analyze('MyComponent.tsx', code);

      const hookIssue = issues.find(i => i.category === 'React Hooks');
      // Empty deps for mount-only effect is valid
      expect(hookIssue).toBeUndefined();
    });
  });

  describe('Promise.all Error Handling', () => {
    test('detects Promise.all without error handling', async () => {
      const code = `
        function fetchAll() {
          Promise.all([fetch('/a'), fetch('/b')]);
        }
      `;

      const detector = new BugDetectorAST();
      const issues = await detector.analyze('test.ts', code);

      const promiseIssue = issues.find(i =>
        i.message.includes('Promise.all') && i.message.includes('error handling')
      );
      expect(promiseIssue).toBeDefined();
    });

    test('allows Promise.all with try-catch', async () => {
      const code = `
        async function fetchAll() {
          try {
            await Promise.all([fetch('/a'), fetch('/b')]);
          } catch (error) {
            console.error(error);
          }
        }
      `;

      const detector = new BugDetectorAST();
      const issues = await detector.analyze('test.ts', code);

      const promiseIssue = issues.find(i =>
        i.message.includes('Promise.all') && i.message.includes('without error handling')
      );
      expect(promiseIssue).toBeUndefined();
    });
  });

  describe('Resource Leaks', () => {
    test('detects setInterval without clearInterval', async () => {
      const code = `
        function startTimer() {
          setInterval(() => console.log('tick'), 1000);
        }
      `;

      const detector = new BugDetectorAST();
      const issues = await detector.analyze('test.ts', code);

      const leakIssue = issues.find(i =>
        i.category === 'Resource Leak' && i.message.includes('setInterval')
      );
      expect(leakIssue).toBeDefined();
    });

    test('allows setInterval with clearInterval', async () => {
      const code = `
        function MyComponent() {
          useEffect(() => {
            const id = setInterval(() => console.log('tick'), 1000);
            return () => clearInterval(id);
          }, []);
        }
      `;

      const detector = new BugDetectorAST();
      const issues = await detector.analyze('test.tsx', code);

      const leakIssue = issues.find(i =>
        i.category === 'Resource Leak' && i.message.includes('setInterval')
      );
      expect(leakIssue).toBeUndefined();
    });

    test('detects addEventListener without removeEventListener', async () => {
      const code = `
        function MyComponent() {
          useEffect(() => {
            window.addEventListener('resize', handleResize);
          }, []);
        }
      `;

      const detector = new BugDetectorAST();
      const issues = await detector.analyze('MyComponent.tsx', code);

      const leakIssue = issues.find(i =>
        i.category === 'Resource Leak' && i.message.includes('addEventListener')
      );
      expect(leakIssue).toBeDefined();
    });
  });

  describe('Security Issues', () => {
    test('detects eval() usage', async () => {
      const code = `
        function dangerousCode(input) {
          eval(input);
        }
      `;

      const detector = new BugDetectorAST();
      const issues = await detector.analyze('test.ts', code);

      const securityIssue = issues.find(i =>
        i.category === 'Security' && i.message.includes('eval')
      );
      expect(securityIssue).toBeDefined();
      expect(securityIssue?.severity).toBe('error');
    });

    test('detects potential SQL injection', async () => {
      const code = `
        function getUser(id) {
          return db.query(\`SELECT * FROM users WHERE id = \${id}\`);
        }
      `;

      const detector = new BugDetectorAST();
      const issues = await detector.analyze('test.ts', code);

      const sqlIssue = issues.find(i =>
        i.category === 'Security' && i.message.includes('SQL injection')
      );
      expect(sqlIssue).toBeDefined();
      expect(sqlIssue?.severity).toBe('error');
    });
  });

  describe('Logic Errors', () => {
    test('detects assignment in if condition', async () => {
      const code = `
        function check(value) {
          if (value = 5) { // Should be === !
            console.log('Is 5');
          }
        }
      `;

      const detector = new BugDetectorAST();
      const issues = await detector.analyze('test.ts', code);

      const logicIssue = issues.find(i =>
        i.category === 'Logic Error' && i.message.includes('Assignment')
      );
      expect(logicIssue).toBeDefined();
      expect(logicIssue?.severity).toBe('error');
    });

    test('detects forEach with async callback', async () => {
      const code = `
        async function processItems(items) {
          items.forEach(async (item) => {
            await processItem(item);
          });
        }
      `;

      const detector = new BugDetectorAST();
      const issues = await detector.analyze('test.ts', code);

      const forEachIssue = issues.find(i =>
        i.category === 'Logic Error' && i.message.includes('forEach')
      );
      expect(forEachIssue).toBeDefined();
      expect(forEachIssue?.severity).toBe('error');
    });
  });

  describe('Type Safety', () => {
    test('detects excessive any usage', async () => {
      const code = `
        function processData(data: any) {
          return data.value;
        }
      `;

      const detector = new BugDetectorAST();
      const issues = await detector.analyze('test.ts', code);

      const anyIssue = issues.find(i =>
        i.category === 'Type Safety' && i.message.includes('any')
      );
      expect(anyIssue).toBeDefined();
    });

    test('allows any in API routes', async () => {
      const code = `
        function handler(req: any, res: any) {
          res.json({});
        }
      `;

      const detector = new BugDetectorAST();
      const issues = await detector.analyze('api/users.ts', code);

      // Should allow 'any' in API routes
      const anyIssue = issues.find(i =>
        i.category === 'Type Safety' && i.message.includes('any')
      );
      expect(anyIssue).toBeUndefined();
    });

    test('detects non-null assertions', async () => {
      const code = `
        function getValue(obj: any) {
          return obj!.value!.nested!;
        }
      `;

      const detector = new BugDetectorAST();
      const issues = await detector.analyze('test.ts', code);

      const assertionIssue = issues.find(i =>
        i.category === 'Type Safety' && i.message.includes('Non-null assertion')
      );
      expect(assertionIssue).toBeDefined();
    });
  });

  describe('Code Complexity', () => {
    test('detects high complexity functions', async () => {
      const code = `
        function complexFunction(a, b, c) {
          if (a) {
            if (b) {
              if (c) {
                for (let i = 0; i < 10; i++) {
                  while (true) {
                    switch (i) {
                      case 1:
                        return true;
                      case 2:
                        return false;
                      default:
                        continue;
                    }
                  }
                }
              }
            }
          }
          return false;
        }
      `;

      const detector = new BugDetectorAST();
      const issues = await detector.analyze('test.ts', code);

      const complexityIssue = issues.find(i =>
        i.category === 'Code Complexity'
      );
      expect(complexityIssue).toBeDefined();
    });

    test('allows reasonable complexity', async () => {
      const code = `
        function simpleFunction(value) {
          if (value > 0) {
            return value * 2;
          }
          return 0;
        }
      `;

      const detector = new BugDetectorAST();
      const issues = await detector.analyze('test.ts', code);

      const complexityIssue = issues.find(i =>
        i.category === 'Code Complexity'
      );
      expect(complexityIssue).toBeUndefined();
    });
  });

  describe('getSeverityCount', () => {
    test('correctly counts issues by severity', async () => {
      const code = `
        function badCode() {
          eval('test'); // error
          if (x = 5) {} // error
          try {} catch (e) {} // warning
          const x: any; // info
        }
      `;

      const detector = new BugDetectorAST();
      await detector.analyze('test.ts', code);
      const counts = detector.getSeverityCount();

      expect(counts.error).toBeGreaterThan(0);
      expect(counts.warning).toBeGreaterThan(0);
      expect(counts.info).toBeGreaterThan(0);
    });
  });

  describe('getIssuesByCategory', () => {
    test('groups issues by category', async () => {
      const code = `
        function test() {
          eval('x'); // Security
          try {} catch (e) {} // Error Handling
          const x: any; // Type Safety
        }
      `;

      const detector = new BugDetectorAST();
      await detector.analyze('test.ts', code);
      const byCategory = detector.getIssuesByCategory();

      expect(Object.keys(byCategory).length).toBeGreaterThan(0);
      expect(byCategory['Security']).toBeDefined();
      expect(byCategory['Error Handling']).toBeDefined();
    });
  });
});
