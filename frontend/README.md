# Frontend

Run from repository root:

```bash
pnpm --filter frontend dev
```

The Next.js rewrite forwards `/api/*` to the Encore API. Set `ENCORE_API_URL` in `.env.local` if your Encore backend uses a different local URL.
