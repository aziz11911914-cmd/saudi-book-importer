import type { AppRole } from "@/lib/auth-provider";

/**
 * Single source of truth for role → landing route mapping.
 * Priority: super_admin > owner > barber > customer.
 */
export function homeForRoles(roles: AppRole[]): "/admin" | "/owner" | "/barber" | "/" {
  if (roles.includes("super_admin")) return "/admin";
  if (roles.includes("owner")) return "/owner";
  if (roles.includes("barber")) return "/barber";
  return "/";
}

/**
 * Returns true when the role has a dedicated workspace dashboard
 * (i.e. should not stay on the public customer homepage after sign-in).
 */
export function hasWorkspace(roles: AppRole[]): boolean {
  return homeForRoles(roles) !== "/";
}
