# 🤝 Contributing Guide

## Welcome!

Thank you for considering contributing to the Straun Marketing AI Engine. This guide will help you get started.

---

## Code of Conduct

### Our Pledge

We pledge to make participation in our project a harassment-free experience for everyone, regardless of:
- Age
- Body size
- Disability
- Ethnicity
- Gender identity and expression
- Level of experience
- Nationality
- Personal appearance
- Race
- Religion
- Sexual identity and orientation

### Our Standards

**Positive behavior:**
- Using welcoming and inclusive language
- Being respectful of differing viewpoints
- Gracefully accepting constructive criticism
- Focusing on what's best for the community
- Showing empathy towards other community members

**Unacceptable behavior:**
- The use of sexualized language or imagery
- Trolling, insulting/derogatory comments
- Personal or political attacks
- Public or private harassment
- Publishing others' private information
- Other conduct which could reasonably be considered inappropriate

---

## How to Contribute

### 1. Reporting Bugs

Before reporting a bug:
1. Check existing issues
2. Check if it's already fixed in development
3. Check that it's actually a bug (not user error)

When reporting:
- **Title**: Clear and descriptive
- **Description**: Step-by-step reproduction
- **Expected behavior**: What should happen
- **Actual behavior**: What actually happens
- **Screenshots**: If applicable
- **Environment**: Browser, OS, version

### 2. Suggesting Features

- **Title**: Clear and descriptive
- **Description**: What, why, and how
- **Examples**: Show usage examples
- **Alternatives**: Any other solutions considered

### 3. Pull Requests

1. Fork the repository
2. Create your feature branch:
   ```bash
   git checkout -b feature/AmazingFeature
   ```
3. Make your changes
4. Test your changes
5. Commit your changes:
   ```bash
   git commit -m 'Add some AmazingFeature'
   ```
6. Push to the branch:
   ```bash
   git push origin feature/AmazingFeature
   ```
7. Open a Pull Request

### Pull Request Guidelines

- **One feature per PR**: Keep it focused
- **Write tests**: For new features
- **Update docs**: For new features
- **Follow coding style**: Use ESLint
- **Keep it clean**: No unrelated changes

---

## Development Setup

### Prerequisites

```bash
# Node.js v18+
node --version

# npm or yarn
npm --version

# Git
git --version
```

### Clone and Install

```bash
# Clone your fork
git clone https://github.com/yourusername/social-ai-marketing-app.git
cd social-ai-marketing-app

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your values

# Start development server
npm run dev
```

---

## Coding Standards

### JavaScript/React

**Use functional components:**
```jsx
// ✅ Good
const MyComponent = ({ prop }) => {
  return <div>{prop}</div>;
};

// ❌ Bad
class MyComponent extends React.Component {
  render() {
    return <div>{this.props.prop}</div>;
  }
}
```

**Use hooks:**
```jsx
// ✅ Good
const MyComponent = () => {
  const [state, setState] = useState(null);
  useEffect(() => {
    // ...
  }, []);
  return <div />;
};
```

**Name exports:**
```jsx
// ✅ Good
export default MyComponent;
export const helperFunction = () => {};

// ❌ Bad
export default () => {};
```

### CSS

**Use CSS variables:**
```css
/* ✅ Good */
.button {
  background: var(--primary-color);
  color: var(--text-primary);
}

/* ❌ Bad */
.button {
  background: #667eea;
  color: #333;
}
```

**Use class names, not inline styles:**
```jsx
// ✅ Good
<div className="container" />

// ❌ Bad
<div style={{ padding: '20px' }} />
```

---

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run specific test
npm test -- --testPathPattern=AuthContext

# Run with coverage
npm test -- --coverage
```

### Writing Tests

```javascript
// Example test
import { render, screen } from '@testing-library/react';
import MyComponent from './MyComponent';

