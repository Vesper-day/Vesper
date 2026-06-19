// Request Zod + response-shape types for the Push Tokens API group (§9).
//
// Co-located. The §9 request body is { deviceId, platform, token,
// liveActivityToken } (camelCase). platform maps to push_platform_enum
// (ios | android | web, §3 table 13). liveActivityToken is nullable — only iOS
// Live Activities carry one; it may be omitted or explicitly null.
import { z } from 'zod';

// push_platform_enum values (§3 table 13).
export const PushPlatformSchema = z.enum(['ios', 'android', 'web']);

export const PushTokenRequestSchema = z
  .object({
    deviceId: z.string().min(1),
    platform: PushPlatformSchema,
    token: z.string().min(1),
    // Optional + nullable: absent (non-iOS) is treated the same as null.
    liveActivityToken: z.string().min(1).nullable().optional(),
  })
  .strict();

export type PushTokenRequest = z.infer<typeof PushTokenRequestSchema>;

// §9 success body. Top-level, no envelope (response.ts convention). 201 on insert,
// 200 on update — the HTTP status, not a body field, carries that distinction.
export interface PushTokenResponse {
  pushToken: {
    deviceId: string;
    platform: z.infer<typeof PushPlatformSchema>;
  };
}
