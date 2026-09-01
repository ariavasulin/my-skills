---
name: seedance-ads
description: Write and run Seedance 2.0 video-generation prompts for short-form ad creative via Atlas Cloud. Use when generating product videos, social ads, or any short video with Seedance/Atlas — and especially when the model is ignoring directions, drifting between batches, or garbling on-screen text. Covers the three Atlas endpoints (text-to-video, image-to-video, reference-to-video), the real parameter surface, prompt structure that survives the model's internal rewriter, and the documented failure modes not worth fighting.
---

# Seedance 2.0 for ad creative (via Atlas Cloud)

Getting Seedance to obey is mostly *not* a wording problem. It is (a) picking the endpoint
that constrains the output, (b) staying inside the instruction budget, and (c) knowing which
failures are model defects you should route around instead of re-prompting.

Evidence tiers are marked throughout: **[schema]** = live Atlas Cloud OpenAPI schema,
**[paper]** = Seedance arxiv technical reports, **[bytedance]** = ByteDance's own launch post,
**[practice]** = converging practitioner reports, no controlled study.

## Always fetch the schema first

Model IDs and parameters change. Before writing a request body:

```
GET https://api.atlascloud.ai/api/v1/models          # no auth; filter display_console: true
GET <the model entry's `schema` URL>                 # OpenAPI; read components.schemas.Input.properties
```

If a parameter isn't in that schema, it does not exist on that model. Do not send it.

## Pick the endpoint for the control you need

| Endpoint | Use when | Control it buys |
|---|---|---|
| `bytedance/seedance-2.0/text-to-video` | Ideation, rough boards | Least. Everything is inferred. |
| `bytedance/seedance-2.0/image-to-video` | **Most ad work** | Locks appearance via `image` (first frame); `last_image` also locks the ending. |
| `bytedance/seedance-2.0/reference-to-video` | Character/style continuity across a campaign | Up to 9 `reference_images`, 3 `reference_videos`, 3 `reference_audios`. |

`-fast` and `-mini` variants exist at lower cost; neither supports `4k` **[schema]**.

Starting from an image is the single biggest adherence lever — text-only "follows the vibe
more reliably than precise choreography" **[practice]**. In image-to-video, do **not**
re-describe the subject; it's already in the frame. Spend the prompt on motion plus an
explicit `preserve composition and colors` clause **[practice]**.

## Reference syntax: plain words, not @-tags

Atlas resolves references positionally by ordinary phrases:

> "References like 'image 1', 'video 1' refer to inputs in order." **[schema]**

Write `the character in image 1`. **The `@图片1` / `@视频1` syntax in the popular GitHub
Seedance skills is Jimeng web-UI syntax and does nothing here.** This is the most common
way a prompt copied from those guides silently fails.

## Why it ignores you: the internal rewriter

Seedance 1.0's paper documents a trained SFT+DPO stage that expands short user prompts into
dense captions before generation, and warns the rewrite "cannot guarantee that the semantics
of the rewritten results fully meet the requirements of the user prompts" **[paper]**. The 2.0
paper doesn't re-document it; the API exposes no toggle to disable it (verified absent across
Atlas, Volcengine Ark, fal.ai, Replicate, Pollo) **[schema]**.

So a vague prompt isn't rendered vaguely — it's rewritten into someone else's specific, then
rendered faithfully. Specificity is the only lever.

## Prompt structure

Schema allows **Chinese < 500 characters, English < 1000 words** **[schema]** — a ceiling, not
a target. Practitioners independently land near **60–100 words** for best adherence, reporting
that past ≈100 the model "cherry-picks random details while ignoring the ones you care about"
**[practice]**. Treat 60–100 as the working range and the schema limit as headroom for
genuinely complex briefs.

Structure it the way the model was trained to read captions — **dynamic features separated
from static ones** **[paper]**:

```
[static]  subject appearance, wardrobe, product, environment
[dynamic] the one action; then, on its own line, the one camera move
[locked]  color/lighting clause — identical across every generation in a campaign
[avoid]   concrete negatives
```

