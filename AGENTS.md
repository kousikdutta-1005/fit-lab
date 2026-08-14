# Working rules for fit-lab

Rules for anyone, human or agent, building on this repo.

## Buy before build

**Use a free API or an existing free library wherever one exists. Do not
hand-roll something that is already solved.**

Order of preference:

1. A free API or SDK with terms that permit this use.
2. A free, permissively licensed open-source library or dataset.
3. Something built here, but only when the paid option is expensive or the
   free options are genuinely worse than what can be built.

The exception matters as much as the rule. If the API costs real money, or if
it is free but does the job badly, build it properly instead. A hand-built
thing that fits the product beats a bolted-on service that does not.

Two questions to answer before writing the code:

- Does a free version of this already exist? Check before starting.
- If it exists but does not fit, write down **why** it does not fit. That note
  is the justification for the code that replaces it.

### Decisions made under this rule

| Need | Decision | Why |
|---|---|---|
| Exercise database | `yuhonas/free-exercise-db` | Unlicense, true public domain, 873 exercises. No reason to write our own. |
| Personality measure | TIPI, Gosling et al. 2003. **Removed from the product.** | It was the right instrument for the job, and the job turned out not to exist: ten questions whose answers moved no verdict, no threshold and no exercise. Removed rather than replaced. Recorded here because the rule is buy before build, and the harder rule is do not ask at all. |
| Disordered eating screen | SCOFF, Morgan et al. 1999 | Standard instrument. Never invent a screening tool. |
| Readiness screening | PAR-Q+ framework, ACSM 2015 algorithm | Established clinical screening. |
| Body fat estimate | US Navy tape formula | Free, published, and its error is documented, which matters more than its accuracy. |
| 3D avatar | CC-BY base mesh, deformed here | See below. |
| Anatomy | Open 3D Model of Human Anatomy, CC BY-SA | Expert-made, free. |

### Why the avatar is hand-built

This is the exception to the rule above, so it needs justifying rather than
asserting.

The requirement is free, fully client-side, and a body shape that responds to
real measurements. Nothing provides all three.

- **Ready Player Me**, **Avaturn**: free tiers exist, but body shape comes from
  artistic presets rather than measurements, and avatar creation goes through
  their servers. Two rules broken at once.
- **DiceBear**, **Open Peeps**, **Avataaars**, **Boring Avatars**: genuinely
  free and genuinely client-side, and none of them vary body shape at all. A
  60kg user and a 120kg user get an identical silhouette.
- **Meshcapade / SMPL**: the only option that is actually measurement-driven,
  because SMPL's shape parameters are learned from real body scans. It is a
  paid B2B service, the underlying model is licensed for non-commercial
  research only, it needs a Max Planck licence for a public web app, and no
  JavaScript port exists.
- **MakeHuman**: assets are CC0 and the morph targets do cover real
  anthropometric dimensions. This is the strongest free option and it remains
  open, but it needs a Blender authoring step to bake blendshapes into a GLB.

So the split is: take a free human mesh, write only the part nobody will do
honestly. The base mesh is **"Male base mesh with muscle detail" by
C.J..Goldman, CC-BY-4.0** (commercial use allowed, credit required), and the
measurement-driven deformation is written here. Rendering uses the MIT
libraries `three`, `@react-three/fiber` and `@react-three/drei`.

The figure carries no skin tone, hair or facial hair. The 3D layer always
rendered a teal scan, so the flat fallback matches it, and the appearance
controls are gone. This is not a shortcut: a swatch palette with something
preselected makes one skin tone the default, and rule 1 below forbids treating
any body as the default. A scan has no tone to default to, and the shape the
measurements make — the only thing the product claims to show — is unaffected.

Shoulder width and muscle mass are not asked for either. A person's guess at
their own build is not a measurement, and drawing it as if it were is the
flattery this whole component exists to avoid. Both come from a conservative
default in `src/lib/figure.ts`, and the result page says so.

A first attempt generated the whole body procedurally and it read as a
mannequin, which is worth recording: parametric primitives do not make a body.

A second attempt scaled every horizontal slice of the mesh by one factor, which
is also worth recording, because it is a subtler version of the same mistake. A
slice does not know an arm from a rib, so the waist tape thickened the forearms
and dragged the hands outwards, the shoulders stretched the fingertips, and
weight and height did not reach the figure at all. It rendered without an error
the whole time.

How the deformation stays honest now. `scripts/body-profile.mjs` measures each
committed mesh region by region: it tracks each arm from the hand to the armpit
by continuity, finds the crotch, the hip, the shoulder, the neck and the base of
the skull from the geometry itself, and records each cross-section's convex-hull
perimeter, which is what a tape reads, since a tape bridges the small of a back.
At runtime `src/lib/body-model.ts` turns the readings into bounded parameters
and `src/lib/body-deform.ts` moves the vertices, each part about its own centre,
blended into its neighbours. Both are free of three.js and both are tested
against the real meshes with `npm test`.

