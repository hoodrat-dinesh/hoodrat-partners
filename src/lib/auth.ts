import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { ApprovalStatus, UserRole } from "@/lib/types";

export interface AuthContext {
  user: User;
  profile: {
    id: string;
    email: string | null;
    role: UserRole;
    approval_status: ApprovalStatus;
    onboarding_completed: boolean;
    full_name: string | null;
    instagram_handle: string | null;
    follower_count: number | null;
    upi_payout_id: string | null;
    rejection_notes: string | null;
  };
}

export class AuthorizationError extends Error {
  readonly status: number;

  constructor(message: string, status = 403) {
    super(message);
    this.name = "AuthorizationError";
    this.status = status;
  }
}

export async function requireUser(): Promise<AuthContext> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new AuthorizationError("Authentication required", 401);
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select(
      "id, email, role, approval_status, onboarding_completed, full_name, instagram_handle, follower_count, upi_payout_id, rejection_notes",
    )
    .eq("id", user.id)
    .single();

  if (error || !profile) {
    throw new AuthorizationError("Profile not found", 403);
  }

  return {
    user,
    profile: profile as AuthContext["profile"],
  };
}

export async function requireApprovedInfluencer(): Promise<AuthContext> {
  const context = await requireUser();
  if (
    context.profile.role !== "influencer" ||
    context.profile.approval_status !== "approved"
  ) {
    throw new AuthorizationError("Approved influencer access required");
  }
  return context;
}

export async function requireAdmin(): Promise<AuthContext> {
  const context = await requireUser();
  if (
    context.profile.role !== "admin" ||
    context.profile.approval_status !== "approved"
  ) {
    throw new AuthorizationError("Administrator access required");
  }
  return context;
}
