import { apiClient } from "./client";
import type { Plan, Subscription } from "./types";

export async function getSubscription(): Promise<{
  subscription: Subscription;
  plans: Plan[];
}> {
  return apiClient("/account/subscription");
}

export async function changePlan(
  planId: Subscription["planId"]
): Promise<Subscription> {
  return apiClient<Subscription>("/account/subscription", {
    method: "PUT",
    body: { planId },
  });
}
