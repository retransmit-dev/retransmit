"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SyntaxCode, WindowDots } from "@/components/marketing/syntax-code";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const RESEND_SEND = [
  'import { Resend } from "resend";',
  'import { WelcomeEmail } from "./emails/welcome";',
  "",
  "const resend = new Resend(process.env.RESEND_API_KEY);",
  "",
  "const { data, error } = await resend.emails.send({",
  '  from: "Acme <hello@acme.com>",',
  '  to: "jane@example.com",',
  '  subject: "Welcome to Acme",',
  '  react: <WelcomeEmail name="Jane" />,',
  "});",
].join("\n");

const RETRANSMIT_SEND = [
  'import { Retransmit } from "retransmit.dev";',
  'import { render } from "@react-email/components";',
  'import { WelcomeEmail } from "./emails/welcome";',
  "",
  "const retransmit = new Retransmit(process.env.RETRANSMIT_API_KEY);",
  "",
  "const { data, error } = await retransmit.emails.send({",
  '  from: "Acme <hello@acme.com>",',
  '  to: "jane@example.com",',
  '  subject: "Welcome to Acme",',
  '  html: await render(<WelcomeEmail name="Jane" />),',
  "});",
].join("\n");

const REACT_EMAIL_RENDER = [
  'import { render } from "@react-email/components";',
  'import { WelcomeEmail } from "./emails/welcome";',
  "",
  "// Your template does not change. Render it to a",
  "// string, then pass the string as the body.",
  'const email = <WelcomeEmail name="Jane" />;',
  "",
  "const html = await render(email);",
  "const text = await render(email, { plainText: true });",
  "",
  "await retransmit.emails.send({",
  '  from: "Acme <hello@acme.com>",',
  '  to: "jane@example.com",',
  '  subject: "Welcome to Acme",',
  "  html,",
  "  text,",
  "});",
].join("\n");

const TABS = [
  { value: "resend", label: "Resend", file: "before.tsx", code: RESEND_SEND },
  {
    value: "retransmit",
    label: "Retransmit",
    file: "after.tsx",
    code: RETRANSMIT_SEND,
  },
  {
    value: "react-email",
    label: "React Email",
    file: "render.tsx",
    code: REACT_EMAIL_RENDER,
  },
] as const;


function CodePane({
  file,
  label,
  code,
}: {
  file: string;
  label: string;
  code: string;
}) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">(
    "idle",
  );

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  }

  return (
    <div className="send-example">
      <div className="example-toolbar">
        <span>{file}</span>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Copy code"
          onClick={copyCode}
        >
          {copyState === "copied" ? (
            <Check aria-hidden />
          ) : (
            <Copy aria-hidden />
          )}
        </Button>
      </div>
      <SyntaxCode code={code} label={`${label} code example`} />
      <p className="sr-only" role="status">
        {copyState === "copied"
          ? "Code copied."
          : copyState === "failed"
            ? "Couldn't copy. Select the code above to copy it."
            : ""}
      </p>
    </div>
  );
}

export function MigrationDemo() {
  return (
    <div className="api-example migration-demo">
      <div className="code-editor-window">
        <Tabs defaultValue="retransmit">
          <div className="code-window-chrome">
            <WindowDots />
            <TabsList variant="line" aria-label="Migration step">
              {TABS.map((tab) => (
                <TabsTrigger key={tab.value} value={tab.value}>
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
          {TABS.map((tab) => (
            <TabsContent key={tab.value} value={tab.value}>
              <CodePane file={tab.file} label={tab.label} code={tab.code} />
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  );
}
