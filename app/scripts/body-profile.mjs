/**
 * Measure a normalised body mesh: what it is, region by region.
 *
 * The runtime deformation has to know what it is deforming FROM, and it has to
 * know which vertices are torso, which are an arm, which are a leg. Guessing
 * that at runtime from a single |x| threshold is what produced arms that got
 * fatter when the waist tape did, and a skull that grew with the belly.
 *
 * So the segmentation is measured here, once, from the mesh itself, and shipped
 * as a small table. Every number below is the mesh's own geometry. Nothing is
 * assumed about proportion, sex, or pose.
 *
 * The mesh is expected in the normalised form build-body.mjs writes: Y up, feet
 * at y=0, crown at y=1, centred on X and Z, so every length here is a fraction
 * of stature.
 */

export const SLICES = 64

/** A vertex this close to the midline means the two legs have merged. */
const NEAR_MIDLINE = 0.006
/** Arms never come closer to the midline than this in the meshes we support. */
const ARM_MIN_X = 0.085
/** How far an arm may move sideways between neighbouring slices while tracked. */
const TRACK_WINDOW = 0.06
/** Clear air an arm needs between itself and the ribcage to still be an arm. */
const ARM_GAP = 0.012
/** Fewest vertices that count as a real cross-section rather than noise. */
const MIN_CLUSTER = 4

function sliceOf(y) {
  return Math.min(SLICES - 1, Math.max(0, Math.floor(y * SLICES)))
}

function round4(n) {
  return Number.isFinite(n) ? +n.toFixed(4) : 0
}

/** Areas are small numbers in stature units and need the extra places. */
function round6(n) {
  return Number.isFinite(n) ? +n.toFixed(6) : 0
}

/**
 * The height at which the legs stop being two things. Found by asking where the
 * midline is occupied, from the top down, so an inner thigh that nearly touches
 * its neighbour cannot be mistaken for a crotch.
 */
function findCrotch(bySlice) {
  let crotch = 0
  for (let s = SLICES - 1; s >= 0; s--) {
    const solid = bySlice[s].some((p) => Math.abs(p[0]) < NEAR_MIDLINE)
    if (!solid) {
      crotch = s + 1
      break
    }
  }
  return crotch
}

/**
 * Follow each arm from the hand up towards the shoulder.
 *
 * Tracking rather than per-slice gap-finding, because near the armpit the gap
 * between arm and ribcage closes to a couple of millimetres and any threshold
 * that survives there also swallows the ribcage lower down. Continuity is the
 * more reliable prior: an arm does not teleport between two slices 1.5cm apart.
 */
