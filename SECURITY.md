# Security Policy

## Reporting Security Vulnerabilities

The FAF team takes security seriously. We appreciate your efforts to responsibly disclose your findings.

### Reporting Process

**DO NOT** create a public GitHub issue for security vulnerabilities.

Instead, please report them via email to:
**security@faf.one** 

### What to Include

Please include:
- Description of the vulnerability
- Steps to reproduce the issue
- Potential impact
- Suggested fix (if available)

### Response Timeline

- **Initial Response:** Within 48 hours
- **Status Update:** Within 5 business days
- **Resolution Target:** Within 30 days for critical issues

## Security Considerations for .faf Files

### Safe Practices

✅ **DO:**
- Store `.faf` files in version control
- Use them for project context only
- Share freely (they contain no secrets)
- Validate format before processing

❌ **DON'T:**
- Include passwords or API keys
- Store sensitive credentials
- Include private/confidential data
- Trust untrusted `.faf` sources without validation

### Data Classification

`.faf` files should only contain:
- Project metadata
- Technology stack information  
- Public repository URLs
- General configuration preferences

They should NEVER contain:
- Authentication credentials
- Private API endpoints
- Customer data
- Proprietary algorithms

## Security by Design

The `.faf` format is designed to be:
- **Public by default** - Safe to commit to repositories
- **Human readable** - Easy to inspect for issues
- **Minimal surface area** - Simple format reduces attack vectors
- **No execution** - Pure data, no code execution

## Validation

Always validate `.faf` files before processing:

```javascript
// Example validation
const validateFaf = (content) => {
  // Check required fields
  if (!content.faf_version || !content.project?.name || !content.project?.type) {
    throw new Error('Invalid .faf structure');
  }
  
  // Validate version
  if (!['1.0'].includes(content.faf_version)) {
    throw new Error('Unsupported .faf version');
  }
  
  // Check for suspicious content
  const stringified = JSON.stringify(content);
  if (stringified.match(/password|secret|key|token|credential/i)) {
    console.warn('Possible sensitive data detected');
  }
  
  return true;
};
```

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.0     | :white_check_mark: |
| < 1.0   | :x:                |

## Updates and Patches

Security updates will be:
1. Announced on [faf.one](https://faf.one)
2. Published to the GitHub repository
3. Communicated via security advisory

## Recognition

We thank the security researchers who help keep FAF safe. Responsible disclosure is appreciated and will be acknowledged (with permission).

---

Thank you for helping keep the FAF ecosystem secure! 🛡️