The rules inside it: where there is a tape reading the tape wins and weight
never overrules it; where there is none the number is inferred, bounded and
labelled as inferred; the head is never touched, the feet never leave the floor,
and every displacement field saturates at the edge of the part it belongs to, so
a blend can crease at worst and never tear. Past what the mesh can be drawn as,
the figure clamps and says so in one line.

## What the product may ask for

A question earns its place by changing an output. That is the whole test, and
it is enforced in `app/src/lib/flow.ts` rather than in a component, so it can be
tested: which measurements are required for which sex, when a safety group
counts as answered, and which goal fields exist for which goal.

Two rules fall out of it.

- **Conditional, not uniform.** A target weight and a timeline are the two
  halves of a rate, so they appear for fat loss and muscle gain and nowhere
  else. Training age changes the gain-rate model only, so it appears for muscle
  gain only. Asking `stay-healthy` for a goal weight collects a number to throw
  away.
- **Coverage is prescribed, not selected.** The user never chooses muscles.
  The app covers the full body automatically, while the environment choice only
  selects viable variants. The two environments are a defined-minimum home gym
  and a full commercial gym; no-equipment and band-only are not standalone
  equivalents.
- **Never a silent default.** An untouched safety group is not a group of no
  answers; it is an unanswered group, and the flow will not move until the
  person has ticked something or said plainly that none of it applies. The same
  rule governs sex, which is nullable throughout `flow.ts`: it decides the
  body-fat formula, the FFMI ceiling, the waist threshold, the percentile table,
  which mesh is drawn and whether pregnancy is asked at all, so a default of
  male would answer six things on somebody's behalf and then report them back as
  their own. A warning must never be generated from a value nobody supplied
  either, which is why `planFlags` guards every branch on the field being
  present.
- **A starting number is not an answer.** Every tape opens somewhere, and where
  it opens is a drawing decision. The value is only committed once the control
  is deliberately operated, which is what `Tape`'s `onTouch` is for. Without it
  the target weight would arrive pre-answered, and anybody whose real
  measurement happened to equal the starting number could never set it at all.
- **An answer withdrawn takes its consequences with it.** Untick the reason a
  question was offered and the answer to that question goes too: conditions are
  pruned against the readiness flags that opened them, and a change of sex
  withdraws a confirmation that was given about a different list of questions.

## The rules the product cannot break

These come from `PRODUCT.md` and they outrank convenience.

1. **The character is a mirror, not a fantasy.** If an avatar service cannot
   vary body shape by real measurements, it is the wrong service, however good
   it looks. A flattering avatar makes the whole assessment worthless.
2. **Nothing is transmitted.** Every calculation runs on the device. The photo
   never leaves it. Any API that requires uploading a user's body data or
   photograph is disqualified regardless of price.
3. **Show the reasoning and the weakest part of it.** Never a bare score.
4. **Bands, not verdicts.** Measurement error is real and gets shown.
5. **Safety screening comes before any goal**, including disordered eating.
6. **The game layer may carry the feeling. The writing stays flat and adult.**
7. **It must degrade to text.** The 3D layer is an enhancement. If it fails to
   load, on a slow connection or a cheap phone, the assessment still works.

## Evidence

Every factual claim needs a real citation, and anything unverified says so.
Verify from a primary source, not a summary: an early draft of the research
put the 2025 Indian obesity redefinition in the wrong journal, and only
checking PubMed caught it.

Where evidence is contested, say it is contested. The product's only asset is
that it does not flatter, and that includes not flattering itself.

### Anatomy model

The muscle anatomy comes from the **Open 3D Model of Human Anatomy**
(anatomytool.org/open3dmodel), CC BY-SA 4.0, built by anatomists at Leiden UMC,
UMC Utrecht, Maastricht UMC, KU Leuven KULAK, Amsterdam UMC, Radboud UMC and
Gent. This is the rule working as intended: a free, expert-made asset instead of
anything hand-modelled.

It is used for the **muscle and exercise layer only**, never as the body. Its
geometry is fixed, so it cannot answer to anyone's measurements, and it is a
male-only model with no skin. Using it as "you" would reproduce exactly the flaw
that ruled out Ready Player Me.

Obligations, since ShareAlike is not optional:

- The derived file `app/public/anatomy/muscles.glb` is itself CC BY-SA 4.0.
- Attribution appears next to the model in the interface, in
  `app/public/anatomy/LICENSE.txt`, and in the README.
- Changes are documented in that LICENSE.txt, as the licence requires.

Rebuild it with `node scripts/build-anatomy.mjs <upper-limb.glb> <lower-limb.glb>`
using the source files from anatomytool.org. The sources are ~12MB and are not
committed; the built asset is 0.57MB, roughly 454KB over the wire.