function trackArm(bySlice) {
  const axisX = new Array(SLICES).fill(0)
  const axisZ = new Array(SLICES).fill(0)
  const radiusX = new Array(SLICES).fill(0)
  const radiusZ = new Array(SLICES).fill(0)
  const present = new Array(SLICES).fill(false)

  // Seed at the widest point of the whole body, which is a hand or a forearm.
  let seed = -1
  let widest = 0
  for (let s = 0; s < SLICES; s++) {
    for (const p of bySlice[s]) {
      const ax = Math.abs(p[0])
      if (ax > widest) {
        widest = ax
        seed = s
      }
    }
  }
  if (seed < 0 || widest < ARM_MIN_X) return { axisX, axisZ, radiusX, radiusZ, present, top: -1, bottom: -1 }

  const measure = (s, centre) => {
    const picked = bySlice[s].filter((p) => {
      const ax = Math.abs(p[0])
      return ax >= ARM_MIN_X && Math.abs(ax - centre) <= TRACK_WINDOW
    })
    if (picked.length < MIN_CLUSTER) return null
    let loX = Infinity
    let hiX = -Infinity
    let loZ = Infinity
    let hiZ = -Infinity
    for (const p of picked) {
      const ax = Math.abs(p[0])
      loX = Math.min(loX, ax)
      hiX = Math.max(hiX, ax)
      loZ = Math.min(loZ, p[2])
      hiZ = Math.max(hiZ, p[2])
    }
    // A cluster this wide is the ribcage and the arm read as one thing.
    if (hiX - loX > 0.11) return null

    // The arm has to be a separate thing at this height. Where the gap to
    // whatever lies inboard of it closes, we have reached the armpit and the
    // tracking has to stop rather than walk up the shoulder into the neck.
    let inner = 0
    for (const p of bySlice[s]) {
      const ax = Math.abs(p[0])
      if (ax < loX) inner = Math.max(inner, ax)
    }
    if (loX - inner < ARM_GAP) return null

    return { x: (loX + hiX) / 2, z: (loZ + hiZ) / 2, rx: (hiX - loX) / 2, rz: (hiZ - loZ) / 2 }
  }

  const write = (s, m) => {
    axisX[s] = m.x
    axisZ[s] = m.z
    radiusX[s] = m.rx
    radiusZ[s] = m.rz
    present[s] = true
  }

  const seeded = measure(seed, widest - 0.02)
  if (!seeded) return { axisX, axisZ, radiusX, radiusZ, present, top: -1, bottom: -1 }
  write(seed, seeded)

  let top = seed
  let bottom = seed
  for (let s = seed + 1; s < SLICES; s++) {
    const m = measure(s, axisX[s - 1])
    if (!m) break
    write(s, m)
    top = s
  }
  for (let s = seed - 1; s >= 0; s--) {
    const m = measure(s, axisX[s + 1])
    if (!m) break
    write(s, m)
    bottom = s
  }

  // Above the last tracked slice the arm has merged into the shoulder. Carry the
  // axis on by its own slope for a few slices so the deltoid and the armpit are
  // still recognised as arm when the torso is measured; the runtime fades the
  // arm out across exactly this stretch.
  const span = Math.min(4, top - bottom)
  let reach = top
  if (span >= 2) {
    const slope = (axisX[top] - axisX[top - span]) / span
    const slopeZ = (axisZ[top] - axisZ[top - span]) / span
    for (let s = top + 1; s < Math.min(SLICES, top + 4); s++) {
      const k = s - top
      const x = axisX[top] + slope * k
      if (x < ARM_MIN_X * 0.6) break
      axisX[s] = x
      axisZ[s] = axisZ[top] + slopeZ * k
      radiusX[s] = radiusX[top]
      radiusZ[s] = radiusZ[top]
      reach = s
    }
  }

  // Outside the arm the axis is held where the arm left off rather than being
  // allowed to fall back to zero. A zero would be read as an arm lying along the
  // midline, and the runtime would then treat a belly as a forearm for the two
  // slices it takes to interpolate out. The radius is what goes to zero, which
  // is the honest way to say "there is no arm at this height", and it is taken
  // there over a slice rather than in one step so the mask has no edge.
  // A slice where the arm happened to be sampled thinly must not pinch the
  // mask: take the widest of each neighbourhood, so the tube the runtime tests
  // against is at least as wide as the arm is anywhere near that height. A
  // slightly generous arm costs nothing, and a pinched one hands a forearm to
  // the waist.
  dilate(radiusX, bottom, reach)
  dilate(radiusZ, bottom, reach)

  if (bottom > 0) {
    radiusX[bottom - 1] = radiusX[bottom] * 0.4
    radiusZ[bottom - 1] = radiusZ[bottom] * 0.4
  }
  if (reach < SLICES - 1) {
    radiusX[reach + 1] = radiusX[reach] * 0.4
    radiusZ[reach + 1] = radiusZ[reach] * 0.4
  }
  holdEnds(axisX, bottom, reach)
  holdEnds(axisZ, bottom, reach)

  return { axisX, axisZ, radiusX, radiusZ, present, top: reach, bottom }
}

