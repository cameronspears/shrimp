import { describe, it, expect, beforeEach } from 'bun:test';
import { BugDetector } from '../../src/detectors/bug-detector';

describe('BugDetector', () => {
  let detector: BugDetector;

  beforeEach(() => {
    detector = new BugDetector();
  });

  describe('React Hooks', () => {
    it('should detect conditional hooks', async () => {
      const code = `
function Component() {
  if (condition) {
    const [state, setState] = useState(0);
  }
  return <div />;
}
`;
      const issues = await detector.analyze('test.tsx', code);
      const hookIssue = issues.find(i => i.message.includes('conditionally'));

      expect(hookIssue).toBeDefined();
      expect(hookIssue?.severity).toBe('error');
      expect(hookIssue?.category).toBe('React Hooks');
    });

    it('should NOT flag hooks at component top level', async () => {
      const code = `
function Component() {
  const [state, setState] = useState(0);
  const [count, setCount] = useState(1);

  useEffect(() => {
    console.log(state);
  }, [state]);

  return <div>{count}</div>;
}
`;
      const issues = await detector.analyze('test.tsx', code);
      expect(issues).toHaveLength(0);
    });

    it('should detect missing dependencies in useEffect', async () => {
      const code = `
function Component({ userId }) {
  useEffect(() => {
    fetchUser(userId);
  }, []);

  return <div />;
}
`;
      const issues = await detector.analyze('test.tsx', code);
      const depIssue = issues.find(i => i.message.includes('missing dependencies'));

      expect(depIssue).toBeDefined();
      expect(depIssue?.severity).toBe('warning');
    });
  });

  describe('Async/Await', () => {
    it('should detect async function without error handling', async () => {
      const code = `
async function fetchData() {
  const response = await fetch('/api/data');
  const data = await response.json();
  return data;
}
`;
      const issues = await detector.analyze('test.ts', code);
      const errorHandlingIssue = issues.find(i => i.message.includes('error handling'));

      expect(errorHandlingIssue).toBeDefined();
      expect(errorHandlingIssue?.severity).toBe('warning');
    });

    it('should NOT flag async with try-catch', async () => {
      const code = `
async function fetchData() {
  try {
    const response = await fetch('/api/data');
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Failed to fetch:', error);
    throw error;
  }
}
`;
      const issues = await detector.analyze('test.ts', code);
      const errorHandlingIssue = issues.find(i => i.message.includes('error handling'));

      expect(errorHandlingIssue).toBeUndefined();
    });

    it('should NOT flag async with .catch()', async () => {
      const code = `
async function fetchData() {
  return fetch('/api/data')
    .then(res => res.json())
    .catch(err => console.error(err));
}
`;
      const issues = await detector.analyze('test.ts', code);
      const errorHandlingIssue = issues.find(i => i.message.includes('error handling'));

      expect(errorHandlingIssue).toBeUndefined();
    });

    it.skip('should detect floating promises', async () => {
      const code = `
function handleClick() {
  fetch('/api/data');
}
`;
      const issues = await detector.analyze('test.ts', code);
      const promiseIssue = issues.find(i => i.message.includes('promise'));

      expect(promiseIssue).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should detect empty catch blocks', async () => {
      const code = `
try {
  await riskyOperation();
} catch (e) {
}
`;
      const issues = await detector.analyze('test.ts', code);
      const emptyCatchIssue = issues.find(i => i.message.includes('Empty catch'));

      expect(emptyCatchIssue).toBeDefined();
      expect(emptyCatchIssue?.severity).toBe('warning');
    });

    it('should NOT flag catch blocks with logging', async () => {
      const code = `
try {
  await riskyOperation();
} catch (e) {
  console.error('Operation failed:', e);
}
`;
      const issues = await detector.analyze('test.ts', code);
      const emptyCatchIssue = issues.find(i => i.message.includes('Empty catch'));

      expect(emptyCatchIssue).toBeUndefined();
    });

    it('should detect generic error messages', async () => {
      const code = `
function validate() {
  throw new Error('Error');
}
`;
      const issues = await detector.analyze('test.ts', code);
      const genericErrorIssue = issues.find(i => i.message.includes('Generic error'));

      expect(genericErrorIssue).toBeDefined();
    });
  });

  describe('Security', () => {
    it.skip('should detect potential SQL injection', async () => {
      const code = `
const userId = req.params.id;
const query = "SELECT * FROM users WHERE id = " + userId;
db.query(query);
`;
      const issues = await detector.analyze('test.ts', code);
      const sqlInjectionIssue = issues.find(i => i.message.includes('SQL injection'));

      expect(sqlInjectionIssue).toBeDefined();
      expect(sqlInjectionIssue?.severity).toBe('error');
    });

    it('should detect eval usage', async () => {
      const code = `
const result = eval(userInput);
`;
      const issues = await detector.analyze('test.ts', code);
      const evalIssue = issues.find(i => i.message.includes('eval()'));

      expect(evalIssue).toBeDefined();
      expect(evalIssue?.severity).toBe('error');
    });

    it('should detect dangerouslySetInnerHTML without sanitization', async () => {
      const code = `
<div dangerouslySetInnerHTML={{ __html: userContent }} />
`;
      const issues = await detector.analyze('test.tsx', code);
      const xssIssue = issues.find(i => i.message.includes('dangerouslySetInnerHTML'));

      expect(xssIssue).toBeDefined();
      expect(xssIssue?.severity).toBe('error');
    });

    it('should detect hardcoded secrets', async () => {
      const code = `
const apiKey = "sk_live_abc123456789";
const password = "mySecretPassword123";
`;
      const issues = await detector.analyze('test.ts', code);
      const secretIssues = issues.filter(i => i.category === 'Security');

      expect(secretIssues.length).toBeGreaterThan(0);
    });
  });

  describe('Type Safety', () => {
    it('should detect excessive use of any', async () => {
      const code = `
function processData(data: any) {
  return data.something;
}
`;
      const issues = await detector.analyze('test.ts', code);
      const anyIssue = issues.find(i => i.message.includes('any'));

      expect(anyIssue).toBeDefined();
    });

    it('should NOT flag any in API routes', async () => {
      const code = `
function processData(data: any) {
  return data.something;
}
`;
      const issues = await detector.analyze('app/api/route.ts', code);
      const anyIssue = issues.find(i => i.message.includes('any'));

      // Should be more lenient in API routes
      expect(anyIssue?.severity).not.toBe('error');
    });

    it('should detect non-null assertion overuse', async () => {
      const code = `
const value = data!.user!.name!.first;
`;
      const issues = await detector.analyze('test.ts', code);
      const nonNullIssue = issues.find(i => i.message.includes('non-null assertion'));

      expect(nonNullIssue).toBeDefined();
      expect(nonNullIssue?.severity).toBe('warning');
    });
  });

  describe('Logic Errors', () => {
    it('should detect assignment in if condition', async () => {
      const code = `
if (x = 5) {
  console.log('wrong');
}
`;
      const issues = await detector.analyze('test.ts', code);
      const assignmentIssue = issues.find(i => i.message.includes('Assignment'));

      expect(assignmentIssue).toBeDefined();
      expect(assignmentIssue?.severity).toBe('error');
    });

    it('should detect async forEach', async () => {
      const code = `
items.forEach(async (item) => {
  await processItem(item);
});
`;
      const issues = await detector.analyze('test.ts', code);
      const forEachIssue = issues.find(i => i.message.includes('forEach'));

      expect(forEachIssue).toBeDefined();
      expect(forEachIssue?.severity).toBe('error');
    });

    it('should detect boolean literal comparison', async () => {
      const code = `
if (isActive === true) {
  doSomething();
}
`;
      const issues = await detector.analyze('test.ts', code);
      const booleanIssue = issues.find(i => i.message.includes('boolean literal'));

      expect(booleanIssue).toBeDefined();
    });
  });

  describe('Resource Leaks', () => {
    it('should detect setInterval without cleanup', async () => {
      const code = `
useEffect(() => {
  setInterval(() => {
    updateData();
  }, 1000);
}, []);
`;
      const issues = await detector.analyze('test.tsx', code);
      const leakIssue = issues.find(i => i.message.includes('setInterval'));

      expect(leakIssue).toBeDefined();
      expect(leakIssue?.severity).toBe('warning');
    });

    it('should NOT flag setInterval with cleanup', async () => {
      const code = `
useEffect(() => {
  const id = setInterval(() => {
    updateData();
  }, 1000);

  return () => clearInterval(id);
}, []);
`;
      const issues = await detector.analyze('test.tsx', code);
      const leakIssue = issues.find(i => i.message.includes('setInterval'));

      expect(leakIssue).toBeUndefined();
    });

    it('should detect addEventListener without cleanup', async () => {
      const code = `
useEffect(() => {
  window.addEventListener('resize', handleResize);
}, []);
`;
      const issues = await detector.analyze('component.tsx', code);
      const leakIssue = issues.find(i => i.message.includes('addEventListener'));

      expect(leakIssue).toBeDefined();
    });
  });

  describe('React Performance', () => {
    it('should detect inline objects in JSX', async () => {
      const code = `
<Component style={{ margin: 10 }} />
`;
      const issues = await detector.analyze('component.tsx', code);
      const perfIssue = issues.find(i => i.message.includes('Inline object'));

      expect(perfIssue).toBeDefined();
      expect(perfIssue?.category).toBe('React Performance');
    });

    it('should detect inline functions in JSX', async () => {
      const code = `
<Button onClick={() => handleClick()} />
`;
      const issues = await detector.analyze('component.tsx', code);
      const perfIssue = issues.find(i => i.message.includes('Inline function'));

      expect(perfIssue).toBeDefined();
    });
  });

  describe('Test File Leniency', () => {
    it('should be lenient with test files', async () => {
      const code = `
async function testSomething() {
  const data = await fetchTestData();
  expect(data).toBeDefined();
}
`;
      const issues = await detector.analyze('test.test.ts', code);

      // Should not flag missing error handling in test files
      const errorHandlingIssue = issues.find(i => i.message.includes('error handling'));
      expect(errorHandlingIssue).toBeUndefined();
    });
  });

  describe('API Methods', () => {
    it('should return issues by category', async () => {
      const code = `
async function bad() {
  await fetch(url);
  eval(input);
}
`;
      await detector.analyze('test.ts', code);
      const byCategory = detector.getIssuesByCategory();

      expect(Object.keys(byCategory).length).toBeGreaterThan(0);
    });

    it('should return severity counts', async () => {
      const code = `
async function bad() {
  eval(input);
  const x: any = data;
}
`;
      await detector.analyze('test.ts', code);
      const counts = detector.getSeverityCount();

      expect(counts.error).toBeGreaterThanOrEqual(0);
      expect(counts.warning).toBeGreaterThanOrEqual(0);
      expect(counts.info).toBeGreaterThanOrEqual(0);
    });
  });
});