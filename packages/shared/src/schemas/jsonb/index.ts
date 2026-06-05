// BaseProfile / ModulesEnabled live in @vesper/db (the lower-dependency package
// that owns the user_profiles column shapes). Re-exported here as types only so
// @vesper/shared consumers keep a single import surface. Type-only re-export —
// no value import, so the db ⇄ shared package cycle stays broken.
export type { BaseProfile, ModulesEnabled } from '@vesper/db';
export * from './block-details';
