# Security Policy

## Supported Versions

| Version | Supported          |
|---------|--------------------|
| 1.2.x   | ✅ Active support  |
| 1.1.x   | ⚠️ Security fixes |
| < 1.1   | ❌ End of life     |

## Reporting a Vulnerability

If you discover a security vulnerability in Fetch-Go, please report it responsibly:

1. **DO NOT** open a public GitHub issue
2. Email: [Create a private security advisory on GitHub](https://github.com/namecloudz/Fetch-Go/security/advisories/new)
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

## Response Time

- **Acknowledgment**: Within 48 hours
- **Initial assessment**: Within 1 week
- **Fix release**: Within 2 weeks for critical issues

## Security Best Practices

When using Fetch-Go:

- Always validate and sanitize user input before passing to request configs
- Use `withCredentials` only when necessary
- Set appropriate `timeout` values
- Use HTTPS in production
- Configure XSRF protection for cross-origin requests
- Keep Fetch-Go updated to the latest version
