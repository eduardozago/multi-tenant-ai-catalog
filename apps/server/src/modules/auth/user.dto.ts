import type { Role } from "../../shared/context";
import type { Company } from "../companies/company.repository";
import type { User } from "../users/user.repository";

/** Shape of the authenticated user in API responses. No password hash, no token. */
export type AuthUserDto = {
  id: string;
  name: string;
  email: string;
  role: Role;
  company: { id: string; name: string };
};

export function toAuthUserDto(user: User, company: Company): AuthUserDto {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    company: { id: company.id, name: company.name },
  };
}
