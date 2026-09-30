import type { Request, Response } from "express";

import { getContext } from "../../shared/context";
import type { LoginInput, RegisterInput } from "./auth.schemas";
import type { AuthService } from "./auth.service";
import { clearAuthCookie, setAuthCookie } from "./cookie";

export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly tokenTtlSeconds: number,
  ) {}

  // The token only travels in the httpOnly cookie, never in the response body.
  register = async (req: Request, res: Response) => {
    const { user, token } = await this.auth.register(req.validated.body as RegisterInput);
    setAuthCookie(res, token, this.tokenTtlSeconds);
    res.status(201).json({ user });
  };

  login = async (req: Request, res: Response) => {
    const { user, token } = await this.auth.login(req.validated.body as LoginInput);
    setAuthCookie(res, token, this.tokenTtlSeconds);
    res.status(200).json({ user });
  };

  // Stateless JWT: logout removes the cookie; the token itself stays valid until
  // expiry if it was copied elsewhere (see D-08, no revocation list).
  logout = (_req: Request, res: Response) => {
    clearAuthCookie(res);
    res.status(204).end();
  };

  me = async (req: Request, res: Response) => {
    const user = await this.auth.me(getContext(req));
    res.status(200).json({ user });
  };
}
