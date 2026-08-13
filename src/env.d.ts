/// <reference types="@react-three/fiber" />

// Re-export the ThreeElements into React.JSX.IntrinsicElements so that
// three.js JSX elements (primitive, ambientLight, etc.) type-check correctly
// with the react-jsx transform.
import type { ThreeElements } from '@react-three/fiber'

declare global {
  namespace React {
    namespace JSX {
      interface IntrinsicElements extends ThreeElements {}
    }
  }
}
