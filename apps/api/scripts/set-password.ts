/**
 * Attaches a password to an existing user so a third-party reviewer (Meta
 * app review) can sign in at /login/test without Google, GitHub or email
 * access. The user keeps their other sign-in methods; this only adds (or
 * replaces) the credential account, exactly as Better Auth's setPassword
 * endpoint would for a signed-in user.
 *
 * Usage (local, from the repo root):
 *   pnpm auth:set-password --user jpainam@gmail.com --password '<20+ chars>'
 *
 * Against the remote database, prefix the same command with the remote URL
 * (an already-set DATABASE_URL wins over the one in .env):
 *   DATABASE_URL=postgres://... pnpm auth:set-password --user ... --password ...
 *
 * Re-run with a new password to rotate it once the review is over, or pass
 * --remove to drop password sign-in for that user entirely.
 */
import { parseArgs } from "node:util";

import { auth } from "@retransmit/auth";

const { values } = parseArgs({
  options: {
    user: { type: "string" },
    password: { type: "string" },
    remove: { type: "boolean", default: false },
  },
});

async function main() {
  if (!values.user) throw new Error("--user <email> is required");
  if (!values.remove && !values.password) {
    throw new Error("--password <value> is required (or pass --remove)");
  }

  const ctx = await auth.$context;
  const found = await ctx.internalAdapter.findUserByEmail(values.user);
  if (!found) throw new Error(`No user with email ${values.user}`);
  const { user } = found;

  const existing = await ctx.internalAdapter.findCredentialAccount(user.id);

  if (values.remove) {
    if (!existing) {
      console.log(`${user.email} has no password sign-in; nothing to remove.`);
      return;
    }
    await ctx.internalAdapter.deleteAccount(existing.id);
    console.log(`Removed password sign-in for ${user.email}.`);
    return;
  }

  const password = values.password as string;
  const { minPasswordLength, maxPasswordLength } = ctx.password.config;
  if (password.length < minPasswordLength) {
    throw new Error(`Password must be at least ${minPasswordLength} characters`);
  }
  if (password.length > maxPasswordLength) {
    throw new Error(`Password must be at most ${maxPasswordLength} characters`);
  }

  const hash = await ctx.password.hash(password);
  if (existing) {
    await ctx.internalAdapter.updateAccount(existing.id, { password: hash });
    console.log(`Updated the password for ${user.email}.`);
  } else {
    await ctx.internalAdapter.linkAccount({
      userId: user.id,
      providerId: "credential",
      // Mirrors better-auth's createLocalAccountIssuer("credential"), which
      // is not exported from the public package.
      issuer: "local:credential",
      accountId: user.id,
      password: hash,
    });
    console.log(`Added password sign-in for ${user.email}.`);
  }

  // Password sign-in refuses unverified users when verification is required;
  // it is not, but keep the flag honest for a user who proved the mailbox
  // through OAuth or a magic link already.
  if (!user.emailVerified) {
    await ctx.internalAdapter.updateUser(user.id, { emailVerified: true });
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