/** Widen a table to the largest value in each three-slice neighbourhood. */
function dilate(table, from, to) {
  if (from < 0 || to < from) return
  const copy = table.slice()
  for (let s = from; s <= to; s++) {
    table[s] = Math.max(copy[Math.max(from, s - 1)], copy[s], copy[Math.min(to, s + 1)])
  }
}

/** Extend a table outwards by holding its end values, rather than dropping to zero. */
function holdEnds(table, from, to) {
  if (from < 0 || to < from) return
  for (let s = 0; s < from; s++) table[s] = table[from]
  for (let s = to + 1; s < table.length; s++) table[s] = table[to]
}

/** True where a vertex sits inside the tracked arm at its own height. */
function inArm(arm, s, x, z, slack) {
  if (arm.radiusX[s] <= 0) return false
  const nearX = Math.abs(Math.abs(x) - arm.axisX[s]) <= arm.radiusX[s] * slack + 0.008
  const nearZ = Math.abs(z - arm.axisZ[s]) <= Math.max(arm.radiusZ[s], 0.02) * slack + 0.012
  return nearX && nearZ
}

/**
 * The perimeter and area of a cross-section, the way a tape measure would read
 * the first of them.
 *
 * A tape cannot follow a concavity: pulled around a waist it bridges the small
 * of the back and the hollow beside the navel. So the honest measure of a
 * cross-section is its convex hull, not the sum of its edges, and not the
 * ellipse you get from multiplying the widest and deepest points together,
 * which overstates a buttock or a jaw by a good 15%.
 *
 * The area comes from the same hull, and it is what makes a volume, and so a
 * mass, estimable at all.
 */
export function hullMetrics(section) {
  if (section.length < 3) return { perimeter: 0, area: 0 }
  const pts = section.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1])
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
  const half = (input) => {
    const out = []
    for (const p of input) {
      while (out.length >= 2 && cross(out[out.length - 2], out[out.length - 1], p) <= 0) out.pop()
      out.push(p)
    }
    out.pop()
    return out
  }
  const hull = [...half(pts), ...half(pts.slice().reverse())]
  if (hull.length < 3) return { perimeter: 0, area: 0 }
  let perimeter = 0
  let twiceArea = 0
  for (let i = 0; i < hull.length; i++) {
    const a = hull[i]
    const b = hull[(i + 1) % hull.length]
    perimeter += Math.hypot(b[0] - a[0], b[1] - a[1])
    twiceArea += a[0] * b[1] - b[0] * a[1]
  }
  return { perimeter, area: Math.abs(twiceArea) / 2 }
}

