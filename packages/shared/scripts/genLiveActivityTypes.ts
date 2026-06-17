/**
 * genLiveActivityTypes.ts — deterministic codegen for the Live Activity model.
 *
 * Reads packages/shared/src/liveActivity/schema.json (the SSOT, transcribed from
 * TECHNICAL_SPEC.md §7) and emits two generated files:
 *   - apps/mobile/ios/VesperLiveActivity/ActivityModels.swift  (ActivityKit model)
 *   - packages/shared/src/liveActivity/types.ts                (TS wire types)
 *
 * Both outputs carry a "GENERATED — DO NOT EDIT" header. Field/key order follows
 * the JSON property insertion order in schema.json, so re-running this script must
 * produce NO diff. Edit schema.json, never the generated files.
 *
 * Run from the repo root:  pnpm gen:live-activity-types
 * Drift check:             pnpm gen:live-activity-types && git diff --exit-code
 *
 * No deps beyond Node's stdlib — pure string templating, no network, no model call.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url)); // packages/shared/scripts
const REPO_ROOT = resolve(HERE, '..', '..', '..');

const SCHEMA_PATH = resolve(HERE, '..', 'src', 'liveActivity', 'schema.json');
const SWIFT_OUT = resolve(
  REPO_ROOT,
  'apps',
  'mobile',
  'ios',
  'VesperLiveActivity',
  'ActivityModels.swift',
);
const TS_OUT = resolve(HERE, '..', 'src', 'liveActivity', 'types.ts');

const SCHEMA_REL = 'packages/shared/src/liveActivity/schema.json';
const REGEN_CMD = 'pnpm gen:live-activity-types';

type JsonType = 'string' | 'integer' | ['string', 'null'];

interface Property {
  type: JsonType;
  format?: string;
  'x-swift-comment'?: string;
  'x-ts-comment'?: string;
}

interface Definition {
  title: string;
  properties: Record<string, Property>;
  required: string[];
}

interface Schema {
  definitions: {
    attributes: Definition;
    contentState: Definition;
  };
}

const schema: Schema = JSON.parse(readFileSync(SCHEMA_PATH, 'utf8'));

function isNullable(type: JsonType): boolean {
  return Array.isArray(type) && type.includes('null');
}

// --- Swift mapping ---------------------------------------------------------

function swiftType(prop: Property): string {
  const base = Array.isArray(prop.type) ? 'String' : prop.type === 'integer' ? 'Int' : 'String';
  return isNullable(prop.type) ? `${base}?` : base;
}

function swiftFields(def: Definition, indent: string): string {
  return Object.entries(def.properties)
    .map(([name, prop]) => {
      const comment = prop['x-swift-comment'] ? `${indent}// ${prop['x-swift-comment']}\n` : '';
      return `${comment}${indent}var ${name}: ${swiftType(prop)}`;
    })
    .join('\n');
}

function renderSwift(): string {
  const { attributes, contentState } = schema.definitions;
  return `// GENERATED — DO NOT EDIT.
// Source of truth: ${SCHEMA_REL}
// Regenerate: ${REGEN_CMD}
//
// Authored as committed text only; the VesperLiveActivity target is created and
// wired into the Xcode project in a Mac session — see
// docs/RUNBOOKS/IOS_WIDGET_REBUILD.md.

import ActivityKit
import Foundation

struct ${attributes.title}: ActivityAttributes {
    public struct ${contentState.title === 'VesperLiveActivityContentState' ? 'ContentState' : contentState.title}: Codable, Hashable {
${swiftFields(contentState, '        ')}
    }

${swiftFields(attributes, '    ')}
}
`;
}

// --- TypeScript mapping -----------------------------------------------------

function tsType(prop: Property): string {
  const base = Array.isArray(prop.type) ? 'string' : prop.type === 'integer' ? 'number' : 'string';
  return isNullable(prop.type) ? `${base} | null` : base;
}

function tsFields(def: Definition): string {
  return Object.entries(def.properties)
    .map(([name, prop]) => {
      const comment = prop['x-ts-comment'] ? `  /** ${prop['x-ts-comment']} */\n` : '';
      return `${comment}  ${name}: ${tsType(prop)};`;
    })
    .join('\n');
}

function renderTs(): string {
  const { attributes, contentState } = schema.definitions;
  return `// GENERATED — DO NOT EDIT.
// Source of truth: ${SCHEMA_REL}
// Regenerate: ${REGEN_CMD}
//
// Mirrors apps/mobile/ios/VesperLiveActivity/ActivityModels.swift. Intentionally
// NOT exported from packages/shared/src/index.ts (no app imports this yet — that
// is chat 079's job, which must also solve the apps/mobile moduleResolution:'node'
// + @vesper/shared exports-map resolution gap; see CHAT_077_RESOLUTION_RECORD.md).

export interface ${attributes.title} {
${tsFields(attributes)}
}

export interface ${contentState.title} {
${tsFields(contentState)}
}
`;
}

mkdirSync(dirname(SWIFT_OUT), { recursive: true });
mkdirSync(dirname(TS_OUT), { recursive: true });
writeFileSync(SWIFT_OUT, renderSwift(), 'utf8');
writeFileSync(TS_OUT, renderTs(), 'utf8');

// eslint-disable-next-line no-console
console.log(`Generated:\n  ${SWIFT_OUT}\n  ${TS_OUT}`);