test('renders component with prop', () => {
  render(<MyComponent prop="test" />);
  expect(screen.getByText('test')).toBeInTheDocument();
});
```

---

## Git Workflow

### Branch Naming

- `feature/*` - New features
- `bugfix/*` - Bug fixes
- `hotfix/*` - Urgent fixes
- `docs/*` - Documentation updates
- `chore/*` - Maintenance

### Commit Messages

Format: `<type>(<scope>): <subject>`

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Formatting
- `refactor`: Code restructuring
- `perf`: Performance
- `test`: Testing
- `chore`: Maintenance

**Examples:**
```
feat(auth): add Google OAuth login
fix(search): fix product search filter
docs(readme): update installation guide
perf(images): optimize image loading
```

### Branch Protection Rules

1. PR required for main branch
2. At least 1 review required
3. All checks must pass
4. No direct pushes to main

---

## Code Review Process

### Reviewer Guidelines

1. **Understand the change**: Read the description
2. **Check the code**: Look for issues
3. **Test it**: Run it locally
4. **Be constructive**: Focus on the code, not the person
5. **Be timely**: Review within 2 days

### What to Look For

- ✅ Code style consistency
- ✅ Test coverage
- ✅ Performance implications
- ✅ Security concerns
- ✅ Documentation updates
- ✅ Error handling
- ✅ Edge cases

### Review Comments

- `[suggestion]`: Optional improvement
- `[question]`: Clarification needed
- `[blocking]`: Must be fixed

---

## Documentation

### Where to Update

- **README.md**: Project overview
- **ARCHITECTURE.md**: System design
- **API.md**: API documentation
- **COMPONENTS.md**: Component docs
- **DATABASE.md**: Schema docs
- **DEPLOYMENT.md**: Deployment guide

### JSDoc Comments

```javascript
/**
 * Fetches products based on search term
 * @param {string} searchTerm - The term to search for
 * @param {Object} filters - Search filters
 * @param {number} filters.minPrice - Minimum price
 * @param {number} filters.maxPrice - Maximum price
 * @returns {Promise<Array>} List of products
 */
const fetchProducts = async (searchTerm, filters) => {
  // ...
};
```

---

## Performance Guidelines

### Optimization Principles

1. **Measure first**: Don't optimize prematurely
2. **Minimize re-renders**: Use memoization
3. **Lazy load**: Split code
4. **Cache**: Use React Query, localStorage
5. **Debounce**: Search, input events

### Performance Budget

- **Load time**: < 3 seconds
- **First paint**: < 1.8 seconds
- **Time to interactive**: < 3.8 seconds
- **Lighthouse score**: > 90
- **Bundle size**: < 500KB (gzipped)

---

## Security Guidelines

### Never

- ❌ Store secrets in code
- ❌ Disable CORS without need
- ❌ Trust user input without sanitization
- ❌ Log sensitive information
- ❌ Use eval() or new Function()

### Always

- ✅ Use DOMPurify for HTML
- ✅ Sanitize all user inputs
- ✅ Validate on server (RLS)
- ✅ Use HTTPS
- ✅ Keep dependencies updated

---

## Accessibility Guidelines

### Must Do

- ✅ Semantic HTML elements
- ✅ ARIA labels where needed
- ✅ Keyboard navigation
- ✅ Focus management
- ✅ Sufficient color contrast
- ✅ Screen reader support

### Test With

- VoiceOver (Mac)
- NVDA (Windows)
- ChromeVox (Chrome)
- Keyboard only
- Color blindness simulators

---

## Questions?

### Resources

- [React Documentation](https://react.dev)
- [Supabase Documentation](https://supabase.com/docs)
- [ESLint Documentation](https://eslint.org)
- [Prettier Documentation](https://prettier.io)

### Contact

- Email: deonmahachi8@gmail.com
- Issues: GitHub Issues
- Discussions: GitHub Discussions

---

## Thank You!

Your contributions make this project better. 🙏
