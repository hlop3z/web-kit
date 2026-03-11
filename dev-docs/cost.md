# Xkin Editor — Hosting & Cost Analysis

## Distribution Model

The `xkin` npm package is **open-source and free**. The **hosted editor (Xkin Studio)** is the paid product.

### Free: Library via jsdelivr CDN

The npm package is served for free via **jsdelivr** — chosen over unpkg/cdnjs because:

- **99.99% SLA** with multi-CDN failover (Cloudflare + Fastly + GCore)
- **Fastest** — load-balanced across multiple providers
- **Zero outages** vs unpkg (went down in 2021, 2023)
- **Auto npm sync** — publishes are live on CDN within minutes
- **Auto minification** and version ranges (`@^1`, `@latest`)
- **Usage analytics** via `data.jsdelivr.com`
- **No submission process** unlike cdnjs (which requires manual curation)
- **50 MB package limit** (plenty for xkin's ~43 MB dist)

```html
<!-- Library users: free via jsdelivr (demos, open-source projects, prototypes) -->
<script src="https://cdn.jsdelivr.net/npm/xkin@1.0.0/dist/xkin.min.js"></script>

<!-- ES module -->
<script type="module">
  import { Xkin } from "https://cdn.jsdelivr.net/npm/xkin@1.0.0/dist/xkin.min.js";
</script>
```

**Cost to you: $0.** jsdelivr is free for all npm packages, no limits, no API keys.

### Paid: Xkin Studio via AWS CloudFront

The hosted SaaS (xkin-studio) serves from your own **AWS CloudFront** — never depend on a third-party CDN for your paid product.

```
Demo/Library users → jsdelivr (free, $0 cost)
Paying SaaS users  → CloudFront (your infra, your control)
```

### Strategy

- **Demo page** (no signup) — let anyone drag blocks around, see the magic, instant "aha"
- **14-day trial** (signup) — full access, watermarked exports, build real things
- **Day 14** — pay $9+ or lose access (data kept 30 days for recovery)

> At 1K monthly signups with 12% conversion averaging $19/user, you net ~$1,900/month after all edge case costs. That's without a free tier dragging down perceived value or inflating support load.

## Asset Breakdown

| Asset                   | Size       | Loaded              |
| ----------------------- | ---------- | ------------------- |
| `xkin.min.js`           | 23 KB      | Always              |
| `xkin.engine.min.js`    | 17 KB      | Always              |
| `xkin.editor.min.js`    | 3.96 MB    | On editor open      |
| `xkin.tools.min.js`     | 5.43 MB    | On editor open      |
| `xkin.styles.min.js`    | 4.41 MB    | On editor open      |
| Monaco workers + chunks | ~29 MB     | Lazy (per language) |
| **Total dist/**         | **~43 MB** | —                   |

### Per-Session Transfer Estimates

| Scenario                           | Transfer  |
| ---------------------------------- | --------- |
| First visit (editor + 1 language)  | ~16–20 MB |
| First visit (editor + 3 languages) | ~22–26 MB |
| Return visit (cached)              | ~0–50 KB  |
| Average (70% cached, 30% new)      | ~5 MB     |

> All assets are static JS/CSS — fully cacheable via CDN with long `Cache-Control` headers and content-hashed filenames.

---

## AWS Architecture (Static SPA)

```
User → CloudFront (CDN) → S3 (origin)
                        → Lambda/API Gateway (optional: persistence API)
```

### Minimal Stack (Static Only)

- **S3** — stores dist/ assets (~43 MB)
- **CloudFront** — CDN with edge caching, HTTPS, gzip/brotli compression
- **Route 53** — DNS (optional, $0.50/zone/month)

### Full Stack (With Persistence)

- Add **API Gateway + Lambda** for save/load documents
- Add **DynamoDB** or **S3** for document storage

---

## Cost Per Service

### S3 Storage

| Item                         | Cost              |
| ---------------------------- | ----------------- |
| Storage (43 MB)              | ~$0.001/month     |
| PUT requests (deploys)       | negligible        |
| GET requests (origin misses) | $0.0004 per 1,000 |

**Effectively free** — S3 storage cost is < $0.01/month.

### CloudFront CDN

| Item                              | Rate                               |
| --------------------------------- | ---------------------------------- |
| Data transfer (first 10 TB/month) | $0.085/GB                          |
| HTTPS requests                    | $0.01 per 10,000                   |
| Free tier (first 12 months)       | 1 TB transfer + 10M requests/month |

### Data Transfer Cost Per User

With gzip/brotli compression, JS bundles compress ~60–70%:

| Scenario              | Raw    | Compressed | Cost       |
| --------------------- | ------ | ---------- | ---------- |
| First visit           | ~18 MB | ~6 MB      | $0.00051   |
| Return visit (cached) | ~50 KB | ~20 KB     | $0.0000017 |
| Average session       | ~5 MB  | ~1.7 MB    | $0.00014   |

### API Gateway + Lambda (If Persistence Needed)

| Item                               | Rate                   |
| ---------------------------------- | ---------------------- |
| API Gateway requests               | $1.00 per 1M requests  |
| Lambda invocations                 | $0.20 per 1M           |
| Lambda compute (128 MB, 100ms avg) | $0.0000002 per request |
| DynamoDB on-demand reads           | $0.25 per 1M           |
| DynamoDB on-demand writes          | $1.25 per 1M           |
| DynamoDB storage                   | $0.25/GB/month         |

Typical user session: ~5–20 API calls (load doc, auto-save, export).

---

## Monthly Cost Projections

### Static-Only Hosting (No Backend)

| Users/Month | Sessions  | Transfer | CloudFront | S3    | Total        |
| ----------- | --------- | -------- | ---------- | ----- | ------------ |
| 100         | 300       | ~1 GB    | $0.09      | $0.01 | **~$0.10**   |
| 1,000       | 3,000     | ~10 GB   | $0.85      | $0.01 | **~$0.86**   |
| 10,000      | 30,000    | ~100 GB  | $8.50      | $0.03 | **~$8.53**   |
| 100,000     | 300,000   | ~1 TB    | $85.00     | $0.30 | **~$85.30**  |
| 1,000,000   | 3,000,000 | ~10 TB   | $850.00    | $3.00 | **~$853.00** |

> Assumes 3 sessions/user/month, ~3.3 MB compressed transfer avg (mix of new + cached).

### Full Stack (Static + Persistence API)

| Users/Month | CloudFront | Lambda + APIGW | DynamoDB | Total        |
| ----------- | ---------- | -------------- | -------- | ------------ |
| 100         | $0.10      | $0.01          | $0.01    | **~$0.12**   |
| 1,000       | $0.86      | $0.05          | $0.05    | **~$0.96**   |
| 10,000      | $8.53      | $0.50          | $0.50    | **~$9.53**   |
| 100,000     | $85.30     | $5.00          | $5.00    | **~$95.30**  |
| 1,000,000   | $853.00    | $50.00         | $50.00   | **~$953.00** |

> Assumes ~15 API calls/session, 128 MB Lambda, 100ms avg duration, 5 KB avg document size.

---

## Cost Per User

| Scale           | Cost/User/Month | Cost/User/Year |
| --------------- | --------------- | -------------- |
| 100 users       | $0.001          | $0.012         |
| 1,000 users     | $0.001          | $0.012         |
| 10,000 users    | $0.001          | $0.012         |
| 100,000 users   | $0.001          | $0.012         |
| 1,000,000 users | $0.001          | $0.012         |

**Infrastructure cost per user is essentially flat at ~$0.001/month** thanks to CDN caching and serverless scaling.

---

## Pricing Strategy

### The Free Tier Problem

A free tier sounds like growth, but for a page builder it's a trap:

| Problem                       | Why It Hurts                                                           |
| ----------------------------- | ---------------------------------------------------------------------- |
| Core value delivered for free | Users build a page, export HTML, leave forever                         |
| No upgrade pressure           | The editor works — why pay?                                            |
| Support burden                | Free users generate the most tickets, pay nothing                      |
| Low conversion                | Industry freemium conversion is 2–5%. At 1K users, that's 20–50 paying |
| Anchoring at $0               | Once users expect "free," any price feels expensive                    |

**The editor IS the product.** Giving it away free is like a restaurant giving free meals and hoping people pay for dessert.

### Recommended: Trial → Paid (No Free Tier)

Instead of free-forever, offer a **full-featured time-limited trial** that lets users experience everything, build something real, then decide.

| Phase         | Duration  | Access                                              | Goal                              |
| ------------- | --------- | --------------------------------------------------- | --------------------------------- |
| **Live Demo** | Unlimited | Read-only interactive demo page, pre-built examples | Hook — "I want to build this"     |
| **Trial**     | 14 days   | Full editor, all features, watermark on exports     | Experience — build something real |
| **Decision**  | Day 14    | Pay or lose access (keep data 30 days for recovery) | Convert — they've invested time   |

**Why this works better than freemium:**

| Metric                | Freemium                   | Trial → Paid                     |
| --------------------- | -------------------------- | -------------------------------- |
| Conversion rate       | 2–5%                       | 10–25% (industry avg for trials) |
| Revenue at 1K signups | $240–600/mo                | $1,400–3,500/mo                  |
| Support load          | High (free users)          | Lower (only serious users trial) |
| Perceived value       | "It's free, so it's cheap" | "It's worth paying for"          |
| User quality          | Tire-kickers + real users  | Mostly real users                |

### Tier Structure (Trial → Paid)

| Tier           | Price           | Includes                                                           |
| -------------- | --------------- | ------------------------------------------------------------------ |
| **Demo**       | $0, no signup   | Interactive read-only demo, pre-built templates                    |
| **Trial**      | $0, 14 days     | Full editor access, all block/section types, export with watermark |
| **Starter**    | $9/month        | 5 pages, 200 MB uploads, export HTML/JSON, Xkin branding           |
| **Pro**        | $19/month       | Unlimited pages, 2 GB uploads, no branding, priority support       |
| **Team**       | $29/seat/month  | Collaboration, shared workspace, 10 GB uploads, shared templates   |
| **Enterprise** | $49+/seat/month | SSO, SLA, unlimited storage, dedicated support, on-premise option  |

### The Demo Page Strategy

The demo is your sales tool. It should:

1. **Be instantly accessible** — no signup, no email, just click and play
2. **Show a real page being built** — pre-populated with sections, blocks, drag-and-drop working
3. **Let users interact** — drag blocks, edit text, resize sections (read-only save)
4. **Show the "aha" moment** — "I just built a page in 30 seconds"
5. **CTA everywhere** — "Start your 14-day free trial to save this page"

Users who see the demo and start a trial have **already decided the product is worth trying**. That's a much higher-intent funnel than "sign up for free."

### When Freemium DOES Make Sense

Consider a limited free tier only if:

- You're pre-revenue and need user volume for feedback/validation
- You're competing with free alternatives (WordPress, Wix free tier)
- You want a developer community building plugins/integrations
- You have a clear, hard upgrade wall (e.g., free = 1 page, can't export)

If you go this route, make the free tier **frustratingly limited** — not broken, but clearly insufficient for real use:

| Free Limit            | Why                                  |
| --------------------- | ------------------------------------ |
| 1 page only           | Forces upgrade for any real project  |
| 3 sections max        | Can't build a full page              |
| No export             | Can preview, can't ship              |
| Xkin watermark        | Professional users won't tolerate it |
| No custom block types | Stuck with built-in only             |

### Alternative Revenue Streams

These work alongside any pricing model:

| Stream                        | Price                      | Effort                                                            |
| ----------------------------- | -------------------------- | ----------------------------------------------------------------- |
| **npm license** (self-hosted) | $199 one-time (commercial) | Low — you already have the package                                |
| **Template marketplace**      | $5–25 per template pack    | Medium — design pre-built page templates                          |
| **Block type packs**          | $10–30 per pack            | Medium — premium blocks (pricing tables, testimonials, carousels) |
| **White-label license**       | $999+ one-time             | Low — remove all Xkin references                                  |
| **Integration plugins**       | $15–50/plugin              | High — Shopify, WordPress, headless CMS connectors                |

---

## What to Charge — Summary

| Target Market   | Model           | Price     | Expected Revenue (1K signups) | Conversion   |
| --------------- | --------------- | --------- | ----------------------------- | ------------ |
| Indie/freelance | Trial → Starter | $9/mo     | $900/mo (10% conv)            | 10–15%       |
| Small business  | Trial → Pro     | $19/mo    | $2,850/mo (15% conv)          | 15–20%       |
| Agencies        | Trial → Team    | $29/seat  | $4,350/mo (15% × 2 seats avg) | 15–20%       |
| Enterprise      | Sales-led       | $49+/seat | Custom                        | Direct sales |
| Developers      | npm license     | $199      | One-time per customer         | N/A          |

---

## Additional Costs to Budget For

| Item                           | Estimated Cost                   |
| ------------------------------ | -------------------------------- |
| Domain name                    | $10–15/year                      |
| SSL certificate                | Free (ACM with CloudFront)       |
| Email (support)                | $6/user/month (Google Workspace) |
| Error tracking (Sentry)        | Free tier or $26/month           |
| Analytics (Plausible/Fathom)   | $9–14/month                      |
| CI/CD (GitHub Actions)         | Free tier (2,000 min/month)      |
| Monitoring (CloudWatch)        | ~$3/month                        |
| **Total operational overhead** | **~$30–60/month**                |

---

## Edge Case Costs — What Can Actually Hurt You

The base projections above assume well-behaved traffic. Real-world usage introduces risks that can 10–100x your costs if unmitigated.

### 1. Abuse / Bot Traffic

Bots, scrapers, and DDoS can inflate CloudFront transfer and request costs with zero revenue.

| Scenario                          | Extra Cost            |
| --------------------------------- | --------------------- |
| Bot scraping all assets once      | ~$0.50 (6 MB × 1)     |
| Botnet hitting CDN 100K times/day | ~$25/day ($750/month) |
| DDoS sustained 1M req/hour        | ~$2,400/day           |

**Mitigations:**

- **AWS WAF** ($5/month + $0.60 per 1M requests) — rate limiting, geo-blocking, bot detection
- **CloudFront signed URLs** for premium assets — prevents unauthorized access
- **AWS Shield Standard** — free, covers most volumetric DDoS
- **AWS Shield Advanced** — $3,000/month (only if you're a real target)
- **Budget alerts** — set CloudWatch billing alarms at 150%, 300%, 500% of expected

**Cost to protect:** ~$6–10/month (WAF + monitoring). Non-negotiable at any scale.

### 2. Large Documents (Hundreds of Sections)

A typical document is 2–10 KB JSON. Power users building massive pages can create 200+ sections with nested blocks.

| Document Size    | Storage Cost | Lambda Processing | Risk                                                          |
| ---------------- | ------------ | ----------------- | ------------------------------------------------------------- |
| 5 KB (typical)   | negligible   | ~50ms             | None                                                          |
| 50 KB (large)    | negligible   | ~100ms            | Low                                                           |
| 500 KB (extreme) | negligible   | ~300ms            | Medium — Lambda timeout, slow saves                           |
| 5 MB (abusive)   | $0.0001/mo   | ~2s+              | High — Lambda memory/timeout, API Gateway 10 MB payload limit |

**Mitigations:**

- Enforce max document size at API level (reject > 500 KB)
- Enforce `max_sections: 50` and `max_blocks: 25` per section in DnD constraints
- Charge storage tiers: Free = 10 docs, Pro = unlimited
- **Cost impact if unmitigated:** A single abusive user auto-saving a 5 MB doc every 30s = ~86,400 writes/month = $0.10 DynamoDB + ~$0.02 Lambda. Annoying but not catastrophic.

**Worst case:** 100 abusive users = ~$12/month. Manageable, but throttle to be safe.

### 3. Burst Traffic (Viral / Launch Day)

If you hit Hacker News or Product Hunt, expect 10,000–50,000 visitors in hours.

| Burst Scenario                   | Duration | Transfer | CloudFront Cost | Lambda Cost |
| -------------------------------- | -------- | -------- | --------------- | ----------- |
| HN front page                    | 6 hours  | ~100 GB  | $8.50           | $0.50       |
| Product Hunt #1                  | 24 hours | ~300 GB  | $25.50          | $1.50       |
| Viral tweet (500K views)         | 48 hours | ~1 TB    | $85.00          | $5.00       |
| Sustained viral (1M visits/week) | 7 days   | ~3 TB    | $255.00         | $15.00      |

**Mitigations:**

- CloudFront + S3 auto-scale — no action needed for static assets
- Lambda concurrency limits — set reserved concurrency to prevent runaway costs
- **Pre-warm nothing** — serverless handles bursts natively
- Set billing alerts so you know it's happening

**Key insight:** A viral day that costs you $85 in bandwidth is a _good problem_. That's thousands of potential users. Budget $100–300 for a launch event.

### 4. Global / Multi-Region CloudFront Pricing

CloudFront charges different rates by edge location. Most projections use US/EU rates.

| Region                | Data Transfer Rate | Premium vs US |
| --------------------- | ------------------ | ------------- |
| US / Canada / Europe  | $0.085/GB          | Baseline      |
| Japan / Hong Kong     | $0.114/GB          | +34%          |
| Australia / Singapore | $0.114/GB          | +34%          |
| South America         | $0.110/GB          | +29%          |
| India                 | $0.109/GB          | +28%          |
| Middle East / Africa  | $0.110/GB          | +29%          |

**Impact at scale:**

| User Distribution   | Effective Rate | Monthly Cost at 1 TB |
| ------------------- | -------------- | -------------------- |
| 100% US/EU          | $0.085/GB      | $85                  |
| 60% US/EU, 40% Asia | $0.097/GB      | $97 (+14%)           |
| Global spread       | $0.100/GB      | $100 (+18%)          |

**Mitigations:**

- Use CloudFront **Price Class 100** (US/EU only) to cap costs — $0.085/GB flat
- Upgrade to **Price Class 200** (+ Asia) only when you have paying users there
- At most, global pricing adds ~20% — factor this into projections

### 5. File Uploads (User Images/Videos)

If users embed media into their pages, you're now a storage + bandwidth provider.

| Asset Type            | Avg Size | Uploads/User/Month | Storage/1K Users | Transfer/1K Users |
| --------------------- | -------- | ------------------ | ---------------- | ----------------- |
| Images (compressed)   | 200 KB   | 20                 | 4 GB             | 40 GB             |
| Images (uncompressed) | 2 MB     | 20                 | 40 GB            | 400 GB            |
| Videos (short clips)  | 15 MB    | 5                  | 75 GB            | 750 GB            |
| Videos (full)         | 100 MB   | 2                  | 200 GB           | 2 TB              |

| Scale (1K users)         | S3 Storage | CloudFront Transfer | Monthly Total |
| ------------------------ | ---------- | ------------------- | ------------- |
| Images only (compressed) | $0.09      | $3.40               | **~$3.50**    |
| Images only (raw)        | $0.92      | $34.00              | **~$35.00**   |
| Images + short video     | $1.82      | $97.75              | **~$100.00**  |
| Images + full video      | $4.60      | $204.00             | **~$209.00**  |

**This is where costs explode.** File uploads can easily become your #1 cost.

**Mitigations:**

- **Compress/resize on upload** — Lambda@Edge or Sharp library, cap images at 500 KB
- **Storage quotas** — Free: 50 MB, Pro: 1 GB, Team: 10 GB
- **Offload to user's own S3/Cloudinary/Imgix** — let them pay for their own storage
- **Use presigned S3 URLs** — uploads go direct to S3, skip your API
- **Set lifecycle policies** — auto-delete unused uploads after 90 days
- **Video: just don't host it** — embed YouTube/Vimeo URLs instead

**Recommended budget per 1K users:** $5–35/month (images only, compressed, with quotas).

### 6. WebSocket / Real-Time Collaboration

If you add real-time collaboration (Google Docs-style), persistent connections change the cost model entirely.

| Service                  | Cost                            |
| ------------------------ | ------------------------------- |
| API Gateway WebSocket    | $1.00 per 1M connection-minutes |
| API Gateway messages     | $1.00 per 1M messages           |
| Lambda (message handler) | $0.20 per 1M invocations        |

| Scenario                  | Connections | Messages/Hour | Monthly Cost |
| ------------------------- | ----------- | ------------- | ------------ |
| 10 concurrent editors     | 10          | 6,000         | **~$2**      |
| 100 concurrent editors    | 100         | 60,000        | **~$20**     |
| 1,000 concurrent editors  | 1,000       | 600,000       | **~$200**    |
| 10,000 concurrent editors | 10,000      | 6,000,000     | **~$2,000**  |

**Alternative: use a managed service instead of building your own:**

| Service                | Free Tier       | Paid                |
| ---------------------- | --------------- | ------------------- |
| Liveblocks             | 100 MAU         | $25/month (500 MAU) |
| Partykit / PartyServer | 10 connections  | $25/month           |
| Supabase Realtime      | 200 connections | $25/month           |
| Ably                   | 6M messages     | $29/month           |

**Recommendation:** Don't build real-time yourself. Use Liveblocks or Supabase Realtime. Budget $25–50/month for collaboration, and only add it to paid tiers.

### 7. Support Costs (The Hidden Killer)

| Support Channel             | Cost Per Ticket      | Tickets/Month (per 1K users) | Monthly Cost |
| --------------------------- | -------------------- | ---------------------------- | ------------ |
| Email (you personally)      | $15–25 (your time)   | 20–50                        | $300–1,250   |
| Docs/FAQ (self-serve)       | $0                   | reduces tickets 60%          | $0           |
| Discord community           | $0 (community helps) | reduces tickets 40%          | $0           |
| Hired support agent         | $2,000–4,000/month   | 200+ tickets                 | $2,000–4,000 |
| AI chatbot (Intercom/Crisp) | $39–99/month         | handles 30–50%               | $39–99       |

**Support is your biggest real cost** — not AWS. At 1,000 users, you'll spend 10–20 hours/month on support minimum.

**Mitigations:**

- Invest in docs, tutorials, and in-editor help before hiring support
- Community Discord — free, scales, users help each other
- AI chatbot for common questions
- Only offer direct support to Pro/Team/Enterprise tiers

---

## Revised Cost Model — With Edge Cases

### True Monthly Cost (1,000 Users, Full Stack)

| Line Item              | Base      | With Edge Cases | Notes                            |
| ---------------------- | --------- | --------------- | -------------------------------- |
| CloudFront + S3        | $0.86     | $1.50           | +global pricing buffer           |
| Lambda + API Gateway   | $0.05     | $0.10           | +large docs, retries             |
| DynamoDB               | $0.05     | $0.10           | +larger documents                |
| WAF (bot protection)   | $0        | $6.00           | Non-negotiable                   |
| File uploads (images)  | $0        | $15.00          | Compressed, with quotas          |
| Real-time (Liveblocks) | $0        | $25.00          | If collaboration enabled         |
| Support (your time)    | $0        | $500.00         | 20 hrs × $25/hr opportunity cost |
| Monitoring + alerts    | $3.00     | $5.00           | CloudWatch + billing alarms      |
| **Total**              | **$3.96** | **$552.70**     |                                  |

### Break-Even Analysis (Trial → Paid Model)

| Model                    | Conversion | Paying Users (of 1K signups)  | Monthly Revenue             | Profitable?                   |
| ------------------------ | ---------- | ----------------------------- | --------------------------- | ----------------------------- |
| Freemium ($14 Pro)       | 3%         | 30                            | $420                        | Barely — if no uploads/collab |
| Freemium ($14 Pro)       | 5%         | 50                            | $700                        | Yes — with margin             |
| **Trial → Starter ($9)** | **12%**    | **120**                       | **$1,080**                  | **Yes — comfortably**         |
| **Trial → Pro ($19)**    | **10%**    | **100**                       | **$1,900**                  | **Yes — strong**              |
| Trial → mixed tiers      | 15%        | 80 Starter + 40 Pro + 10 Team | $720 + $760 + $290 = $1,770 | Yes — diversified             |

**Trial model needs only ~5% conversion at $9 to match freemium at 5% and $14.** In practice, trials convert 2–5x better than freemium, so you earn more while serving fewer (and higher-quality) users.

### Revenue vs Cost at Scale (Trial Model)

| Signups/Month | Paying (12%) | Revenue | AWS + Edge Cases | Support Cost            | Net Profit   |
| ------------- | ------------ | ------- | ---------------- | ----------------------- | ------------ |
| 100           | 12           | $228    | ~$10             | ~$50 (2 hrs)            | **+$168**    |
| 500           | 60           | $1,140  | ~$25             | ~$150 (6 hrs)           | **+$965**    |
| 1,000         | 120          | $2,280  | ~$55             | ~$300 (12 hrs)          | **+$1,925**  |
| 5,000         | 600          | $11,400 | ~$200            | ~$1,000 (hire help)     | **+$10,200** |
| 10,000        | 1,200        | $22,800 | ~$400            | ~$2,500 (support agent) | **+$19,900** |

> Assumes mixed tiers averaging $19/paying user, 12% trial conversion, support scaling with user count.

---

## Key Takeaways

1. **Don't give away the editor for free.** The editor IS the product — a free tier gives away the value and anchors expectations at $0.
2. **Trial → Paid converts 2–5x better than freemium.** 14-day full-access trial with watermarked exports is the sweet spot.
3. **Build a killer demo page** — no signup, instant "aha moment," CTA to start trial.
4. **Base AWS cost is dirt cheap** — pennies per user. Your real costs are support and file uploads.
5. **File uploads are the #1 infrastructure cost risk.** Compress images, set quotas, never host video.
6. **Support is the #1 real cost.** Budget 2–20 hrs/month depending on scale. Invest in docs and community first.
7. **WAF is non-negotiable.** $6/month prevents $750+/month abuse scenarios.
8. **Price at $9 Starter / $19 Pro minimum.** This covers edge cases with healthy margin even at low conversion.
9. **Add npm license ($199)** for developers embedding Xkin — pure profit, zero ongoing cost.
10. **At 1K signups with 12% conversion, you net ~$1,900/month profit.** That's with all edge cases budgeted.
