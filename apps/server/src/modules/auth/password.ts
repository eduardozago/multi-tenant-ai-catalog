import bcrypt from "bcryptjs";

const BCRYPT_COST = 10;

export class PasswordHasher {
  // Hash of a random value, used so a login for an unknown email costs the same
  // bcrypt work as a wrong password (no timing-based user enumeration).
  private readonly dummyHash = bcrypt.hashSync(crypto.randomUUID(), BCRYPT_COST);

  hash(password: string): Promise<string> {
    return bcrypt.hash(password, BCRYPT_COST);
  }

  compare(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /** Burns the same time as `compare`; always resolves false. */
  async compareAgainstDummy(password: string): Promise<false> {
    await bcrypt.compare(password, this.dummyHash);
    return false;
  }
}
