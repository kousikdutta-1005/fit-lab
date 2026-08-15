import { resolve } from "node:path"

import { MUSCLES } from "../src/data/exercises.ts"
import { anatomyGroupCoverage } from "./anatomy-coverage.mjs"

const anatomy = resolve("public/anatomy/muscles.glb")
const coverage = await anatomyGroupCoverage(anatomy)
const missing = MUSCLES.map(({ id }) => id).filter((id) => !coverage.has(id))

if (missing.length > 0) {
  throw new Error(`Anatomy is missing renderable recommendation groups: ${missing.join(", ")}`)
}

console.log(
  `anatomy coverage: ${MUSCLES.map(({ id }) => `${id} (${coverage.get(id)})`).join(", ")}`,
)
