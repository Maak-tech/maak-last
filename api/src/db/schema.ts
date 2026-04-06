// Compatibility shim — all tables moved to schema/ subdirectory.
// Existing imports of the form `import { ... } from '../db/schema'` continue to work.
export * from './schema/index.js'
