import type { APIContext } from "astro";

import { DEFAULT_USER_ID } from "@/db/supabase.client";
import { errorResponse } from "@/lib/http/responses";
import type { UserId } from "@/types";

type UserIdResult =
  | {
      ok: true;
      userId: UserId;
    }
  | {
      ok: false;
      response: Response;
    };

export const resolveUserId = (context: APIContext): UserIdResult => {
  const authRequired = context.locals.authRequired ?? false;
  const userId = context.locals.user?.id ?? (authRequired ? null : DEFAULT_USER_ID);

  if (!userId) {
    return {
      ok: false,
      response: errorResponse(401, "unauthorized", "Login required."),
    };
  }

  return {
    ok: true,
    userId,
  };
};
