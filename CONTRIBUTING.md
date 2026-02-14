# Contributing to Fendtastic

Thank you for your interest in contributing to Fendtastic!

## Development Setup

See [docs/development.md](docs/development.md) for detailed setup instructions.

Quick start:
```bash
# Clone the repository
git clone <repository-url>
cd fendtastic

# Backend setup
cd backend
cargo build

# Frontend setup
cd ../frontend
npm install
npm run dev
```

## Code Standards

### Rust
- Follow the [Rust API Guidelines](https://rust-lang.github.io/api-guidelines/)
- Run `cargo fmt` before committing
- Ensure `cargo clippy` passes with no warnings
- Add tests for new functionality

### TypeScript/React
- Use TypeScript strict mode
- Follow React hooks best practices
- Use functional components
- Add PropTypes or TypeScript interfaces for all props

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `style:` Code style changes (formatting, etc.)
- `refactor:` Code refactoring
- `test:` Adding or updating tests
- `chore:` Maintenance tasks

Examples:
```
feat: add vibration monitoring component
fix: resolve WebSocket reconnection issue
docs: update deployment guide for AWS
```

## Pull Request Process

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes
4. Run tests: `cargo test` (backend) and `npm test` (frontend)
5. Commit with conventional commit messages
6. Push to your fork
7. Open a Pull Request with:
   - Clear description of changes
   - Reference to any related issues
   - Screenshots for UI changes

## Testing

### Backend Tests
```bash
cd backend
cargo test
```

### Frontend Tests
```bash
cd frontend
npm test
```

### Integration Tests
```bash
docker-compose -f docker-compose.test.yml up --abort-on-container-exit
```

## Reporting Issues

When reporting issues, please include:

- Fendtastic version
- Operating system
- Steps to reproduce
- Expected vs actual behavior
- Relevant logs

## Feature Requests

We welcome feature requests! Please:

- Check existing issues first
- Provide use case and rationale
- Consider contributing the feature yourself

## Code of Conduct

- Be respectful and inclusive
- Welcome newcomers
- Focus on constructive feedback
- Assume good intentions

## Questions?

Feel free to open an issue for questions or join our community chat.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
