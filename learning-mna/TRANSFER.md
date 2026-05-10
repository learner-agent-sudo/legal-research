# Transfer this bundle into `learning-MnA`

This bundle was prepared in a sandboxed Claude session that only had write
access to `learner-agent-sudo/legal-research`. The next step is to copy the
contents of `learning-mna/` into your new repo
[`learner-agent-sudo/learning-MnA`](https://github.com/learner-agent-sudo/learning-MnA).

Pick whichever option fits your environment. The fastest is **Option A**.

---

## Option A — Copy the folder (simplest)

Run these commands on your local machine. Replace the paths if needed.

```bash
# 1. Make sure your local clone of legal-research is up to date and on the
#    branch where this bundle lives.
cd /path/to/legal-research
git fetch origin
git checkout claude/ma-workflow-visualization-K0fiG
git pull origin claude/ma-workflow-visualization-K0fiG

# 2. Clone (or pull) your empty learning-MnA repo somewhere else on disk.
cd /path/to/where-you-keep-repos
git clone https://github.com/learner-agent-sudo/learning-MnA.git
cd learning-MnA

# 3. Copy the bundle contents (NOT the learning-mna/ wrapper folder) into
#    the root of learning-MnA. We strip the wrapper because learning-MnA
#    will itself be the project root.
cp -R /path/to/legal-research/learning-mna/. .

# 4. Commit and push.
git add .
git commit -m "Import M&A workflow visualizer design bundle

- README, workflow-mapping, architecture docs
- Drafted in legal-research sandbox, see commit history there for context"
git push -u origin main
```

After this, `learning-MnA` will contain:

```
learning-MnA/
├── README.md
├── TRANSFER.md           # ← can delete after import
└── docs/
    ├── workflow-mapping.md
    └── architecture.md
```

You can delete `TRANSFER.md` after the import — it's no longer needed.

---

## Option B — Use `git subtree split` (preserves history)

Use this if you want the import to retain the commit history of
`learning-mna/` from this session.

```bash
cd /path/to/legal-research
git checkout claude/ma-workflow-visualization-K0fiG

# Split learning-mna/ into its own branch with rewritten history.
git subtree split --prefix=learning-mna -b mna-export

# Add learning-MnA as a remote and push the split branch as main.
git remote add learning-mna git@github.com:learner-agent-sudo/learning-MnA.git
git push learning-mna mna-export:main

# Clean up
git remote remove learning-mna
git branch -D mna-export
```

---

## Option C — Manual download + paste

If you can't run git locally:

1. Open this branch on GitHub:
   `https://github.com/learner-agent-sudo/legal-research/tree/claude/ma-workflow-visualization-K0fiG/learning-mna`
2. Download each file individually (use the "Raw" button → save).
3. Recreate the same folder structure in `learning-MnA` via the GitHub web
   editor ("Add file → Create new file" with paths like
   `docs/workflow-mapping.md`).

Slow, but works without local git.

---

## After the import — what a future Claude session should do

When you start a new Claude session pointed at `learning-MnA`, give it this
context:

> The repo contains a design bundle for an M&A workflow visualizer (see
> README.md and docs/). Please scaffold the Next.js app per
> docs/architecture.md, starting with a vertical slice (one stage end-to-end)
> before fanning out to all 9 stages. Run the CUAD extraction script after
> the vertical slice works.

That session will need:

- Internet access (to download CUAD from Hugging Face for the extraction
  script)
- Node.js and Python installed
- Permission to install npm and pip dependencies

---

## What this bundle does NOT include yet

- The Next.js scaffold itself (no `package.json` yet)
- `clauses.json` (needs the extraction script to be run, which needs CUAD
  download)
- The hand-authored APA gap-fill clauses as JSON (currently embedded in
  `docs/workflow-mapping.md`; future session should extract them into
  `data/apa-gap-fills.json`)
- React components (`WorkflowDiagram`, `StagePanel`, etc.)
- Tests, linting config, CI

These are deliberate v1-build tasks for the next session, sequenced in
`docs/architecture.md` under "Build vertical slice first".
