export interface WCAGIssue {
  file: string;
  line: number;
  severity: 'error' | 'warning' | 'info';
  level: 'A' | 'AA' | 'AAA';
  guideline: string;
  category: string;
  message: string;
  suggestion: string;
  wcagReference?: string;
}

/**
 * WCAG 2.0 Accessibility Detector
 *
 * Checks for WCAG 2.0 compliance issues across three levels:
 * - Level A: Must satisfy (minimum compliance)
 * - Level AA: Should satisfy (standard compliance)
 * - Level AAA: May satisfy (enhanced compliance)
 */
export class WCAGDetector {
  private issues: WCAGIssue[] = [];

  async analyze(file: string, content: string): Promise<WCAGIssue[]> {
    this.issues = [];

    // Only analyze UI files
    if (!this.isUIFile(file)) {
      return [];
    }

    const lines = content.split('\n');

    // WCAG 2.0 Principle 1: Perceivable
    this.detectImageAccessibility(file, lines);
    this.detectVideoAccessibility(file, lines);
    this.detectColorContrast(file, lines);
    this.detectTextAlternatives(file, lines);

    // WCAG 2.0 Principle 2: Operable
    this.detectKeyboardAccessibility(file, lines);
    this.detectFocusManagement(file, lines);
    this.detectNavigationIssues(file, lines);
    this.detectTimingIssues(file, lines);

    // WCAG 2.0 Principle 3: Understandable
    this.detectFormAccessibility(file, lines);
    this.detectLanguageAttributes(file, lines);
    this.detectErrorIdentification(file, lines);

    // WCAG 2.0 Principle 4: Robust
    this.detectSemanticHTML(file, lines);
    this.detectARIAIssues(file, lines);
    this.detectHeadingStructure(file, lines);

    return this.issues;
  }

  private isUIFile(file: string): boolean {
    return (
      (file.endsWith('.tsx') || file.endsWith('.jsx')) &&
      !file.includes('.test.') &&
      !file.includes('/api/')
    );
  }

  // ==================== PRINCIPLE 1: PERCEIVABLE ====================

