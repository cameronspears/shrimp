import { describe, test, expect } from 'bun:test';
import { WCAGDetector } from '../../src/detectors/wcag-detector.js';

describe('WCAGDetector', () => {
  describe('Image Accessibility (WCAG 1.1.1)', () => {
    test('detects images without alt attribute', async () => {
      const code = `
        function Component() {
          return <img src="/logo.png" />;
        }
      `;

      const detector = new WCAGDetector();
      const issues = await detector.analyze('Component.tsx', code);

      const altIssue = issues.find(i => i.message.includes('missing alt'));
      expect(altIssue).toBeDefined();
      expect(altIssue?.severity).toBe('error');
      expect(altIssue?.level).toBe('A');
    });

    test('allows images with alt text', async () => {
      const code = `
        function Component() {
          return <img src="/logo.png" alt="Company logo" />;
        }
      `;

      const detector = new WCAGDetector();
      const issues = await detector.analyze('Component.tsx', code);

      const altIssue = issues.find(i => i.message.includes('missing alt'));
      expect(altIssue).toBeUndefined();
    });

    test('allows decorative images with empty alt', async () => {
      const code = `
        function Component() {
          return <img src="/decoration.png" alt="" />;
        }
      `;

      const detector = new WCAGDetector();
      const issues = await detector.analyze('Component.tsx', code);

      const altIssue = issues.find(i => i.message.includes('missing alt'));
      expect(altIssue).toBeUndefined();
    });

    test('detects redundant words in alt text', async () => {
      const code = `
        function Component() {
          return <img src="/chart.png" alt="Image of sales chart" />;
        }
      `;

      const detector = new WCAGDetector();
      const issues = await detector.analyze('Component.tsx', code);

      const redundantIssue = issues.find(i => i.message.includes('redundant words'));
      expect(redundantIssue).toBeDefined();
      expect(redundantIssue?.severity).toBe('warning');
    });

    test('detects Next.js Image without alt', async () => {
      const code = `
        function Component() {
          return <Image src="/photo.jpg" width={500} height={300} />;
        }
      `;

      const detector = new WCAGDetector();
      const issues = await detector.analyze('Component.tsx', code);

      const altIssue = issues.find(i => i.message.includes('missing alt'));
      expect(altIssue).toBeDefined();
    });

    test('detects background images without text alternative', async () => {
      const code = `
        function Component() {
          return <div style={{ backgroundImage: 'url(/hero.jpg)' }}>Content</div>;
        }
      `;

      const detector = new WCAGDetector();
      const issues = await detector.analyze('Component.tsx', code);

      const bgIssue = issues.find(i => i.message.includes('Background image'));
      expect(bgIssue).toBeDefined();
      expect(bgIssue?.severity).toBe('warning');
    });
  });

  describe('Video & Audio Accessibility (WCAG 1.2)', () => {
    test('detects video without captions', async () => {
      const code = `
        function Component() {
          return <video src="/video.mp4" />;
        }
      `;

      const detector = new WCAGDetector();
      const issues = await detector.analyze('Player.tsx', code);

      const captionIssue = issues.find(i => i.message.includes('missing captions'));
      expect(captionIssue).toBeDefined();
      expect(captionIssue?.severity).toBe('error');
      expect(captionIssue?.level).toBe('A');
    });

    test('allows video with track element', async () => {
      const code = `
        function Component() {
          return (
            <video src="/video.mp4">
              <track kind="captions" src="/captions.vtt" />
            </video>
          );
        }
      `;

      const detector = new WCAGDetector();
      const issues = await detector.analyze('Player.tsx', code);

      const captionIssue = issues.find(i => i.message.includes('missing captions'));
      expect(captionIssue).toBeUndefined();
    });

    test('detects video without controls', async () => {
      const code = `
        function Component() {
          return <video src="/video.mp4" />;
        }
      `;

      const detector = new WCAGDetector();
      const issues = await detector.analyze('Player.tsx', code);

      const controlsIssue = issues.find(i => i.message.includes('without controls'));
      expect(controlsIssue).toBeDefined();
      expect(controlsIssue?.severity).toBe('error');
    });

    test('detects audio without controls', async () => {
      const code = `
        function Component() {
          return <audio src="/podcast.mp3" />;
        }
      `;

      const detector = new WCAGDetector();
      const issues = await detector.analyze('Player.tsx', code);

      const controlsIssue = issues.find(i => i.message.includes('without controls'));
      expect(controlsIssue).toBeDefined();
    });
  });

  describe('Color & Contrast (WCAG 1.4)', () => {
    test('detects potentially low contrast colors', async () => {
      const code = `
        function Component() {
          return <p className="text-gray-300">Light text</p>;
        }
      `;

      const detector = new WCAGDetector();
      const issues = await detector.analyze('Component.tsx', code);

      const contrastIssue = issues.find(i => i.message.includes('low color contrast'));
      expect(contrastIssue).toBeDefined();
      expect(contrastIssue?.severity).toBe('warning');
      expect(contrastIssue?.level).toBe('AA');
    });

    test('detects color as only visual indicator', async () => {
      const code = `
        function Component() {
          return <span style={{ color: 'red' }} className="error">Error</span>;
        }
      `;

      const detector = new WCAGDetector();
      const issues = await detector.analyze('Component.tsx', code);

      const colorOnlyIssue = issues.find(i => i.message.includes('only visual indicator'));
      expect(colorOnlyIssue).toBeDefined();
      expect(colorOnlyIssue?.level).toBe('A');
    });
  });

  describe('Icons & SVG (WCAG 1.1.1)', () => {
    test('detects icons without text alternative', async () => {
      const code = `
        function Component() {
          return <SearchIcon />;
        }
      `;

      const detector = new WCAGDetector();
      const issues = await detector.analyze('Component.tsx', code);

      const iconIssue = issues.find(i => i.message.includes('Icon without text alternative'));
      expect(iconIssue).toBeDefined();
      expect(iconIssue?.severity).toBe('error');
    });

    test('allows icons with aria-label', async () => {
      const code = `
        function Component() {
          return <SearchIcon aria-label="Search" />;
        }
      `;

      const detector = new WCAGDetector();
      const issues = await detector.analyze('Component.tsx', code);

      const iconIssue = issues.find(i => i.message.includes('Icon without text alternative'));
      expect(iconIssue).toBeUndefined();
    });

    test('detects SVG without title or label', async () => {
      const code = `
        function Component() {
          return <svg width="20" height="20"><circle cx="10" cy="10" r="10" /></svg>;
        }
      `;

      const detector = new WCAGDetector();
      const issues = await detector.analyze('Component.tsx', code);

      const svgIssue = issues.find(i => i.message.includes('SVG without title'));
      expect(svgIssue).toBeDefined();
      expect(svgIssue?.severity).toBe('warning');
    });

    test('allows decorative SVG with aria-hidden', async () => {
      const code = `
        function Component() {
          return <svg aria-hidden="true"><circle cx="10" cy="10" r="10" /></svg>;
        }
      `;

      const detector = new WCAGDetector();
      const issues = await detector.analyze('Component.tsx', code);

      const svgIssue = issues.find(i => i.message.includes('SVG without title'));
      expect(svgIssue).toBeUndefined();
    });
  });

  describe('Keyboard Accessibility (WCAG 2.1.1)', () => {
    test('detects onClick on div without keyboard handler', async () => {
      const code = `
        function Component() {
          return <div onClick={handleClick}>Click me</div>;
        }
      `;

      const detector = new WCAGDetector();
      const issues = await detector.analyze('Component.tsx', code);

      const keyboardIssue = issues.find(i => i.message.includes('without keyboard handler'));
      expect(keyboardIssue).toBeDefined();
      expect(keyboardIssue?.severity).toBe('error');
      expect(keyboardIssue?.level).toBe('A');
    });

    test('allows onClick with onKeyDown', async () => {
      const code = `
        function Component() {
          return <div onClick={handleClick} onKeyDown={handleKey}>Click me</div>;
        }
      `;

      const detector = new WCAGDetector();
      const issues = await detector.analyze('Component.tsx', code);

      const keyboardIssue = issues.find(i => i.message.includes('without keyboard handler'));
      expect(keyboardIssue).toBeUndefined();
    });

    test('detects missing role on clickable div', async () => {
      const code = `
        function Component() {
          return <div onClick={handleClick}>Click me</div>;
        }
      `;

      const detector = new WCAGDetector();
      const issues = await detector.analyze('Component.tsx', code);

      const roleIssue = issues.find(i => i.message.includes('missing ARIA role'));
      expect(roleIssue).toBeDefined();
      expect(roleIssue?.severity).toBe('warning');
    });

    test('detects hover-only interactions', async () => {
      const code = `
        function Component() {
          return <div onMouseOver={showMenu}>Hover me</div>;
        }
      `;

      const detector = new WCAGDetector();
      const issues = await detector.analyze('Component.tsx', code);

      const hoverIssue = issues.find(i => i.message.includes('Hover-only interaction'));
      expect(hoverIssue).toBeDefined();
      expect(hoverIssue?.severity).toBe('warning');
    });
  });

  describe('Focus Management (WCAG 2.4)', () => {
    test('detects positive tabIndex values', async () => {
      const code = `
        function Component() {
          return <button tabIndex={5}>Click</button>;
        }
      `;

      const detector = new WCAGDetector();
      const issues = await detector.analyze('Component.tsx', code);

      const tabIndexIssue = issues.find(i => i.message.includes('Positive tabIndex'));
      expect(tabIndexIssue).toBeDefined();
      expect(tabIndexIssue?.severity).toBe('warning');
      expect(tabIndexIssue?.level).toBe('A');
    });

    test('detects outline removal without alternative', async () => {
      const code = `
        function Component() {
          return <button style={{ outline: 'none' }}>Click</button>;
        }
      `;

      const detector = new WCAGDetector();
      const issues = await detector.analyze('Component.tsx', code);

      const outlineIssue = issues.find(i => i.message.includes('Focus outline removed'));
      expect(outlineIssue).toBeDefined();
      expect(outlineIssue?.severity).toBe('error');
      expect(outlineIssue?.level).toBe('AA');
    });

    test('allows outline removal with focus alternative', async () => {
      const code = `
        function Component() {
          return (
            <button
              style={{ outline: 'none' }}
              className="focus:ring-2"
            >
              Click
            </button>
          );
        }
      `;

      const detector = new WCAGDetector();
      const issues = await detector.analyze('Component.tsx', code);

      const outlineIssue = issues.find(i => i.message.includes('Focus outline removed'));
      expect(outlineIssue).toBeUndefined();
    });

    test('warns about autoFocus usage', async () => {
      const code = `
        function Component() {
          return <input autoFocus />;
        }
      `;

      const detector = new WCAGDetector();
      const issues = await detector.analyze('Component.tsx', code);

      const autoFocusIssue = issues.find(i => i.message.includes('autoFocus'));
      expect(autoFocusIssue).toBeDefined();
      expect(autoFocusIssue?.severity).toBe('info');
    });
  });

  describe('Navigation (WCAG 2.4)', () => {
    test('detects generic link text', async () => {
      const code = `
        function Component() {
          return <a href="/page">Click here</a>;
        }
      `;

      const detector = new WCAGDetector();
      const issues = await detector.analyze('Component.tsx', code);

      const linkIssue = issues.find(i => i.message.includes('lacks context'));
      expect(linkIssue).toBeDefined();
      expect(linkIssue?.severity).toBe('warning');
      expect(linkIssue?.level).toBe('A');
    });

    test('detects missing skip link in layout', async () => {
      const code = `
        function Layout() {
          return (
            <div>
              <header>Header</header>
              <nav>Navigation</nav>
            </div>
          );
        }
      `;

      const detector = new WCAGDetector();
      const issues = await detector.analyze('layout.tsx', code);

      const skipIssue = issues.find(i => i.message.includes('skip-to-content'));
      expect(skipIssue).toBeDefined();
      expect(skipIssue?.severity).toBe('warning');
    });

    test('detects nav without aria-label', async () => {
      const code = `
        function Component() {
          return <nav><a href="/">Home</a></nav>;
        }
      `;

      const detector = new WCAGDetector();
      const issues = await detector.analyze('Component.tsx', code);

      const navIssue = issues.find(i => i.message.includes('Navigation element without label'));
      expect(navIssue).toBeDefined();
      expect(navIssue?.severity).toBe('info');
    });
  });

  describe('Timing (WCAG 2.2)', () => {
    test('detects automatic refresh without controls', async () => {
      const code = `
        function Component() {
          useEffect(() => {
            setTimeout(() => window.location.reload(), 5000);
          }, []);
        }
      `;

      const detector = new WCAGDetector();
      const issues = await detector.analyze('Component.tsx', code);

      const timingIssue = issues.find(i => i.message.includes('Automatic refresh'));
      expect(timingIssue).toBeDefined();
      expect(timingIssue?.severity).toBe('warning');
      expect(timingIssue?.level).toBe('A');
    });

    test('detects auto-playing carousel without pause', async () => {
      const code = `
        function Carousel() {
          return <div className="carousel" autoplay={true}>Slides</div>;
        }
      `;

      const detector = new WCAGDetector();
      const issues = await detector.analyze('Carousel.tsx', code);

      const carouselIssue = issues.find(i => i.message.includes('Auto-playing carousel'));
      expect(carouselIssue).toBeDefined();
      expect(carouselIssue?.severity).toBe('error');
    });
  });

  describe('Forms (WCAG 3.3)', () => {
    test('detects input without label', async () => {
      const code = `
        function Form() {
          return <input type="text" />;
        }
      `;

      const detector = new WCAGDetector();
      const issues = await detector.analyze('Form.tsx', code);

      const labelIssue = issues.find(i => i.message.includes('Input field missing label'));
      expect(labelIssue).toBeDefined();
      expect(labelIssue?.severity).toBe('error');
      expect(labelIssue?.level).toBe('A');
    });

    test('allows input with label element', async () => {
      const code = `
        function Form() {
          return (
            <div>
              <label htmlFor="name">Name</label>
              <input type="text" id="name" />
            </div>
          );
        }
      `;

      const detector = new WCAGDetector();
      const issues = await detector.analyze('Form.tsx', code);

      const labelIssue = issues.find(i => i.message.includes('Input field missing label'));
      expect(labelIssue).toBeUndefined();
    });

    test('allows input with aria-label', async () => {
      const code = `
        function Form() {
          return <input type="text" aria-label="Search query" />;
        }
      `;

      const detector = new WCAGDetector();
      const issues = await detector.analyze('Form.tsx', code);

      const labelIssue = issues.find(i => i.message.includes('Input field missing label'));
      expect(labelIssue).toBeUndefined();
    });

    test('warns about placeholder-only labels', async () => {
      const code = `
        function Form() {
          return <input type="text" placeholder="Enter name" />;
        }
      `;

      const detector = new WCAGDetector();
      const issues = await detector.analyze('Form.tsx', code);

      const placeholderIssue = issues.find(i => i.message.includes('placeholder as label'));
      expect(placeholderIssue).toBeDefined();
      expect(placeholderIssue?.severity).toBe('warning');
    });

    test('detects required field without indicator', async () => {
      const code = `
        function Form() {
          return <input type="text" required />;
        }
      `;

      const detector = new WCAGDetector();
      const issues = await detector.analyze('Form.tsx', code);

      const requiredIssue = issues.find(i => i.message.includes('Required field without visible indicator'));
      expect(requiredIssue).toBeDefined();
      expect(requiredIssue?.severity).toBe('warning');
    });

    test('detects error message not linked to input', async () => {
      const code = `
        function Form() {
          return (
            <div>
              <input type="email" />
              <span className="error">Invalid email</span>
            </div>
          );
        }
      `;

      const detector = new WCAGDetector();
      const issues = await detector.analyze('Form.tsx', code);

      const errorIssue = issues.find(i => i.message.includes('not associated with input'));
      expect(errorIssue).toBeDefined();
      expect(errorIssue?.severity).toBe('warning');
    });

    test('detects destructive action without confirmation', async () => {
      const code = `
        function DeleteButton() {
          return <button type="submit">Delete Account</button>;
        }
      `;

      const detector = new WCAGDetector();
      const issues = await detector.analyze('delete-form.tsx', code);

      const confirmIssue = issues.find(i => i.message.includes('without confirmation'));
      expect(confirmIssue).toBeDefined();
      expect(confirmIssue?.severity).toBe('warning');
      expect(confirmIssue?.level).toBe('AA');
    });
  });

  describe('Language (WCAG 3.1)', () => {
    test('detects missing lang attribute in layout', async () => {
      const code = `
        export default function RootLayout() {
          return <html><body>Content</body></html>;
        }
      `;

      const detector = new WCAGDetector();
      const issues = await detector.analyze('layout.tsx', code);

      const langIssue = issues.find(i => i.message.includes('missing lang attribute'));
      expect(langIssue).toBeDefined();
      expect(langIssue?.severity).toBe('error');
      expect(langIssue?.level).toBe('A');
    });

    test('detects foreign language content without lang', async () => {
      const code = `
        function Component() {
          return <p>Bonjour à tous</p>;
        }
      `;

      const detector = new WCAGDetector();
      const issues = await detector.analyze('Component.tsx', code);

      const foreignIssue = issues.find(i => i.message.includes('Foreign language content'));
      expect(foreignIssue).toBeDefined();
      expect(foreignIssue?.severity).toBe('info');
      expect(foreignIssue?.level).toBe('AA');
    });
  });

  describe('Semantic HTML (WCAG 4.1)', () => {
    test('detects excessive div nesting', async () => {
      const code = `
        function Component() {
          return (
            <div>
              <div>
                <div>
                  <div>
                    <div>Content</div>
                  </div>
                </div>
              </div>
            </div>
          );
        }
      `;

      const detector = new WCAGDetector();
      const issues = await detector.analyze('Component.tsx', code);

      const divIssue = issues.find(i => i.message.includes('Excessive div nesting'));
      expect(divIssue).toBeDefined();
      expect(divIssue?.severity).toBe('info');
    });

    test('detects div with role=button instead of button', async () => {
      const code = `
        function Component() {
          return <div role="button" onClick={handleClick}>Click</div>;
        }
      `;

      const detector = new WCAGDetector();
      const issues = await detector.analyze('Component.tsx', code);

      const buttonIssue = issues.find(i => i.message.includes('instead of <button>'));
      expect(buttonIssue).toBeDefined();
      expect(buttonIssue?.severity).toBe('warning');
    });

    test('detects missing main landmark in page', async () => {
      const code = `
        export default function Page() {
          return (
            <div>
              <header>Header</header>
              <div>Content</div>
            </div>
          );
        }
      `;

      const detector = new WCAGDetector();
      const issues = await detector.analyze('page.tsx', code);

      const mainIssue = issues.find(i => i.message.includes('missing <main> landmark'));
      expect(mainIssue).toBeDefined();
      expect(mainIssue?.severity).toBe('warning');
    });
  });

  describe('ARIA (WCAG 4.1.2)', () => {
    test('detects invalid ARIA role', async () => {
      const code = `
        function Component() {
          return <div role="invalid-role">Content</div>;
        }
      `;

      const detector = new WCAGDetector();
      const issues = await detector.analyze('Component.tsx', code);

      const roleIssue = issues.find(i => i.message.includes('Invalid ARIA role'));
      expect(roleIssue).toBeDefined();
      expect(roleIssue?.severity).toBe('error');
    });

    test('allows valid ARIA roles', async () => {
      const code = `
        function Component() {
          return <div role="button">Click</div>;
        }
      `;

      const detector = new WCAGDetector();
      const issues = await detector.analyze('Component.tsx', code);

      const roleIssue = issues.find(i => i.message.includes('Invalid ARIA role'));
      expect(roleIssue).toBeUndefined();
    });

    test('detects empty aria-label', async () => {
      const code = `
        function Component() {
          return <button aria-label="">Click</button>;
        }
      `;

      const detector = new WCAGDetector();
      const issues = await detector.analyze('Component.tsx', code);

      const emptyIssue = issues.find(i => i.message.includes('Empty aria-label'));
      expect(emptyIssue).toBeDefined();
      expect(emptyIssue?.severity).toBe('error');
    });

    test('warns about aria-label on non-interactive elements', async () => {
      const code = `
        function Component() {
          return <div aria-label="Description">Content</div>;
        }
      `;

      const detector = new WCAGDetector();
      const issues = await detector.analyze('Component.tsx', code);

      const labelIssue = issues.find(i => i.message.includes('aria-label on non-interactive element'));
      expect(labelIssue).toBeDefined();
      expect(labelIssue?.severity).toBe('info');
    });
  });

  describe('Heading Structure (WCAG 1.3.1)', () => {
    test('detects skipped heading levels', async () => {
      const code = `
        function Component() {
          return (
            <div>
              <h1>Title</h1>
              <h3>Subsection</h3>
            </div>
          );
        }
      `;

      const detector = new WCAGDetector();
      const issues = await detector.analyze('Component.tsx', code);

      const headingIssue = issues.find(i => i.message.includes('Heading level skipped'));
      expect(headingIssue).toBeDefined();
      expect(headingIssue?.severity).toBe('warning');
    });

    test('warns about multiple h1 elements', async () => {
      const code = `
        function Component() {
          return (
            <div>
              <h1>First Title</h1>
              <h1>Second Title</h1>
            </div>
          );
        }
      `;

      const detector = new WCAGDetector();
      const issues = await detector.analyze('Component.tsx', code);

      const h1Issue = issues.find(i => i.message.includes('Multiple h1 elements'));
      expect(h1Issue).toBeDefined();
      expect(h1Issue?.severity).toBe('info');
    });
  });

  describe('getSeverityCount', () => {
    test('correctly counts issues by severity', async () => {
      const code = `
        function Component() {
          return (
            <div>
              <img src="/logo.png" />
              <video src="/video.mp4" />
              <button tabIndex={5}>Click</button>
            </div>
          );
        }
      `;

      const detector = new WCAGDetector();
      await detector.analyze('Component.tsx', code);
      const counts = detector.getSeverityCount();

      expect(counts.error).toBeGreaterThan(0);
      expect(counts.warning).toBeGreaterThan(0);
    });
  });

  describe('getIssuesByLevel', () => {
    test('groups issues by WCAG level', async () => {
      const code = `
        function Component() {
          return (
            <div>
              <img src="/logo.png" />
              <div style={{ outline: 'none' }}>Focus</div>
            </div>
          );
        }
      `;

      const detector = new WCAGDetector();
      await detector.analyze('Component.tsx', code);
      const byLevel = detector.getIssuesByLevel();

      expect(byLevel.A.length).toBeGreaterThan(0);
      expect(byLevel.AA.length).toBeGreaterThan(0);
    });
  });

  describe('getComplianceScore', () => {
    test('calculates compliance scores for each level', async () => {
      const code = `
        function Component() {
          return <img src="/logo.png" alt="Logo" />;
        }
      `;

      const detector = new WCAGDetector();
      await detector.analyze('Component.tsx', code);
      const scores = detector.getComplianceScore();

      expect(scores.A).toBeGreaterThanOrEqual(0);
      expect(scores.A).toBeLessThanOrEqual(100);
      expect(scores.AA).toBeGreaterThanOrEqual(0);
      expect(scores.AA).toBeLessThanOrEqual(100);
    });
  });

  describe('File Filtering', () => {
    test('only analyzes UI files', async () => {
      const code = `
        export function handler() {
          return { status: 200 };
        }
      `;

      const detector = new WCAGDetector();
      const issues = await detector.analyze('api/route.ts', code);

      expect(issues.length).toBe(0);
    });

    test('skips test files', async () => {
      const code = `
        test('component', () => {
          render(<img src="/test.png" />);
        });
      `;

      const detector = new WCAGDetector();
      const issues = await detector.analyze('Component.test.tsx', code);

      expect(issues.length).toBe(0);
    });
  });
});