export function buildProfile(points) {
  const bySlice = Array.from({ length: SLICES }, () => [])
  for (const p of points) bySlice[sliceOf(p[1])].push(p)

  const crotch = findCrotch(bySlice)
  const arm = trackArm(bySlice)

  const halfWidth = new Array(SLICES).fill(0)
  const halfDepth = new Array(SLICES).fill(0)
  const torsoHalfWidth = new Array(SLICES).fill(0)
  const torsoHalfDepth = new Array(SLICES).fill(0)
  const torsoCentreZ = new Array(SLICES).fill(0)
  const torsoGirth = new Array(SLICES).fill(0)
  const torsoArea = new Array(SLICES).fill(0)
  const legAxisX = new Array(SLICES).fill(0)
  const legAxisZ = new Array(SLICES).fill(0)
  const legRadiusX = new Array(SLICES).fill(0)
  const legRadiusZ = new Array(SLICES).fill(0)
  const legGirth = new Array(SLICES).fill(0)
  const legArea = new Array(SLICES).fill(0)
  const armArea = new Array(SLICES).fill(0)

  for (let s = 0; s < SLICES; s++) {
    let torsoLoZ = Infinity
    let torsoHiZ = -Infinity
    let legLoX = Infinity
    let legHiX = -Infinity
    let legLoZ = Infinity
    let legHiZ = -Infinity
    let legs = 0
    const torsoSection = []
    const legSection = []
    const armSection = []

    for (const p of bySlice[s]) {
      const ax = Math.abs(p[0])
      halfWidth[s] = Math.max(halfWidth[s], ax)
      halfDepth[s] = Math.max(halfDepth[s], Math.abs(p[2]))

      if (inArm(arm, s, p[0], p[2], 1.18)) {
        if (p[0] >= 0) armSection.push([p[0], p[2]])
        continue
      }

      if (s < crotch) {
        legs++
        legLoX = Math.min(legLoX, ax)
        legHiX = Math.max(legHiX, ax)
        legLoZ = Math.min(legLoZ, p[2])
        legHiZ = Math.max(legHiZ, p[2])
        if (p[0] >= 0) legSection.push([p[0], p[2]])
      } else {
        torsoHalfWidth[s] = Math.max(torsoHalfWidth[s], ax)
        torsoHalfDepth[s] = Math.max(torsoHalfDepth[s], Math.abs(p[2]))
        torsoLoZ = Math.min(torsoLoZ, p[2])
        torsoHiZ = Math.max(torsoHiZ, p[2])
        torsoSection.push([p[0], p[2]])
      }
    }

    if (torsoHiZ > torsoLoZ) torsoCentreZ[s] = (torsoLoZ + torsoHiZ) / 2
    const torsoHull = hullMetrics(torsoSection)
    torsoGirth[s] = torsoHull.perimeter
    torsoArea[s] = torsoHull.area
    armArea[s] = hullMetrics(armSection).area
    if (legs >= MIN_CLUSTER) {
      legAxisX[s] = (legLoX + legHiX) / 2
      legAxisZ[s] = (legLoZ + legHiZ) / 2
      legRadiusX[s] = (legHiX - legLoX) / 2
      legRadiusZ[s] = (legHiZ - legLoZ) / 2
      const legHull = hullMetrics(legSection)
      legGirth[s] = legHull.perimeter
      legArea[s] = legHull.area
    }
  }

  // Sparse slices leave holes. Fill them from their neighbours so every runtime
  // lookup lands on a real number and the curves stay continuous.
  fillGaps(legAxisX)
  fillGaps(legAxisZ)
  fillGaps(legRadiusX)
  fillGaps(legRadiusZ)
  fillGaps(legGirth)
  fillGaps(legArea)
  fillGaps(torsoHalfWidth)
  fillGaps(torsoHalfDepth)
  fillGaps(torsoGirth)
  fillGaps(torsoArea)

  // The legs' own axes, held above the crotch for the same reason as the arm's:
  // where the runtime blends the last of the leg into the first of the pelvis it
  // needs a leg centre that is still where a leg is.
  const legFrom = legAxisX.findIndex((v) => v > 0)
  let legTo = -1
  for (let s = 0; s < SLICES; s++) if (legAxisX[s] > 0) legTo = s
  holdEnds(legAxisX, legFrom, legTo)
  holdEnds(legAxisZ, legFrom, legTo)

  const landmarks = findLandmarks({ torsoHalfWidth, torsoGirth, halfWidth, crotch, arm })

  return {
    slices: SLICES,
    note:
      "Measured from the mesh itself by scripts/body-profile.mjs. Lengths are fractions of stature: feet at 0, crown at 1. Girths are convex-hull perimeters of each cross-section, which is what a tape reads, and areas are the same hull, which is what makes a volume. Arm and leg tables describe each limb's own axis and radius, so the runtime can thicken a limb about its own centre instead of about the body's midline.",
    landmarks,
    halfWidth: halfWidth.map(round4),
    halfDepth: halfDepth.map(round4),
    torsoHalfWidth: torsoHalfWidth.map(round4),
    torsoHalfDepth: torsoHalfDepth.map(round4),
    torsoCentreZ: torsoCentreZ.map(round4),
    torsoGirth: torsoGirth.map(round4),
    torsoArea: torsoArea.map(round6),
    arm: {
      axisX: arm.axisX.map(round4),
      axisZ: arm.axisZ.map(round4),
      radiusX: arm.radiusX.map(round4),
      radiusZ: arm.radiusZ.map(round4),
      area: armArea.map(round6),
    },
    leg: {
      axisX: legAxisX.map(round4),
      axisZ: legAxisZ.map(round4),
      radiusX: legRadiusX.map(round4),
      radiusZ: legRadiusZ.map(round4),
      girth: legGirth.map(round4),
      area: legArea.map(round6),
    },
  }
}

