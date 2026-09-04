import { PasswordLoginForm } from "@/components/login/password-login-form";

/**
 * Password sign-in for third-party reviewers (Meta app review) who cannot
 * use Google, GitHub or a magic link. Never linked from the app. The
 * credential itself is attached to an existing user with
 * `pnpm auth:set-password`; without one, no email accepts a password here.
 */
export default function TestLoginPage() {
  return <PasswordLoginForm />;
}
