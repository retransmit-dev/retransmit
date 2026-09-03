"use client";

import Image from "next/image";
import { useState } from "react";

import { toast } from "sonner";
import z from "zod";

import Loader from "@/components/loader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

type SocialProvider = "google" | "github";

function GoogleIcon() {
  return (
    <Image src="/images/google.svg" alt="" width={16} height={16} className="size-4" />
  );
}

function GitHubIcon() {
  // The mark is near-black; invert it in dark mode so it stays visible.
  return (
    <Image src="/images/github.svg" alt="" width={16} height={16} className="size-4 dark:invert" />
  );
}

export default function LoginPage() {
  const { isPending } = authClient.useSession();
  const [email, setEmail] = useState("");
  const [socialPending, setSocialPending] = useState<SocialProvider | null>(
    null,
  );
  const [magicLinkPending, setMagicLinkPending] = useState(false);
  const [magicLinkSentTo, setMagicLinkSentTo] = useState<string | null>(null);

  const signInWithSocial = async (provider: SocialProvider) => {
    setSocialPending(provider);
    await authClient.signIn.social(
      { provider, callbackURL: "/" },
      {
        onError: (error) => {
          setSocialPending(null);
          toast.error(error.error.message || error.error.statusText);
        },
      },
    );
  };

  const sendMagicLink = async (event: React.FormEvent) => {
    event.preventDefault();
    const parsed = z.email().safeParse(email.trim());
    if (!parsed.success) {
      toast.error("Enter a valid email address");
      return;
    }
    setMagicLinkPending(true);
    await authClient.signIn.magicLink(
      { email: parsed.data, callbackURL: "/" },
      {
        onSuccess: () => setMagicLinkSentTo(parsed.data),
        onError: (error) => {
          toast.error(error.error.message || error.error.statusText);
        },
      },
    );
    setMagicLinkPending(false);
  };

  if (isPending) {
    return <Loader />;
  }

  if (magicLinkSentTo) {
    return (
      <div className="mx-auto mt-10 w-full max-w-md p-6 text-center">
        <h1 className="text-3xl font-bold">Check your email</h1>
        <p className="mt-4 text-muted-foreground">
          Link sent to <strong>{magicLinkSentTo}</strong>. Expires in 5 minutes.
        </p>
        <Button
          variant="link"
          className="mt-4"
          onClick={() => setMagicLinkSentTo(null)}
        >
          Use another email
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto mt-10 w-full max-w-md p-6">
      <h1 className="mb-2 text-center text-3xl font-bold">
        Sign in to Retransmit
      </h1>
      <p className="mb-6 text-center text-sm text-muted-foreground">
        First sign-in creates an account.
      </p>

      <div className="space-y-3">
        <Button
          variant="outline"
          className="w-full"
          disabled={socialPending !== null}
          onClick={() => signInWithSocial("google")}
        >
          <GoogleIcon />
          {socialPending === "google"
            ? "Redirecting..."
            : "Continue with Google"}
        </Button>
        <Button
          variant="outline"
          className="w-full"
          disabled={socialPending !== null}
          onClick={() => signInWithSocial("github")}
        >
          <GitHubIcon />
          {socialPending === "github"
            ? "Redirecting..."
            : "Continue with GitHub"}
        </Button>
      </div>

      <div className="my-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs uppercase text-muted-foreground">or</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <form onSubmit={sendMagicLink} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </div>
        <Button
          type="submit"
          className="w-full"
          disabled={magicLinkPending || socialPending !== null}
        >
          {magicLinkPending ? "Sending..." : "Send magic link"}
        </Button>
      </form>
    </div>
  );
}
