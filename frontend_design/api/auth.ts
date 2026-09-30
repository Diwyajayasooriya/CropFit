import { apiClient } from "./client";
import type {
  AuthResponse,
  ActivationResponse,
  SignUpPayload,
  SignInPayload,
} from "./types";

export async function signUp(payload: SignUpPayload): Promise<AuthResponse> {
  return apiClient<AuthResponse>("/auth/signup", {
    method: "POST",
    body: payload,
  });
}

export async function signIn(payload: SignInPayload): Promise<AuthResponse> {
  return apiClient<AuthResponse>("/auth/signin", {
    method: "POST",
    body: payload,
  });
}

export async function verifyActivationKey(
  key: string
): Promise<ActivationResponse> {
  return apiClient<ActivationResponse>("/auth/verify-key", {
    method: "POST",
    body: { activationKey: key },
  });
}
