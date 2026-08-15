/**
 * The generic, vendor-free home-gym shopping list.
 *
 * Priority order matches what unlocks the most required capacities per rupee/
 * dollar, not what is most exciting to buy. No brands, no affiliate links, no
 * fragile local pricing — only what each item unlocks and the safety rules
 * that go with it.
 */

export type KitItem = {
  id: string
  label: string
  priority: number
  unlocks: string
  guidance: string
  safety: string[]
}

export const HOME_KIT: KitItem[] = [
  {
    id: "kit-dumbbells",
    label: "A pair of adjustable dumbbells",
    priority: 1,
    unlocks: "Every push, pull, hinge and carry pattern in this foundation.",
    guidance: "Small load increments and a positive lock on each collar. Roughly 2.5–24kg per hand covers most novices as a broad starting range, not a target everyone will reach.",
    safety: [
      "Check both locking collars are seated before every set.",
      "Load and unload on a clear, uncluttered floor.",
    ],
  },
  {
    id: "kit-bands",
    label: "Graded resistance bands and a rated anchor",
    priority: 2,
    unlocks: "A vertical-pull option and load progression when dumbbells top out.",
    guidance: "Buy a purpose-built high/low door anchor rated for the band. Never loop a band around a door handle, banister or other furniture.",
    safety: [
      "Inspect the band for nicks or thinning before every session; discard if found.",
      "Keep your face out of the band's snap-back line at all times.",
      "Only anchor to the purpose-built rated anchor point, never furniture.",
    ],
  },
  {
    id: "kit-bench",
    label: "A stable, rated bench or step",
    priority: 3,
    unlocks: "Step-ups, incline press and single-leg work.",
    guidance: "Use a bench or box rated for standing/stepping load. A normal flat bench not rated for standing is for sitting/lying only.",
    safety: [
      "Never stand or jump on a bench that is not rated for it.",
      "Place on a non-slip surface before use.",
    ],
  },
  {
    id: "kit-mat",
    label: "An exercise mat",
    priority: 4,
    unlocks: "Floor work: bird dog, side plank, glute bridge, hip hinge drilling, floor-rise practice.",
    guidance: "Any exercise mat with enough cushioning for elbows and knees.",
    safety: [],
  },
  {
    id: "kit-pull-solution",
    label: "A structurally-mounted pull-up bar, only where a professional confirms the mounting is safe",
    priority: 5,
    unlocks: "A true vertical-pull pattern where the wall/door frame is rated for it.",
    guidance: "Never mount to drywall alone or an unrated door frame. Where structural mounting is not available, use the rated band anchor for a pulldown pattern instead.",
    safety: [
      "Have the mounting checked before first use if there is any doubt about the wall/frame.",
      "Keep the drop zone below the bar clear.",
    ],
  },
  {
    id: "kit-conditioning",
    label: "Nothing extra required — outdoor walking or running covers aerobic base",
    priority: 6,
    unlocks: "The full aerobic-base requirement, at zero cost.",
    guidance: "A jump rope is optional and is noise/ceiling-sensitive for shared or upstairs housing. An expensive cardio machine is never required for the minimum foundation when a safe outdoor option exists.",
    safety: [],
  },
]

export function kitById(id: string): KitItem | undefined {
  return HOME_KIT.find((k) => k.id === id)
}

/**
 * Real ceilings of the home-gym minimum kit. Never papered over with a fake
 * equivalent — each entry names exactly what cannot be matched and why.
 */
export type HomeCeiling = {
  id: string
  label: string
  reason: string
  sourceIds: string[]
}

export const HOME_CEILINGS: HomeCeiling[] = [
  {
    id: "ceiling-maximal-bilateral-strength",
    label: "Maximal bilateral barbell strength",
    reason: "A rack, barbell and safeties are needed to load a back squat or bench press near a true 1-3 rep max safely; dumbbells alone cap the achievable load well below that.",
    sourceIds: ["acsm-2026-position-stand"],
  },
  {
    id: "ceiling-hip-flexed-knee-flexion",
    label: "Hip-flexed knee flexion (leg curl, biceps femoris long head)",
    reason: "A seated/prone leg-curl machine loads the long head of the hamstring in a way a home Nordic curl only partially reproduces.",
    sourceIds: ["maeo-2021-leg-curl"],
  },
  {
    id: "ceiling-heavy-soleus",
    label: "Heavy loaded soleus training",
    reason: "A seated calf-raise machine allows knee-flexed loading a standing dumbbell calf raise cannot match at the top end, though both grow the soleus at moderate loads.",
    sourceIds: ["kinoshita-2023-soleus"],
  },
  {
    id: "ceiling-isolated-lumbar-extension",
    label: "Isolated lumbar extension",
    reason: "The trial evidence behind loaded spinal-extensor strengthening used a dedicated lumbar-extension machine; a home good-morning trains the pattern but not the isolated range.",
    sourceIds: ["steele-2015-lumbar-extension"],
  },
  {
    id: "ceiling-unsafe-vertical-pull",
    label: "Vertical pull under unsafe mounting",
    reason: "Where no structurally-rated pull-up mounting exists, the vertical-pull pattern is trained with a band pulldown instead — a real substitute, not full parity.",
    sourceIds: ["acsm-2026-position-stand"],
  },
  {
    id: "ceiling-bone-stimulus",
    label: "High-load bone-mineral-density stimulus",
    reason: "The strongest bone-density trial evidence used supervised barbell loading above 85% of a true 1RM plus impact; this is a rack-and-plates stimulus a home dumbbell kit cannot reach.",
    sourceIds: ["watson-2018-liftmor-bone"],
  },
]
