import { useCallback } from "react";

import { useAuth } from "@/lib/auth/AuthProvider";
import { networkErrorToViewModel, toApiErrorViewModel } from "@/lib/http/api-errors";
import type { ApiErrorViewModel } from "@/lib/view-models/ui";

export interface ApiClientResult<T> {
  data: T | null;
  error: ApiErrorViewModel | null;
  status: number;
}

export type JsonRequestInit = Omit<RequestInit, "body"> & {
  body?: unknown;
};

const resolveBody = (body: unknown): { body: BodyInit | undefined; isJson: boolean } => {
  if (body === undefined) {
    return { body: undefined, isJson: false };
  }

  if (body === null) {
    return { body: "null", isJson: true };
  }

  if (typeof body === "string" || body instanceof FormData) {
    return { body, isJson: false };
  }

  return { body: JSON.stringify(body), isJson: true };
};

const readResponseBody = async (response: Response): Promise<{ body: unknown; parsed: boolean }> => {
  if (response.status === 204) {
    return { body: null, parsed: true };
  }

  const text = await response.text();
  if (!text) {
    return { body: null, parsed: true };
  }

  try {
    return { body: JSON.parse(text), parsed: true };
  } catch {
    return { body: text, parsed: false };
  }
};

const parseResponse = async <T>(response: Response): Promise<ApiClientResult<T>> => {
  const { body, parsed } = await readResponseBody(response);

  if (!parsed) {
    return {
      data: null,
      error: toApiErrorViewModel(response.status, null, "Invalid JSON response."),
      status: response.status,
    };
  }

  if (!response.ok) {
    return {
      data: null,
      error: toApiErrorViewModel(response.status, body, "Request failed."),
      status: response.status,
    };
  }

  return {
    data: body as T,
    error: null,
    status: response.status,
  };
};

const buildHeaders = (initHeaders: HeadersInit | undefined, isJson: boolean, accessToken: string | null, authRequired: boolean) => {
  const headers = new Headers(initHeaders);

  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }

  if (isJson && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (authRequired && accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  return headers;
};

export const useApiClient = () => {
  const { state } = useAuth();
  const accessToken = state.session?.accessToken ?? null;

  const request = useCallback(
    async <T,>(path: string, init: JsonRequestInit = {}): Promise<ApiClientResult<T>> => {
      const { body: resolvedBody, isJson } = resolveBody(init.body);
      const headers = buildHeaders(init.headers, isJson, accessToken, state.authRequired);

      try {
        const response = await fetch(path, {
          ...init,
          body: resolvedBody,
          headers,
        });

        return await parseResponse<T>(response);
      } catch (error) {
        return {
          data: null,
          error: networkErrorToViewModel(error),
          status: 0,
        };
      }
    },
    [accessToken, state.authRequired]
  );

  return { request };
};
