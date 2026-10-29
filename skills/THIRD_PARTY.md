# Third-party skills

Copied on 2026-10-29 from the upstream repositories below, not from any product project, so they carry no
product-specific rules. Each skill reads the shared product profile `.agents/product-marketing.md`; a product's own
rules belong in that file.

| Skills | Source | Commit | License |
|---|---|---|---|
| ab-testing, ad-creative, ads, ai-seo, analytics, aso, attribution, churn-prevention, co-marketing, cold-email, community-marketing, competitor-profiling, competitors, content-strategy, copy-editing, copywriting, cro, customer-research, directory-submissions, emails, events, free-tools, image, influencer-marketing, launch, lead-magnets, marketing-council, marketing-ideas, marketing-loops, marketing-plan, marketing-psychology, offers, onboarding, paywalls, popups, pricing, product-marketing, programmatic-seo, prospecting, public-relations, referrals, revops, sales-enablement, schema, seo-audit, signup, site-architecture, sms, social, video (52) | https://github.com/coreyhaines31/marketingskills | 365b412 | MIT (`tools/LICENSE-marketingskills`) |
| growth-funnel | https://github.com/kostja94/marketing-skills (`skills/strategies/launch/growth-funnel`) | 8dd89c5 | MIT |
| ig-audit, ig-caption, ig-carousel, ig-comment, ig-dm, ig-human, ig-plan, ig-profile, ig-reel, ig-reply, ig-repurpose, ig-story, ig-viral (13) | https://github.com/Jakeschincariol/instagram-agent-skill | d03c56b | MIT (copy in each skill's `LICENSE`) |
| twb-claim-evidence, twb-persona-evidence, twb-trust-faq, twb-content-adaptation, twb-funnel-measurement, twb-video-review (6) | https://github.com/backtrue/thinkwithblack-skill (English edition, `en/packs/`) | materials 2026.10.18-en.2 | MIT (copy in each skill's `LICENSE`) |

## What was changed

- **Corey Haines:** every skill in `skills/`, copied as published without `evals/`. From `tools/`, only the Markdown
  (`REGISTRY.md`, `SETUP.md`, `integrations/*.md`) is copied, to the plugin root `tools/` so the skills' links to
  `tools/REGISTRY.md` and `tools/integrations/*` resolve. `tools/clis/` (JavaScript API clients) and `tools/composio/`
  were left out: they need API keys and run code. Links to `../clis/*.js` inside the integration notes do not resolve.
- **Instagram skills:** copied in full, including the offline Python helpers (standard library only: argparse, json,
  os, re, statistics, sys, textwrap, unicodedata; no network). The skills keep the user's profile in
  `~/.claude/instagram/` (voice, plan, swipe file, log).
- **ThinkWithBlack:** `references/mk-NNN.md` are the method sections of the packs, unchanged. Each `SKILL.md` was
  written for this playbook: it groups the methods by theme and opens with the product-rules notice. Methods: MK-005,
  124, 131, 333, 334 (claims); 016, 028 (personas); 280–284, 287 (video); 158, 159, 239, 331 (trust, FAQ); 355, 423
  (adaptation); 172, 436 (funnel events).
- **growth-funnel:** `SKILL.md` and the repository licence.

When updating from upstream, re-copy the skill and keep this table's commit current. `pb.py review` lists the
"工具" entries whose recheck date has passed.
