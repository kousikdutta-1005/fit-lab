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
| Personality measure | TIPI, Gosling et al. 2003 | Published, validated, free to use. Writing our own questionnaire would be worse and unvalidated. |
| Disordered eating screen | SCOFF, Morgan et al. 1999 | Standard instrument. Never invent a screening tool. |
| Readiness screening | PAR-Q+ framework, ACSM 2015 algorithm | Established clinical screening. |
| Body fat estimate | US Navy tape formula | Free, published, and its error is documented, which matters more than its accuracy. |
| 3D avatar | Built here, deliberately | See below. |

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

So the body is generated from the measurements directly. Rendering still uses
free MIT libraries: `three`, `@react-three/fiber`, `@react-three/drei`. We are
not writing a renderer, only the part that no free service will do honestly.

The form it takes is a holographic scan rather than a realistic human, which is
both more honest about what it is and a better fit for the product. It is a
readout of a body, and it cannot flatter, because the silhouette is a
consequence of the numbers.

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
