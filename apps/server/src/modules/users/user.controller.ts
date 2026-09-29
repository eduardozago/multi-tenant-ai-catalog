import type { Request, Response } from "express";

import { getContext } from "../../shared/context";
import type { User } from "./user.repository";
import type { CreateUserInput } from "./user.schemas";
import type { UserService } from "./user.service";

// companyId is implied by the caller's session, so it is not repeated per user.
function toUserDto(user: User) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
  };
}

export class UserController {
  constructor(private readonly users: UserService) {}

  list = async (req: Request, res: Response) => {
    const users = await this.users.list(getContext(req));
    res.status(200).json({ users: users.map(toUserDto) });
  };

  create = async (req: Request, res: Response) => {
    const user = await this.users.create(getContext(req), req.validated.body as CreateUserInput);
    res.status(201).json({ user: toUserDto(user) });
  };
}
