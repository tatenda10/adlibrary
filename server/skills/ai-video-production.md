---
name: ai-video-production
description: Plan and prompt short AI-generated videos from a brand brief, product reference, platform, duration, and desired visual style. Use for UGC, product demos, explainers, slideshows, cinematic clips, and multi-scene ad videos.
metadata:
  version: 1.0.0
  source: AI VIDEOS RESOURCES notes
---

# AI Video Production

Create videos as a sequence of intentional shots, not as one vague prompt. The goal is a stable subject, readable action, controlled camera movement, and a clear final frame that can be edited into a useful short-form video.

## Required brief

Before generating, collect:

- Product or subject, offer, audience, and brand constraints
- Platform and format: TikTok/Reels, Facebook feed, story, YouTube Shorts, or landscape
- Duration: 5, 10, 15, or 30 seconds
- Aspect ratio, reference images, voice/audio needs, and text-overlay requirements
- Desired emotion, visual style, color mood, and call to action

If information is missing, make the smallest safe assumption and expose it in the output rather than inventing product claims.

## Planning workflow

1. Define the single job of the video: stop the scroll, explain, demonstrate, prove, or convert.
2. Choose one hook and one primary desire. Do not dilute a short video with multiple promises.
3. Select a format that matches the content: UGC testimonial, unboxing, day-in-the-life, problem/solution, before/after, GRWM, comparison, street interview, tutorial, or story time.
4. Turn the format into 2–6 shots. Each shot should have one visible action and one purpose.
5. Generate short clips, evaluate continuity, then assemble and caption them. Do not assume a single long generation will preserve identity, product details, and text.

## Prompt schema

Use this order for each shot:

```text
Subject + visible action + environment + composition/framing + lens/look
Camera movement: [single deliberate move]
Start position: [where the camera begins]
Speed: [slow, natural, fast, or locked]
End position: [where the camera finishes]
Timing: [what happens at the beginning, middle, and end]
Lighting + color grade + visual style
Audio/dialogue/captions, if required
Constraints: preserve identity, anatomy, product shape, logo placement, and readable composition
```

Keep camera movement explicit and singular. Useful movements include push-in for realization, pull-back for scale, orbit for product reveal, tracking for motion, crane for geography, pan/tilt for discovery, and a locked-off shot for demonstrations. Avoid stacking conflicting movements or asking for “cinematic” without specifying what changes on screen.

## Visual direction

- Put style and color language at the end of the prompt after the scene description.
- Pick one mood and one palette: clean/cool, warm/golden, dark/moody, natural/documentary, luxury, high-energy, or another deliberate choice.
- Connect lighting to the grade. Warm golden color needs warm motivated light; dark teal/orange needs controlled contrast and shadow.
- Use native platform language: selfie and casual for TikTok/Reels, educational or screen-recorded for YouTube, and feed-native or carousel-friendly composition for Meta.
- Treat reference media as structural inspiration. Preserve the useful pattern, not another brand's exact copy, identity, or product.

## Duration and continuity

- 5 seconds: one hook, one action, one visual payoff.
- 10 seconds: hook, demonstration, payoff.
- 15 seconds: hook, problem, mechanism or proof, CTA.
- 30 seconds: several short shots with a clear escalation; generate and stitch segments rather than forcing one long take.

For every shot, repeat the subject description, wardrobe/product details, location, camera height, and lighting. Keep the last frame useful for editing or a CTA. Review for face drift, object deformation, floating motion, fake slow motion, unreadable text, and inconsistent branding.

## Output contract

Return:

1. A shot list with timestamps and purpose.
2. One production prompt per shot.
3. Voiceover/dialogue and on-screen text separately.
4. Aspect ratio, duration, style, color, and audio settings.
5. A continuity and claim-safety checklist.
6. Provider/model settings and generation IDs so successful versions can be reproduced.

## Iteration loop

Generate a small batch, select the clearest take, and change one variable at a time. Prioritize fixing subject consistency, action clarity, framing, and hook readability before adding visual complexity. Save the prompt, reference assets, model, settings, and selected result together.

