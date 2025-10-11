# Shrimp Health Testing Suite

Comprehensive testing framework for continuously improving Shrimp's detection accuracy and preventing regressions.

## Test Structure

```
tests/
├── unit/                    # Unit tests for individual detectors
│   └── bug-detector.test.ts # Tests for bug detection logic
├── integration/             # Integration tests against real codebases
│   └── real-world.test.ts   # Tests against gielinor-gains project
├── baselines/               # Baseline data for tracking changes
│   └── gielinor-gains-baseline.json
└── README.md
```

## Running Tests

```bash
# Run all tests
bun test

# Run only unit tests
bun test:unit

# Run only integration tests (tests against gielinor-gains)
bun test:integration

# Run tests in watch mode
bun test --watch

# Generate detection quality report
bun test:report
```

## Unit Tests

Unit tests validate that each detector correctly identifies issues using code fixtures.

### Adding New Tests

```typescript
import { describe, it, expect } from 'bun:test';
import { BugDetector } from '../../src/detectors/bug-detector';

describe('BugDetector', () => {
  it('should detect new issue type', async () => {
    const code = `
      // Your test code here
    `;
    const issues = await detector.analyze('test.ts', code);
    expect(issues).toContainIssue('expected message');
  });
});
```

## Integration Tests

Integration tests run Shrimp against real-world codebases (like gielinor-gains) to validate:
- Detection accuracy
- False positive rates
- Performance
- Baseline tracking over time

### What Gets Tested

1. **Detection Coverage**: Ensures all 215 files can be analyzed without crashing
2. **Issue Quality**: Average issues per file should be 3-5 (not too aggressive)
3. **Severity Distribution**: Errors should be < 30% of total issues
4. **Performance**: Analysis should be < 50ms per file
5. **Test File Leniency**: Test files should have fewer issues flagged

### Current Baseline (gielinor-gains)

```
Files Analyzed:    215
Total Issues:      841
Average per File:  3.91

Severity Distribution:
  Errors:   117 (13.9%)
  Warnings: 372 (44.2%)
  Info:     352 (41.9%)

Top Categories:
  Logic Error:       393 (46.7%)
  Type Safety:       178 (21.2%)
  React Performance:  98 (11.7%)
```

## Baseline Tracking

The integration test creates a baseline file that tracks detection metrics over time. This allows you to:

1. **Monitor Detection Changes**: See if changes to detectors increase/decrease issue counts
2. **Track Quality**: Ensure detection quality doesn't regress
3. **Identify False Positives**: Large increases in issues may indicate new false positives

### Baseline Comparison

When you run integration tests, they automatically compare against the baseline:

```bash
Baseline Comparison:
Previous: 841 issues
Current:  850 issues
Change:   +9
WARNING: Issues increased by 1.1%
```

### Regenerating Baseline

To create a new baseline (after intentional detector changes):

```bash
# Delete the old baseline
rm tests/baselines/gielinor-gains-baseline.json

# Run integration tests to create new baseline
bun test:integration
```

## Detection Quality Report

Generate a detailed report showing detection quality metrics:

```bash
bun test:report
```

This shows:
- Overview statistics
- Severity distribution
- Issue breakdown by category
- Quality score (0-100)
- Recommendations for improvement

### Quality Score Calculation

- **100**: Perfect balance of detection rate and accuracy
- **80-99**: Good detection quality
- **60-79**: Acceptable but needs tuning
- **<60**: Needs significant improvement

Factors that lower the score:
- Error rate too high (> 25%) or too low (< 8%)
- Average issues per file too high (> 6) or too low (< 1.5)

## Continuous Improvement Workflow

### 1. User Reports False Positive

```bash
# Add test case to unit tests
it('should NOT flag valid pattern', async () => {
  const code = `/* code that was flagged incorrectly */`;
  const issues = await detector.analyze('test.ts', code);
  expect(issues).toHaveLength(0);
});
```

### 2. Fix Detection Logic

Update the detector in `src/detectors/` to handle the case.

### 3. Run Tests

```bash
# Verify unit test passes
bun test:unit

# Verify integration tests still pass (no regressions)
bun test:integration

# Check impact on detection quality
bun test:report
```

### 4. Compare Baseline

Check if the change significantly affected detection:
- If issues decreased by > 10%: Good! Less false positives
- If issues increased by > 10%: Review for new false positives

## Adding New Real-World Test Projects

To test against additional codebases:

1. Clone the project to a sibling directory
2. Add a new test file in `tests/integration/`
3. Update the path to point to the new project
4. Run tests and establish a baseline

Example:

```typescript
const PROJECT_PATH = path.resolve(__dirname, '../../../my-other-project');
const BASELINE_PATH = path.join(__dirname, '../baselines/my-other-project-baseline.json');
```

## Performance Benchmarks

Integration tests track performance:

```
Analyzed 100 files in 30ms
Average time per file: 0.30ms
```

Target: < 50ms per file on average

If performance degrades:
1. Profile the slow detector
2. Optimize regex patterns
3. Reduce unnecessary string operations
4. Cache analysis results

## Best Practices

1. **Test Both Positives and Negatives**: Test that issues ARE detected AND that valid code IS NOT flagged
2. **Use Real Code**: Base fixtures on real code patterns you encounter
3. **Update Baselines Intentionally**: Don't blindly regenerate baselines - understand why metrics changed
4. **Monitor Trends**: Run integration tests regularly to catch detection drift
5. **Balance Precision and Recall**: Don't just minimize false positives - ensure you're still catching real issues

## Metrics to Track

- **Precision**: % of flagged issues that are real issues (minimize false positives)
- **Recall**: % of real issues that are detected (minimize false negatives)
- **F1 Score**: Balance of precision and recall
- **Performance**: Analysis speed in ms per file
- **Severity Distribution**: % of errors vs warnings vs info

Current targets:
- Precision: > 85%
- Recall: > 70%
- Average per file: 2-5 issues
- Performance: < 50ms per file