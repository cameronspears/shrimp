import { describe, test, expect } from 'bun:test';
import { PerformanceDetector } from '../../src/detectors/performance-detector.js';

describe('PerformanceDetector', () => {
  describe('React Performance Issues', () => {
    test('detects array operations in render without useMemo', async () => {
      const code = `
        function MyComponent({ items }) {
          return (
            <div>
              {items.map(item => item.name).filter(n => n)}
            </div>
          );
        }
      `;

      const detector = new PerformanceDetector();
      const issues = await detector.analyze('Component.tsx', code);

      const memoIssue = issues.find(i => i.message.includes('without useMemo'));
      expect(memoIssue).toBeDefined();
      expect(memoIssue?.severity).toBe('moderate');
      expect(memoIssue?.category).toBe('React Performance');
    });

    test('allows array operations with useMemo', async () => {
      const code = `
        function MyComponent({ items }) {
          const filtered = useMemo(() =>
            items.filter(i => i.active),
            [items]
          );
          return <div>{filtered.length}</div>;
        }
      `;

      const detector = new PerformanceDetector();
      const issues = await detector.analyze('Component.tsx', code);

      const memoIssue = issues.find(i => i.message.includes('without useMemo'));
      expect(memoIssue).toBeUndefined();
    });

    test('detects missing key prop in mapped components', async () => {
      const code = `
        function List({ items }) {
          return items.map(item =>
            <div>{item.name}</div>
          );
        }
      `;

      const detector = new PerformanceDetector();
      const issues = await detector.analyze('List.tsx', code);

      const keyIssue = issues.find(i => i.message.includes('Missing key prop'));
      expect(keyIssue).toBeDefined();
      expect(keyIssue?.severity).toBe('moderate');
    });

    test('allows mapped components with key prop', async () => {
      const code = `
        function List({ items }) {
          return items.map(item =>
            <div key={item.id}>{item.name}</div>
          );
        }
      `;

      const detector = new PerformanceDetector();
      const issues = await detector.analyze('List.tsx', code);

      const keyIssue = issues.find(i => i.message.includes('Missing key prop'));
      expect(keyIssue).toBeUndefined();
    });

    test('detects useState with object literal', async () => {
      const code = `
        function Component() {
          const [state, setState] = useState({ count: 0 });
          return <div>{state.count}</div>;
        }
      `;

      const detector = new PerformanceDetector();
      const issues = await detector.analyze('Component.tsx', code);

      const stateIssue = issues.find(i => i.message.includes('useState initialized'));
      expect(stateIssue).toBeDefined();
      expect(stateIssue?.severity).toBe('minor');
    });

    test('detects useState with array literal', async () => {
      const code = `
        function Component() {
          const [items, setItems] = useState([1, 2, 3]);
          return <div>{items.length}</div>;
        }
      `;

      const detector = new PerformanceDetector();
      const issues = await detector.analyze('Component.tsx', code);

      const stateIssue = issues.find(i => i.message.includes('useState initialized'));
      expect(stateIssue).toBeDefined();
    });

    test('detects inline context value without useMemo', async () => {
      const code = `
        function Provider({ children }) {
          return (
            <MyContext.Provider value={{ user: 'John' }}>
              {children}
            </MyContext.Provider>
          );
        }
      `;

      const detector = new PerformanceDetector();
      const issues = await detector.analyze('Provider.tsx', code);

      const contextIssue = issues.find(i => i.message.includes('Context value'));
      expect(contextIssue).toBeDefined();
      expect(contextIssue?.severity).toBe('moderate');
    });

    test('detects complex component without React.memo', async () => {
      // Create a component with > 50 lines and complex logic
      const lines = [
        'export function ExpensiveComponent({ data }) {',
        '  const [state, setState] = useState(0);',
        '  const [count, setCount] = useState(0);',
        '  useEffect(() => { console.log("mount"); }, []);',
        '  const filtered = data.filter(d => d.active);',
        '  const mapped = filtered.map(d => d.id);',
        '  if (state > 10) { return null; }',
        '  if (count < 0) { return null; }',
      ];
      // Add more lines to exceed 50 line threshold
      for (let i = 0; i < 48; i++) {
        lines.push(`  const value${i} = data[${i}];`);
      }
      lines.push('  return <div>{filtered.length}</div>;');
      lines.push('}');

      const code = lines.join('\n');

      const detector = new PerformanceDetector();
      const issues = await detector.analyze('Component.tsx', code);

      const memoIssue = issues.find(i => i.message.includes('without React.memo'));
      expect(memoIssue).toBeDefined();
      expect(memoIssue?.severity).toBe('moderate');
    });

    test('detects useEffect with empty deps but external variables', async () => {
      const code = `
        function Component({ userId }) {
          useEffect(() => {
            fetchUser(userId);
            updateCache(userId);
            logEvent(userId);
            trackAnalytics(userId);
          }, []);
          return <div>User</div>;
        }
      `;

      const detector = new PerformanceDetector();
      const issues = await detector.analyze('Component.tsx', code);

      const depsIssue = issues.find(i => i.message.includes('empty deps'));
      expect(depsIssue).toBeDefined();
      expect(depsIssue?.severity).toBe('moderate');
    });
  });

  describe('General Performance Issues', () => {
    test('detects nested loops (O(n²) complexity)', async () => {
      const code = `
        function findDuplicates(arr) {
          for (let i = 0; i < arr.length; i++) {
            for (let j = i + 1; j < arr.length; j++) {
              if (arr[i] === arr[j]) {
                console.log('Duplicate');
              }
            }
          }
        }
      `;

      const detector = new PerformanceDetector();
      const issues = await detector.analyze('utils.ts', code);

      const nestedIssue = issues.find(i => i.message.includes('Nested loops'));
      expect(nestedIssue).toBeDefined();
      expect(nestedIssue?.severity).toBe('critical');
    });

    test('detects indexOf in loop (O(n²))', async () => {
      const code = `
        function filterArray(items, blacklist) {
          for (const item of items) {
            if (blacklist.indexOf(item) === -1) {
              result.push(item);
            }
          }
        }
      `;

      const detector = new PerformanceDetector();
      const issues = await detector.analyze('utils.ts', code);

      const indexOfIssue = issues.find(i => i.message.includes('indexOf in loop'));
      expect(indexOfIssue).toBeDefined();
      expect(indexOfIssue?.severity).toBe('moderate');
    });

    test('detects object creation in loop', async () => {
      const code = `
        function processItems(items) {
          for (const item of items) {
            const config = { name: item.name };
            process(config);
          }
        }
      `;

      const detector = new PerformanceDetector();
      const issues = await detector.analyze('utils.ts', code);

      const objIssue = issues.find(i => i.message.includes('Object/array creation inside loop'));
      expect(objIssue).toBeDefined();
      expect(objIssue?.severity).toBe('minor');
    });

    test('detects JSON.parse in loop', async () => {
      const code = `
        function parseItems(jsonStrings) {
          for (const str of jsonStrings) {
            const data = JSON.parse(str);
            console.log(data);
          }
        }
      `;

      const detector = new PerformanceDetector();
      const issues = await detector.analyze('parser.ts', code);

      const parseIssue = issues.find(i => i.message.includes('JSON.parse in loop'));
      expect(parseIssue).toBeDefined();
      expect(parseIssue?.severity).toBe('moderate');
    });

    test('detects synchronous file operations', async () => {
      const code = `
        function loadConfig() {
          const data = fs.readFileSync('./config.json', 'utf-8');
          return JSON.parse(data);
        }
      `;

      const detector = new PerformanceDetector();
      const issues = await detector.analyze('loader.ts', code);

      const syncIssue = issues.find(i => i.message.includes('Synchronous file operation'));
      expect(syncIssue).toBeDefined();
      expect(syncIssue?.severity).toBe('critical');
    });

    test('allows synchronous operations in config files', async () => {
      const code = `
        const config = fs.readFileSync('./config.json', 'utf-8');
      `;

      const detector = new PerformanceDetector();
      const issues = await detector.analyze('next.config.js', code);

      const syncIssue = issues.find(i => i.message.includes('Synchronous file operation'));
      expect(syncIssue).toBeUndefined();
    });

    test('detects RegExp compilation in loop', async () => {
      const code = `
        function validateItems(items) {
          for (const item of items) {
            const pattern = new RegExp(item.regex);
            if (pattern.test(item.value)) {
              console.log('Match');
            }
          }
        }
      `;

      const detector = new PerformanceDetector();
      const issues = await detector.analyze('validator.ts', code);

      const regexIssue = issues.find(i => i.message.includes('RegExp compilation'));
      expect(regexIssue).toBeDefined();
      expect(regexIssue?.severity).toBe('moderate');
    });
  });

  describe('Database Performance Issues', () => {
    test('detects N+1 query pattern with findOne', async () => {
      const code = `
        async function getUsers(ids) {
          return ids.map(async (id) => {
            return await db.findOne({ id });
          });
        }
      `;

      const detector = new PerformanceDetector();
      const issues = await detector.analyze('queries.ts', code);

      const n1Issue = issues.find(i => i.message.includes('N+1 query'));
      expect(n1Issue).toBeDefined();
      expect(n1Issue?.severity).toBe('critical');
    });

    test('detects N+1 query with forEach and await', async () => {
      const code = `
        async function loadData(items) {
          items.forEach(async (item) => {
            const data = await prisma.user.findById(item.userId);
            console.log(data);
          });
        }
      `;

      const detector = new PerformanceDetector();
      const issues = await detector.analyze('data.ts', code);

      const n1Issue = issues.find(i => i.message.includes('N+1 query'));
      expect(n1Issue).toBeDefined();
    });

    test('detects SELECT * queries', async () => {
      const code = `
        function getAllUsers() {
          return db.query('SELECT * FROM users');
        }
      `;

      const detector = new PerformanceDetector();
      const issues = await detector.analyze('queries.ts', code);

      const selectIssue = issues.find(i => i.message.includes('SELECT *'));
      expect(selectIssue).toBeDefined();
      expect(selectIssue?.severity).toBe('moderate');
    });

    test('detects findMany without where clause', async () => {
      const code = `
        async function getUsers() {
          return prisma.user.findMany({
            orderBy: { createdAt: 'desc' }
          });
        }
      `;

      const detector = new PerformanceDetector();
      const issues = await detector.analyze('queries.ts', code);

      const whereIssue = issues.find(i => i.message.includes('without where clause'));
      expect(whereIssue).toBeDefined();
      expect(whereIssue?.severity).toBe('minor');
    });
  });

  describe('Network Performance Issues', () => {
    test('detects fetch in loop', async () => {
      const code = `
        async function fetchAll(urls) {
          for (const url of urls) {
            await fetch(url);
          }
        }
      `;

      const detector = new PerformanceDetector();
      const issues = await detector.analyze('api.ts', code);

      const fetchIssue = issues.find(i => i.message.includes('fetch() call inside loop'));
      expect(fetchIssue).toBeDefined();
      expect(fetchIssue?.severity).toBe('critical');
    });

    test('detects API request without caching', async () => {
      const code = `
        async function getUser(id) {
          return fetch(\`/api/users/\${id}\`);
        }
      `;

      const detector = new PerformanceDetector();
      const issues = await detector.analyze('api.ts', code);

      const cacheIssue = issues.find(i => i.message.includes('without caching'));
      expect(cacheIssue).toBeDefined();
      expect(cacheIssue?.severity).toBe('minor');
    });

    test('allows requests with cache configuration', async () => {
      const code = `
        async function getUser(id) {
          const cache = new Map();
          if (cache.has(id)) return cache.get(id);
          return fetch(\`/api/users/\${id}\`);
        }
      `;

      const detector = new PerformanceDetector();
      const issues = await detector.analyze('api.ts', code);

      const cacheIssue = issues.find(i => i.message.includes('without caching'));
      expect(cacheIssue).toBeUndefined();
    });
  });

  describe('Memory Performance Issues', () => {
    test('detects large array allocation', async () => {
      const code = `
        function createBuffer() {
          const buffer = new Array(50000);
          return buffer;
        }
      `;

      const detector = new PerformanceDetector();
      const issues = await detector.analyze('buffer.ts', code);

      const arrayIssue = issues.find(i => i.message.includes('Large array allocation'));
      expect(arrayIssue).toBeDefined();
      expect(arrayIssue?.severity).toBe('moderate');
    });

    test('detects global mutable variables', async () => {
      const code = `let globalCache = {};
function updateCache(key, value) {
  globalCache[key] = value;
}`;

      const detector = new PerformanceDetector();
      const issues = await detector.analyze('cache.ts', code);

      const globalIssue = issues.find(i => i.message.includes('Global mutable variable'));
      expect(globalIssue).toBeDefined();
      expect(globalIssue?.severity).toBe('minor');
    });
  });

  describe('getSeverityCount', () => {
    test('correctly counts issues by severity', async () => {
      const code = `
        function bad() {
          for (let i = 0; i < 10; i++) {
            for (let j = 0; j < 10; j++) {
              fetch('/api');
              const data = JSON.parse(response);
            }
          }
          const state = useState({ big: 'object' });
        }
      `;

      const detector = new PerformanceDetector();
      await detector.analyze('bad.tsx', code);
      const counts = detector.getSeverityCount();

      expect(counts.critical).toBeGreaterThan(0);
      expect(counts.moderate).toBeGreaterThan(0);
      expect(counts.minor).toBeGreaterThan(0);
    });
  });

  describe('getIssuesByCategory', () => {
    test('groups issues by category', async () => {
      const code = `
        function Component() {
          useState({ obj: true });
          return items.map(i => <div>{i}</div>);
        }
        async function query() {
          users.map(async u => await db.get(u.id));
        }
      `;

      const detector = new PerformanceDetector();
      await detector.analyze('mixed.tsx', code);
      const byCategory = detector.getIssuesByCategory();

      expect(Object.keys(byCategory).length).toBeGreaterThan(0);
      expect(byCategory['React Performance']).toBeDefined();
    });
  });
});