Budget ≈4 directives per generation: **one subject, one main action, one camera move, one
lighting mood** **[practice]**. "Walk, turn, and raise hand" is already over budget for 5–10s.

## Camera motion

Stacking moves is the most-cited cause of "it did something else" — pan + zoom + tracking in
one prompt reliably yields what testers call a broken gimbal **[practice]**.

- One move per clip. If you must combine, cap at two.
- Always add a speed word. Bare "dollies in" runs too fast; "slowly dollies in" lands.
- Put the camera direction on its own line, separate from subject action.
- Describe subject motion and camera motion as distinct clauses — conflating them
  ("spinning camera around a dancing person") is the most-overlooked mistake.
- Don't write camera specs. `24fps, f/2.8, ISO 800, 85mm` is reported not to work; pacing
  words (slow, smooth, gradual, gentle) do.
- If a move still won't land, stop rewording — supply a short clip in `reference_videos`
  demonstrating it. That's the designed control surface; text is the weaker channel.

**Note:** Seedance's `camera_fixed` boolean (a hard lock on camera drift) exists on native
Volcengine Ark but is **not exposed by Atlas Cloud** **[schema]**. Don't send it.

## Don't fight these — route around them

ByteDance's own launch post concedes 2.0 has "room for optimization regarding multi-subject
consistency, text rendering accuracy, and complex editing effects," plus "detail stability,
hyper-realism, and dynamic vitality" **[bytedance]**.

- **On-screen text/logos** come out as glyph soup ≈90% of the time **[practice]**. Generate
  clean plates; composite every logo, product name, and CTA in post. Remotion is already set
  up for this in `tools/video-captions/`.
- **Three or more characters** → faces drift, bodies warp. Cap at two named subjects; make the
  rest blurred background **[practice]**.
- **Fast hand motion / extreme close-up hands** → extra or merged fingers. Keep hands at
  arm's length, slow the motion, and constrain explicitly: `static hand prop, no finger
  motion, no sleeve change` **[practice]**.
- **Exact timing of an action** ("product appears at 0:03") has no known working technique.
  Allocate seconds to beats, don't specify frames.

## Batch consistency for campaigns

Color drift across batches — batch 1 premium cool-white, batch 2 warm-yellow — is the failure
that shows up at ad scale **[practice]**. `seed` does not save you: same seed gives "similar
results, but complete consistency is not guaranteed" **[schema]**.

1. Write a **master prompt** with a locked color/lighting clause. Never edit that clause; only
   swap scene/subject/action.
2. Use concrete negatives, not vague ones: `avoid high-saturation neon, avoid orange-yellow
   cast, avoid cyan filter`.
3. Feed 3–5 frames from your best prior output into `reference_images` as anchors.
4. Change one variable per batch so you can tell what caused drift.
5. Harmonize with a LUT in post — a finishing step, not a fix.

## Parameters worth setting

- `duration` — enum 4–15, or `-1` to let the model choose. Default 5.
- `resolution` — `480p`→`4k`. `4k` is native UHD 16:9, 10-bit H.265, full models only, and
  may not play in all browsers.
- `ratio` — `9:16` for social. Default `adaptive` infers from the prompt or first frame.
- `generate_audio` — defaults **true**. Set false if you're scoring in post; ByteDance
  concedes "occasional audio distortion" **[bytedance]**.
- `bitrate_mode: high` — crisper, larger file, no extra token cost. Worth it for final ads.
- `return_last_frame: true` — returns the closing frame as an image. This is how you exceed
  15s: feed it as the next clip's `image` and stitch.
- `watermark` — defaults false. Confirm before delivery.

## Running it

Submit → poll. `POST /api/v1/model/generateVideo` returns a prediction ID; poll
`GET /api/v1/model/prediction/{id}` until `completed`. Typically 1–5 min (Fast: 30–90s).
Local images need `POST /api/v1/model/uploadMedia` first to get a URL.

Never retry a failed POST blindly — generation requests are billable and may have succeeded.
