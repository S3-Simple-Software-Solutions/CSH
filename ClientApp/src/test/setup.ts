import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Cada test arranca con el DOM limpio: ninguno depende de lo que dejo el anterior.
afterEach(cleanup)