  /**
   * WCAG 1.1.1 (Level A): Non-text Content
   * All images must have text alternatives
   */
  private detectImageAccessibility(file: string, lines: string[]): void {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Check <img> tags
      if (trimmed.includes('<img') || trimmed.includes('<Image')) {
        const hasAlt = trimmed.includes('alt=');
        const isDecorative = trimmed.includes('alt=""') || trimmed.includes("alt=''");

        if (!hasAlt && !isDecorative) {
          this.issues.push({
            file,
            line: i + 1,
            severity: 'error',
            level: 'A',
            guideline: '1.1.1',
            category: 'Images',
            message: 'Image missing alt attribute',
            suggestion:
              'Add alt="" for decorative images or descriptive alt text for meaningful images',
            wcagReference: 'https://www.w3.org/WAI/WCAG21/Understanding/non-text-content.html',
          });
        }

        // Check for poor alt text
        if (hasAlt) {
          const altMatch = trimmed.match(/alt=["']([^"']*)["']/);
          const altText = altMatch?.[1] || '';

          if (
            altText &&
            (altText.toLowerCase().includes('image') ||
              altText.toLowerCase().includes('picture') ||
              altText.toLowerCase().includes('photo'))
          ) {
            this.issues.push({
              file,
              line: i + 1,
              severity: 'warning',
              level: 'A',
              guideline: '1.1.1',
              category: 'Images',
              message: 'Alt text contains redundant words like "image" or "picture"',
              suggestion: "Describe the content/purpose, not that it's an image",
              wcagReference: 'https://www.w3.org/WAI/WCAG21/Understanding/non-text-content.html',
            });
          }
        }
      }

      // Check background images (CSS-in-JS)
      if (
        trimmed.includes('backgroundImage') &&
        !trimmed.includes('aria-label') &&
        !trimmed.includes('role="img"')
      ) {
        const nextFewLines = lines.slice(i, Math.min(i + 5, lines.length)).join('\n');
        if (!nextFewLines.includes('aria-label') && !nextFewLines.includes('alt=')) {
          this.issues.push({
            file,
            line: i + 1,
            severity: 'warning',
            level: 'A',
            guideline: '1.1.1',
            category: 'Images',
            message: 'Background image without text alternative',
            suggestion: 'Add aria-label or use <img> tag instead for meaningful images',
            wcagReference: 'https://www.w3.org/WAI/WCAG21/Understanding/non-text-content.html',
          });
        }
      }
    }
  }

  /**
   * WCAG 1.2.1-1.2.3 (Level A): Time-based Media
   * Video and audio content needs alternatives
   */
  private detectVideoAccessibility(file: string, lines: string[]): void {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check <video> tags
      if (line.includes('<video')) {
        const videoBlock = lines.slice(i, Math.min(i + 10, lines.length)).join('\n');

        if (!videoBlock.includes('<track')) {
          this.issues.push({
            file,
            line: i + 1,
            severity: 'error',
            level: 'A',
            guideline: '1.2.2',
            category: 'Media',
            message: 'Video element missing captions (track element)',
            suggestion: 'Add <track kind="captions"> for accessibility',
            wcagReference: 'https://www.w3.org/WAI/WCAG21/Understanding/captions-prerecorded.html',
          });
        }

        if (!videoBlock.includes('controls')) {
          this.issues.push({
            file,
            line: i + 1,
            severity: 'error',
            level: 'A',
            guideline: '2.1.1',
            category: 'Media',
            message: 'Video element without controls',
            suggestion: 'Add controls attribute for keyboard accessibility',
            wcagReference: 'https://www.w3.org/WAI/WCAG21/Understanding/keyboard.html',
          });
        }
      }

      // Check <audio> tags
      if (line.includes('<audio')) {
        const audioBlock = lines.slice(i, Math.min(i + 10, lines.length)).join('\n');

        if (!audioBlock.includes('controls')) {
          this.issues.push({
            file,
            line: i + 1,
            severity: 'error',
            level: 'A',
            guideline: '2.1.1',
            category: 'Media',
            message: 'Audio element without controls',
            suggestion: 'Add controls attribute for keyboard accessibility',
            wcagReference: 'https://www.w3.org/WAI/WCAG21/Understanding/keyboard.html',
          });
        }
      }
    }
  }

  /**
   * WCAG 1.4.3 (Level AA): Contrast (Minimum)
   * Text must have sufficient contrast ratio (4.5:1 for normal text, 3:1 for large text)
   */
  private detectColorContrast(file: string, lines: string[]): void {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check for low-contrast color combinations (heuristic)
      const lowContrastPatterns = [
        /color:\s*['"]#[a-fA-F0-9]{6}['"]/,
        /text-gray-[234]00/,
        /text-slate-[234]00/,
        /opacity-[1-4]0/,
      ];

      for (const pattern of lowContrastPatterns) {
        if (pattern.test(line)) {
          this.issues.push({
            file,
            line: i + 1,
            severity: 'warning',
            level: 'AA',
            guideline: '1.4.3',
            category: 'Color & Contrast',
            message: 'Potentially low color contrast detected',
            suggestion: 'Verify contrast ratio is at least 4.5:1 (or 3:1 for large text)',
            wcagReference: 'https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html',
          });
          break;
        }
      }

      // Check for color-only information
      if (
        line.includes('color:') &&
        (line.includes('error') || line.includes('success') || line.includes('warning'))
      ) {
        const nextFewLines = lines.slice(i, Math.min(i + 3, lines.length)).join('\n');
        if (
          !nextFewLines.includes('aria-label') &&
          !nextFewLines.includes('sr-only') &&
          !nextFewLines.includes('text-')
        ) {
          this.issues.push({
            file,
            line: i + 1,
            severity: 'warning',
            level: 'A',
            guideline: '1.4.1',
            category: 'Color & Contrast',
            message: 'Color used as only visual indicator',
            suggestion: 'Add text, icons, or patterns in addition to color',
            wcagReference: 'https://www.w3.org/WAI/WCAG21/Understanding/use-of-color.html',
          });
        }
      }
    }
  }

  /**
   * WCAG 1.1.1 (Level A): Text Alternatives
   * Icons and symbols need text alternatives
   */
  private detectTextAlternatives(file: string, lines: string[]): void {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check icon components without labels
      if (line.match(/<\w*Icon\w*/)) {
        const hasLabel =
          line.includes('aria-label') ||
          line.includes('aria-labelledby') ||
          line.includes('title=');

        const nextLine = i < lines.length - 1 ? lines[i + 1] : '';
        const hasVisibleText = nextLine.trim().match(/^[A-Z]/);

        if (!hasLabel && !hasVisibleText) {
          this.issues.push({
            file,
            line: i + 1,
            severity: 'error',
            level: 'A',
            guideline: '1.1.1',
            category: 'Icons',
            message: 'Icon without text alternative',
            suggestion: 'Add aria-label or visible text to describe icon purpose',
            wcagReference: 'https://www.w3.org/WAI/WCAG21/Understanding/non-text-content.html',
          });
        }
      }

      // Check SVG without titles
      if (line.includes('<svg') && !line.includes('aria-hidden')) {
        const svgBlock = lines.slice(i, Math.min(i + 5, lines.length)).join('\n');
        if (!svgBlock.includes('<title>') && !svgBlock.includes('aria-label')) {
          this.issues.push({
            file,
            line: i + 1,
            severity: 'warning',
            level: 'A',
            guideline: '1.1.1',
            category: 'SVG',
            message: 'SVG without title or aria-label',
            suggestion: 'Add <title> element or aria-label, or aria-hidden="true" if decorative',
            wcagReference: 'https://www.w3.org/WAI/WCAG21/Understanding/non-text-content.html',
          });
        }
      }
    }
  }

  // ==================== PRINCIPLE 2: OPERABLE ====================

  /**
   * WCAG 2.1.1 (Level A): Keyboard
   * All functionality must be available from keyboard
   */
  private detectKeyboardAccessibility(file: string, lines: string[]): void {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Check onClick on non-interactive elements
      if (
        trimmed.includes('onClick') &&
        (trimmed.includes('<div') ||
          trimmed.includes('<span') ||
          trimmed.includes('<p') ||
          trimmed.includes('<img'))
      ) {
        const hasKeyboard =
          trimmed.includes('onKeyDown') ||
          trimmed.includes('onKeyPress') ||
          trimmed.includes('role="button"') ||
          trimmed.includes('tabIndex');

        if (!hasKeyboard) {
          this.issues.push({
            file,
            line: i + 1,
            severity: 'error',
            level: 'A',
            guideline: '2.1.1',
            category: 'Keyboard',
            message: 'onClick on non-interactive element without keyboard handler',
            suggestion: 'Add onKeyDown handler or use <button> element instead',
            wcagReference: 'https://www.w3.org/WAI/WCAG21/Understanding/keyboard.html',
          });
        }

        // Check for missing role
        if (!trimmed.includes('role=')) {
          this.issues.push({
            file,
            line: i + 1,
            severity: 'warning',
            level: 'A',
            guideline: '4.1.2',
            category: 'ARIA',
            message: 'Interactive element missing ARIA role',
            suggestion: 'Add role="button" or use semantic HTML button element',
            wcagReference: 'https://www.w3.org/WAI/WCAG21/Understanding/name-role-value.html',
          });
        }
      }

      // Check for custom dropdowns without keyboard support
      if (
        trimmed.includes('onMouseOver') ||
        trimmed.includes('onMouseEnter') ||
        trimmed.includes('onHover')
      ) {
        const hasFocusHandler =
          trimmed.includes('onFocus') ||
          trimmed.includes('onBlur') ||
          lines
            .slice(Math.max(0, i - 2), Math.min(i + 3, lines.length))
            .some((l) => l.includes('onFocus') || l.includes('onKeyDown'));

        if (!hasFocusHandler) {
          this.issues.push({
            file,
            line: i + 1,
            severity: 'warning',
            level: 'A',
            guideline: '2.1.1',
            category: 'Keyboard',
            message: 'Hover-only interaction without keyboard alternative',
            suggestion: 'Add onFocus/onBlur handlers for keyboard users',
            wcagReference: 'https://www.w3.org/WAI/WCAG21/Understanding/keyboard.html',
          });
        }
      }
    }
  }

  /**
   * WCAG 2.4.3 (Level A): Focus Order
   * WCAG 2.4.7 (Level AA): Focus Visible
   */
  private detectFocusManagement(file: string, lines: string[]): void {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check for tabIndex > 0 (bad practice)
      const tabIndexMatch = line.match(/tabIndex=\{?(\d+)\}?/);
      if (tabIndexMatch && parseInt(tabIndexMatch[1]) > 0) {
        this.issues.push({
          file,
          line: i + 1,
          severity: 'warning',
          level: 'A',
          guideline: '2.4.3',
          category: 'Focus Management',
          message: 'Positive tabIndex disrupts natural tab order',
          suggestion: 'Use tabIndex={0} or tabIndex={-1}, avoid positive values',
          wcagReference: 'https://www.w3.org/WAI/WCAG21/Understanding/focus-order.html',
        });
      }

      // Check for outline: none without alternative focus indicator
      if (line.includes('outline:') && (line.includes('none') || line.includes('0'))) {
        const nextFewLines = lines.slice(i, Math.min(i + 5, lines.length)).join('\n');
        const hasAlternative =
          nextFewLines.includes('ring-') ||
          nextFewLines.includes('border-') ||
          nextFewLines.includes('focus:');

        if (!hasAlternative) {
          this.issues.push({
            file,
            line: i + 1,
            severity: 'error',
            level: 'AA',
            guideline: '2.4.7',
            category: 'Focus Management',
            message: 'Focus outline removed without alternative indicator',
            suggestion: 'Provide visible focus indicator (ring, border, or background change)',
            wcagReference: 'https://www.w3.org/WAI/WCAG21/Understanding/focus-visible.html',
          });
        }
      }

      // Check for autofocus (can be disorienting)
      if (line.includes('autoFocus') || line.includes('autofocus')) {
        this.issues.push({
          file,
          line: i + 1,
          severity: 'info',
          level: 'AA',
          guideline: '2.4.3',
          category: 'Focus Management',
          message: 'autoFocus can be disorienting for screen reader users',
          suggestion: 'Use sparingly and only when it improves user experience',
          wcagReference: 'https://www.w3.org/WAI/WCAG21/Understanding/focus-order.html',
        });
      }
    }
  }

  /**
   * WCAG 2.4.1 (Level A): Bypass Blocks
   * WCAG 2.4.4 (Level A): Link Purpose
   */
  private detectNavigationIssues(file: string, lines: string[]): void {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check for "click here" or "read more" links without context
      if (line.includes('<a') || line.includes('<Link')) {
        const linkMatch = line.match(/>(.*?)</);
        const linkText = linkMatch?.[1]?.trim().toLowerCase() || '';

        if (
          linkText === 'click here' ||
          linkText === 'read more' ||
          linkText === 'here' ||
          linkText === 'more'
        ) {
          this.issues.push({
            file,
            line: i + 1,
            severity: 'warning',
            level: 'A',
            guideline: '2.4.4',
            category: 'Links',
            message: 'Link text lacks context (generic "click here" or "read more")',
            suggestion: 'Use descriptive link text that makes sense out of context',
            wcagReference:
              'https://www.w3.org/WAI/WCAG21/Understanding/link-purpose-in-context.html',
          });
        }
      }

      // Check for skip links in layout components
      if (
        (file.includes('layout') || file.includes('Layout')) &&
        (line.includes('<header') || line.includes('<nav'))
      ) {
        const hasSkipLink = lines.some((l) => l.includes('skip') && l.includes('content'));

        if (!hasSkipLink && i < 20) {
          this.issues.push({
            file,
            line: i + 1,
            severity: 'warning',
            level: 'A',
            guideline: '2.4.1',
            category: 'Navigation',
            message: 'Page layout missing skip-to-content link',
            suggestion: 'Add skip link for keyboard users to bypass navigation',
            wcagReference: 'https://www.w3.org/WAI/WCAG21/Understanding/bypass-blocks.html',
          });
        }
      }

      // Check for missing nav landmarks
      if (line.includes('<nav') && !line.includes('aria-label')) {
        this.issues.push({
          file,
          line: i + 1,
          severity: 'info',
          level: 'AA',
          guideline: '2.4.1',
          category: 'Navigation',
          message: 'Navigation element without label',
          suggestion: 'Add aria-label to distinguish multiple nav elements',
          wcagReference: 'https://www.w3.org/WAI/WCAG21/Understanding/bypass-blocks.html',
        });
      }
    }
  }

  /**
   * WCAG 2.2.1 (Level A): Timing Adjustable
   * WCAG 2.2.2 (Level A): Pause, Stop, Hide
   */
  private detectTimingIssues(file: string, lines: string[]): void {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check for automatic refresh or redirect
      if (line.includes('setTimeout') || line.includes('setInterval')) {
        const hasShortTimeout = line.match(/\d+/);
        if (
          hasShortTimeout &&
          parseInt(hasShortTimeout[0]) < 20000 &&
          (line.includes('refresh') || line.includes('redirect') || line.includes('reload'))
        ) {
          this.issues.push({
            file,
            line: i + 1,
            severity: 'warning',
            level: 'A',
            guideline: '2.2.1',
            category: 'Timing',
            message: 'Automatic refresh/redirect without user control',
            suggestion: 'Provide controls to pause, stop, or adjust timing',
            wcagReference: 'https://www.w3.org/WAI/WCAG21/Understanding/timing-adjustable.html',
          });
        }
      }

      // Check for auto-playing carousels
      if ((line.includes('carousel') || line.includes('slider')) && line.includes('autoplay')) {
        const hasControls = lines
          .slice(i, Math.min(i + 10, lines.length))
          .some((l) => l.includes('pause') || l.includes('stop'));

        if (!hasControls) {
          this.issues.push({
            file,
            line: i + 1,
            severity: 'error',
            level: 'A',
            guideline: '2.2.2',
            category: 'Timing',
            message: 'Auto-playing carousel without pause control',
            suggestion: 'Add pause/stop button for users who need more time to read',
            wcagReference: 'https://www.w3.org/WAI/WCAG21/Understanding/pause-stop-hide.html',
          });
        }
      }
    }
  }

  // ==================== PRINCIPLE 3: UNDERSTANDABLE ====================

  /**
   * WCAG 3.3.1 (Level A): Error Identification
   * WCAG 3.3.2 (Level A): Labels or Instructions
   * WCAG 3.3.3 (Level AA): Error Suggestion
   */
  private detectFormAccessibility(file: string, lines: string[]): void {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check form inputs for labels
      if (line.includes('<input') && !line.includes('type="hidden"')) {
        const hasLabel =
          line.includes('aria-label') ||
          line.includes('aria-labelledby') ||
          line.includes('placeholder=');

        const prevLines = lines.slice(Math.max(0, i - 3), i).join('\n');
        const nextLines = lines.slice(i, Math.min(i + 3, lines.length)).join('\n');
        const hasLabelElement =
          prevLines.includes('<label') ||
          nextLines.includes('<label') ||
          prevLines.includes('htmlFor') ||
          nextLines.includes('htmlFor');

        if (!hasLabel && !hasLabelElement) {
          this.issues.push({
            file,
            line: i + 1,
            severity: 'error',
            level: 'A',
            guideline: '3.3.2',
            category: 'Forms',
            message: 'Input field missing label',
            suggestion: 'Add <label> element or aria-label attribute',
            wcagReference:
              'https://www.w3.org/WAI/WCAG21/Understanding/labels-or-instructions.html',
          });
        }

        // Check for placeholder-only labels (bad practice)
        if (line.includes('placeholder=') && !hasLabelElement) {
          this.issues.push({
            file,
            line: i + 1,
            severity: 'warning',
            level: 'A',
            guideline: '3.3.2',
            category: 'Forms',
            message: 'Using placeholder as label (insufficient for accessibility)',
            suggestion: 'Add visible <label> element - placeholders disappear on input',
            wcagReference:
              'https://www.w3.org/WAI/WCAG21/Understanding/labels-or-instructions.html',
          });
        }
      }

      // Check required fields
      if (line.includes('required') && !line.includes('aria-required')) {
        const hasIndicator = lines
          .slice(Math.max(0, i - 2), Math.min(i + 3, lines.length))
          .some((l) => l.includes('*') || l.includes('Required'));

        if (!hasIndicator) {
          this.issues.push({
            file,
            line: i + 1,
            severity: 'warning',
            level: 'A',
            guideline: '3.3.2',
            category: 'Forms',
            message: 'Required field without visible indicator',
            suggestion: 'Add visual indicator (*, "Required") and aria-required="true"',
            wcagReference:
              'https://www.w3.org/WAI/WCAG21/Understanding/labels-or-instructions.html',
          });
        }
      }

      // Check error messages
      if (line.includes('error') && (line.includes('className') || line.includes('class='))) {
        const hasAriaDescribedby = lines
          .slice(Math.max(0, i - 5), Math.min(i + 5, lines.length))
          .some((l) => l.includes('aria-describedby') || l.includes('aria-errormessage'));

        if (!hasAriaDescribedby) {
          this.issues.push({
            file,
            line: i + 1,
            severity: 'warning',
            level: 'A',
            guideline: '3.3.1',
            category: 'Forms',
            message: 'Error message not associated with input via aria-describedby',
            suggestion: 'Link error message to input using aria-describedby',
            wcagReference: 'https://www.w3.org/WAI/WCAG21/Understanding/error-identification.html',
          });
        }
      }
    }
  }

  /**
   * WCAG 3.1.1 (Level A): Language of Page
   * WCAG 3.1.2 (Level AA): Language of Parts
   */
  private detectLanguageAttributes(file: string, lines: string[]): void {
    // Check for lang attribute in main layout/HTML
    if (file.includes('layout') || file.includes('_app') || file.includes('_document')) {
      const hasLang = lines.some((line) => line.includes('lang='));

      if (!hasLang) {
        this.issues.push({
          file,
          line: 1,
          severity: 'error',
          level: 'A',
          guideline: '3.1.1',
          category: 'Language',
          message: 'Document missing lang attribute',
          suggestion: 'Add lang="en" (or appropriate language code) to <html> element',
          wcagReference: 'https://www.w3.org/WAI/WCAG21/Understanding/language-of-page.html',
        });
      }
    }

    // Check for foreign language content without lang attribute
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Heuristic: check for common non-English patterns
      const hasForeignContent =
        line.match(/[àèìòùÀÈÌÒÙáéíóúÁÉÍÓÚäëïöüÄËÏÖÜñÑ]/g) ||
        line.match(/[\u4e00-\u9fa5]/g) || // Chinese
        line.match(/[\u3040-\u309f\u30a0-\u30ff]/g); // Japanese

      if (hasForeignContent && !line.includes('lang=')) {
        this.issues.push({
          file,
          line: i + 1,
          severity: 'info',
          level: 'AA',
          guideline: '3.1.2',
          category: 'Language',
          message: 'Foreign language content without lang attribute',
          suggestion: 'Add lang attribute to indicate language change',
          wcagReference: 'https://www.w3.org/WAI/WCAG21/Understanding/language-of-parts.html',
        });
      }
    }
  }

  /**
   * WCAG 3.3.1 (Level A): Error Identification
   * WCAG 3.3.4 (Level AA): Error Prevention
   */
  private detectErrorIdentification(file: string, lines: string[]): void {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check for form submission without confirmation
      if (
        line.includes('type="submit"') &&
        (file.includes('delete') ||
          file.includes('remove') ||
          line.toLowerCase().includes('delete'))
      ) {
        const hasConfirmation = lines
          .slice(Math.max(0, i - 20), Math.min(i + 20, lines.length))
          .some(
            (l) =>
              l.includes('confirm') ||
              l.includes('modal') ||
              l.includes('dialog') ||
              l.includes('alert')
          );

        if (!hasConfirmation) {
          this.issues.push({
            file,
            line: i + 1,
            severity: 'warning',
            level: 'AA',
            guideline: '3.3.4',
            category: 'Forms',
            message: 'Destructive action without confirmation',
            suggestion: 'Add confirmation dialog for delete/remove actions',
            wcagReference:
              'https://www.w3.org/WAI/WCAG21/Understanding/error-prevention-legal-financial-data.html',
          });
        }
      }
    }
  }

  // ==================== PRINCIPLE 4: ROBUST ====================

  /**
   * WCAG 4.1.1 (Level A): Parsing
   * Ensure valid HTML structure
   */
  private detectSemanticHTML(file: string, lines: string[]): void {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check for div soup (excessive div nesting)
      if (line.includes('<div>') || line.includes('<div ')) {
        let divCount = 0;
        const context = lines.slice(Math.max(0, i - 3), Math.min(i + 4, lines.length));

        for (const contextLine of context) {
          divCount += (contextLine.match(/<div/g) || []).length;
        }

        if (divCount > 4) {
          this.issues.push({
            file,
            line: i + 1,
            severity: 'info',
            level: 'A',
            guideline: '4.1.2',
            category: 'Semantic HTML',
            message: 'Excessive div nesting - consider semantic HTML elements',
            suggestion: 'Use <section>, <article>, <nav>, <aside>, <header>, <footer> instead',
            wcagReference: 'https://www.w3.org/WAI/WCAG21/Understanding/name-role-value.html',
          });
        }
      }

      // Check for <div role="button"> instead of <button>
      if (line.includes('role="button"') && line.includes('<div')) {
        this.issues.push({
          file,
          line: i + 1,
          severity: 'warning',
          level: 'A',
          guideline: '4.1.2',
          category: 'Semantic HTML',
          message: 'Using div with role="button" instead of <button> element',
          suggestion: 'Use native <button> element for better accessibility',
          wcagReference: 'https://www.w3.org/WAI/WCAG21/Understanding/name-role-value.html',
        });
      }

      // Check for missing main landmark
      if (
        (file.includes('layout') || file.includes('page')) &&
        (line.includes('return (') || line.includes('return('))
      ) {
        const hasMain = lines
          .slice(i, Math.min(i + 30, lines.length))
          .some((l) => l.includes('<main'));

        if (!hasMain && i < 30) {
          this.issues.push({
            file,
            line: i + 1,
            severity: 'warning',
            level: 'A',
            guideline: '4.1.2',
            category: 'Semantic HTML',
            message: 'Page layout missing <main> landmark',
            suggestion: 'Add <main> element to identify primary content',
            wcagReference: 'https://www.w3.org/WAI/WCAG21/Understanding/name-role-value.html',
          });
        }
      }
    }
  }

  /**
   * WCAG 4.1.2 (Level A): Name, Role, Value
   * Proper ARIA usage
   */
  private detectARIAIssues(file: string, lines: string[]): void {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check for invalid ARIA roles
      const roleMatch = line.match(/role=["'](\w+)["']/);
      if (roleMatch) {
        const role = roleMatch[1];
        const validRoles = [
          'alert',
          'alertdialog',
          'application',
          'article',
          'banner',
          'button',
          'cell',
          'checkbox',
          'columnheader',
          'combobox',
          'complementary',
          'contentinfo',
          'definition',
          'dialog',
          'directory',
          'document',
          'feed',
          'figure',
          'form',
          'grid',
          'gridcell',
          'group',
          'heading',
          'img',
          'link',
          'list',
          'listbox',
          'listitem',
          'log',
          'main',
          'marquee',
          'math',
          'menu',
          'menubar',
          'menuitem',
          'menuitemcheckbox',
          'menuitemradio',
          'navigation',
          'none',
          'note',
          'option',
          'presentation',
          'progressbar',
          'radio',
          'radiogroup',
          'region',
          'row',
          'rowgroup',
          'rowheader',
          'scrollbar',
          'search',
          'searchbox',
          'separator',
          'slider',
          'spinbutton',
          'status',
          'switch',
          'tab',
          'table',
          'tablist',
          'tabpanel',
          'term',
          'textbox',
          'timer',
          'toolbar',
          'tooltip',
          'tree',
          'treegrid',
          'treeitem',
        ];

        if (!validRoles.includes(role)) {
          this.issues.push({
            file,
            line: i + 1,
            severity: 'error',
            level: 'A',
            guideline: '4.1.2',
            category: 'ARIA',
            message: `Invalid ARIA role: "${role}"`,
            suggestion: 'Use valid ARIA role or remove role attribute',
            wcagReference: 'https://www.w3.org/WAI/WCAG21/Understanding/name-role-value.html',
          });
        }
      }

      // Check for aria-label on non-interactive elements without role
      if (line.includes('aria-label') && !line.includes('role=')) {
        const isInteractive =
          line.includes('<button') ||
          line.includes('<a') ||
          line.includes('<input') ||
          line.includes('<select') ||
          line.includes('<textarea');

        if (!isInteractive) {
          this.issues.push({
            file,
            line: i + 1,
            severity: 'info',
            level: 'A',
            guideline: '4.1.2',
            category: 'ARIA',
            message: 'aria-label on non-interactive element without role',
            suggestion: 'Add role or use semantic HTML element',
            wcagReference: 'https://www.w3.org/WAI/WCAG21/Understanding/name-role-value.html',
          });
        }
      }

      // Check for empty aria-label
      if (line.match(/aria-label=["']["']/)) {
        this.issues.push({
          file,
          line: i + 1,
          severity: 'error',
          level: 'A',
          guideline: '4.1.2',
          category: 'ARIA',
          message: 'Empty aria-label provides no information',
          suggestion: 'Remove aria-label or provide meaningful text',
          wcagReference: 'https://www.w3.org/WAI/WCAG21/Understanding/name-role-value.html',
        });
      }
    }
  }

  /**
   * WCAG 1.3.1 (Level A): Info and Relationships
   * Proper heading structure
   */
  private detectHeadingStructure(file: string, lines: string[]): void {
    const headings: Array<{ level: number; line: number }> = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Extract heading levels
      const headingMatch = line.match(/<h([1-6])/);
      if (headingMatch) {
        headings.push({ level: parseInt(headingMatch[1]), line: i + 1 });
      }
    }

    // Check for skipped heading levels
    for (let i = 1; i < headings.length; i++) {
      const prev = headings[i - 1];
      const curr = headings[i];

      if (curr.level - prev.level > 1) {
        this.issues.push({
          file,
          line: curr.line,
          severity: 'warning',
          level: 'A',
          guideline: '1.3.1',
          category: 'Headings',
          message: `Heading level skipped (h${prev.level} to h${curr.level})`,
          suggestion:
            'Use heading levels sequentially (h1, h2, h3...) for proper document structure',
          wcagReference: 'https://www.w3.org/WAI/WCAG21/Understanding/info-and-relationships.html',
        });
      }
    }

    // Check for multiple h1s (bad practice, but allowed)
    const h1Count = headings.filter((h) => h.level === 1).length;
    if (h1Count > 1) {
      this.issues.push({
        file,
        line: headings.find((h) => h.level === 1)?.line || 1,
        severity: 'info',
        level: 'A',
        guideline: '1.3.1',
        category: 'Headings',
        message: `Multiple h1 elements (${h1Count}) on page`,
        suggestion: 'Consider using only one h1 per page for better document outline',
        wcagReference: 'https://www.w3.org/WAI/WCAG21/Understanding/info-and-relationships.html',
      });
    }
  }

  // ==================== HELPERS ====================

  getIssues(): WCAGIssue[] {
    return this.issues;
  }

  getIssuesByLevel(): Record<'A' | 'AA' | 'AAA', WCAGIssue[]> {
    return {
      A: this.issues.filter((i) => i.level === 'A'),
      AA: this.issues.filter((i) => i.level === 'AA'),
      AAA: this.issues.filter((i) => i.level === 'AAA'),
    };
  }

  getIssuesByCategory(): Record<string, WCAGIssue[]> {
    return this.issues.reduce(
      (acc, issue) => {
        if (!acc[issue.category]) acc[issue.category] = [];
        acc[issue.category].push(issue);
        return acc;
      },
      {} as Record<string, WCAGIssue[]>
    );
  }

  getSeverityCount(): { error: number; warning: number; info: number } {
    return {
      error: this.issues.filter((i) => i.severity === 'error').length,
      warning: this.issues.filter((i) => i.severity === 'warning').length,
      info: this.issues.filter((i) => i.severity === 'info').length,
    };
  }

  getComplianceScore(): { A: number; AA: number; AAA: number } {
    const byLevel = this.getIssuesByLevel();

    // Calculate compliance scores (0-100)
    // More errors = lower score
    const calcScore = (issues: WCAGIssue[]) => {
      const errors = issues.filter((i) => i.severity === 'error').length;
      const warnings = issues.filter((i) => i.severity === 'warning').length;
      const penalty = errors * 10 + warnings * 5;
      return Math.max(0, Math.min(100, 100 - penalty));
    };

    return {
      A: calcScore(byLevel.A),
      AA: calcScore(byLevel.AA),
      AAA: calcScore(byLevel.AAA),
    };
  }
}