function fillGaps(table) {
  let last = -1
  for (let s = 0; s < table.length; s++) {
    if (table[s] > 0) {
      if (last >= 0 && s - last > 1) {
        for (let k = last + 1; k < s; k++) {
          const t = (k - last) / (s - last)
          table[k] = table[last] + (table[s] - table[last]) * t
        }
      }
      last = s
    }
  }
}

/**
 * The landmarks the tape measurements attach to.
 *
 * Waist and chest are fixed anthropometric heights rather than mesh features,
 * because they are defined by where a person is told to put the tape: the app
 * asks for the waist at the navel, which is about 0.60 of stature, and the
 * chest is read at about 0.72. Hip, shoulder, neck and head base are found in
 * the mesh, because those are places the geometry itself defines.
 */
function findLandmarks({ torsoHalfWidth, torsoGirth, halfWidth, crotch, arm }) {
  // Start two slices above the crotch: at the crotch itself a cross-section is
  // still two thighs and a backside, and reads far wider than any hip tape.
  let hip = Math.min(SLICES - 1, crotch + 2)
  for (let s = hip; s < Math.min(SLICES, crotch + 9); s++) {
    if (torsoGirth[s] > torsoGirth[hip]) hip = s
  }

  // The neck is the thinnest cross-section above the shoulders, measured as
  // girth rather than width so a jaw seen from the front cannot win.
  let neck = -1
  const from = Math.round(SLICES * 0.8)
  const to = Math.round(SLICES * 0.92)
  for (let s = from; s < to; s++) {
    if (torsoGirth[s] <= 0) continue
    if (neck < 0 || torsoGirth[s] < torsoGirth[neck]) neck = s
  }
  if (neck < 0) neck = Math.round(SLICES * 0.86)

  // The shoulder is the widest the torso gets below the neck.
  let shoulder = neck
  for (let s = Math.round(SLICES * 0.7); s < neck; s++) {
    if (torsoHalfWidth[s] > torsoHalfWidth[shoulder]) shoulder = s
  }

  // The head starts where the body stops narrowing and begins to widen again.
  let headBase = neck + 1
  for (let s = neck + 1; s < SLICES; s++) {
    if (halfWidth[s] > halfWidth[neck] * 1.08) {
      headBase = s
      break
    }
    headBase = s
  }

  // Six places, because every landmark is a multiple of 1/64 and six places
  // represent those exactly. Four would round 29/64 to 0.4531, which multiplied
  // back out lands on slice 28, and a crotch one slice too low is a crease.
  const place = (slice) => +(slice / SLICES).toFixed(6)

  return {
    crotch: place(crotch),
    hip: place(hip),
    waist: 0.6,
    chest: 0.72,
    shoulder: place(shoulder),
    neck: place(neck),
    headBase: place(headBase),
    armTop: place(arm.top < 0 ? 0 : Math.min(SLICES - 1, arm.top)),
    armBottom: place(arm.bottom < 0 ? 0 : arm.bottom),
  }
}

/** Read every POSITION as an array of [x, y, z], for a glTF-transform document. */
export function pointsOf(doc) {
  const points = []
  const v = []
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute("POSITION")
      if (!pos) continue
      for (let i = 0; i < pos.getCount(); i++) {
        pos.getElement(i, v)
        points.push([v[0], v[1], v[2]])
      }
    }
  }
  return points
}
