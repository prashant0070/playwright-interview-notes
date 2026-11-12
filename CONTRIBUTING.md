# Contributing

Thanks for helping make **Playwright Interview Notes** sharper for SDET / QA Automation candidates.

## Ground rules

1. Prefer **depth that answers interview questions** over fluff.
2. Use **real Playwright APIs** only — verify against [playwright.dev](https://playwright.dev).
3. Keep examples in **TypeScript** unless a module already documents another language.
4. Match the existing module tone: practical, trade-offs, common mistakes, Interview Q&A.
5. Do not paste large copyrighted interview dumps or proprietary company frameworks.
6. Skip `__MACOSX` / junk files.

## Ways to contribute

| Contribution | Guidance |
|---|---|
| Fix outdated API | Link the docs page in the PR; note version if behavior changed |
| Improve a module | Small, focused PRs beat mega-rewrites |
| Add Q&A | Extend [`19-interview-qa-bank.md`](./19-interview-qa-bank.md); keep answers 30–90s |
| Add coding drills | Extend [`20-coding-round-problems.md`](./20-coding-round-problems.md) with prompt, sketch, rubric |
| Starter pack | Improve [`docs/STARTER_PACK.md`](./docs/STARTER_PACK.md) for clear on-ramps |
| Typos / links | Always welcome |

## Local workflow

```bash
git clone https://github.com/YOUR_GITHUB_USERNAME/playwright-interview-notes.git
cd playwright-interview-notes
# edit markdown modules
# open a PR against main
```

No build step is required for docs-only changes. If you add runnable sample projects later, document install/test commands in the PR.

## PR checklist

- [ ] Title explains *why* (e.g. “Fix storageState expiry guidance for setup projects”)
- [ ] Links any related issue
- [ ] API claims checked against current Playwright docs
- [ ] New modules follow `NN-kebab-name.md` and are indexed in `README.md`
- [ ] Code samples are short and copy-pasteable
- [ ] No secrets, tokens, or personal data in examples

## Style tips

- Prefer tables for trade-offs.
- Include **Common mistakes** and **Interview Q&A** on deep modules.
- Cite modules with relative links (`./14-parallelism-sharding-retries-and-flakes.md`).
- Keep README badges pointed at `YOUR_GITHUB_USERNAME/playwright-interview-notes` until the real owner is set.

## Code of conduct

Participation is governed by [`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md).

## License

By contributing, you agree your contributions are licensed under the [MIT License](./LICENSE).
