/* Hand-tinted code. Restraint on purpose: strings carry the coral, keywords
   step back to muted, everything else rides the pre's base color. */

function Str({ children }: { children: React.ReactNode }) {
  return <span className="text-primary">{children}</span>;
}

function Kw({ children }: { children: React.ReactNode }) {
  return <span className="text-muted-foreground">{children}</span>;
}

function Cm({ children }: { children: React.ReactNode }) {
  return <span className="text-muted-foreground/60">{children}</span>;
}

export const sendNode = (
  <code>
    <Kw>import</Kw> {"{ Retransmit }"} <Kw>from</Kw> <Str>"retransmit.dev"</Str>;{"\n\n"}
    <Kw>const</Kw> retransmit = <Kw>new</Kw> Retransmit(process.env.RETRANSMIT_API_KEY);{"\n\n"}
    <Kw>const</Kw> {"{ data, error }"} = <Kw>await</Kw> retransmit.emails.send({"{"}{"\n"}
    {"  "}from: <Str>"Acme &lt;hello@yourdomain.com&gt;"</Str>,{"\n"}
    {"  "}to: <Str>"user@example.com"</Str>,{"\n"}
    {"  "}subject: <Str>"Welcome!"</Str>,{"\n"}
    {"  "}html: <Str>"&lt;h1&gt;Welcome!&lt;/h1&gt;"</Str>,{"\n"}
    {"}"});{"\n\n"}
    console.log(data.id); <Cm>{"// em_xxxxxxxxxxxx"}</Cm>
  </code>
);

export const sendCurl = (
  <code>
    curl -X POST <Str>https://api.retransmit.dev/v1/emails</Str> \{"\n"}
    {"  "}-H <Str>"Authorization: Bearer $RETRANSMIT_API_KEY"</Str> \{"\n"}
    {"  "}-H <Str>"Content-Type: application/json"</Str> \{"\n"}
    {"  "}-d <Str>{`'{
    "from": "Acme <hello@yourdomain.com>",
    "to": "user@example.com",
    "subject": "Welcome!",
    "html": "<h1>Welcome!</h1>"
  }'`}</Str>
  </code>
);

export const sendResponse = (
  <code>
    {"{"}{"\n"}
    {"  "}<Kw>"id"</Kw>: <Str>"em_xxxxxxxxxxxx"</Str>,{"\n"}
    {"  "}<Kw>"status"</Kw>: <Str>"queued"</Str>,{"\n"}
    {"  "}<Kw>"created_at"</Kw>: <Str>"2026-09-01T12:00:00.000Z"</Str>{"\n"}
    {"}"}
  </code>
);

export const batchNode = (
  <code>
    <Kw>const</Kw> {"{ data, error }"} = <Kw>await</Kw> retransmit.batch.send([{"\n"}
    {"  "}{"{"}{"\n"}
    {"    "}from: <Str>"Acme &lt;hello@yourdomain.com&gt;"</Str>,{"\n"}
    {"    "}to: <Str>"one@example.com"</Str>,{"\n"}
    {"    "}subject: <Str>"Hello"</Str>,{"\n"}
    {"    "}html: <Str>"&lt;p&gt;Hi one&lt;/p&gt;"</Str>,{"\n"}
    {"  "}{"}"},{"\n"}
    {"  "}<Cm>{"// …up to 10,000 messages"}</Cm>{"\n"}
    ]);
  </code>
);

export const batchResponse = (
  <code>
    {"{"}{"\n"}
    {"  "}<Kw>"id"</Kw>: <Str>"bt_xxxxxxxxxxxx"</Str>,{"\n"}
    {"  "}<Kw>"total"</Kw>: 10000,{"\n"}
    {"  "}<Kw>"status"</Kw>: <Str>"queued"</Str>,{"\n"}
    {"  "}<Kw>"created_at"</Kw>: <Str>"2026-09-01T12:00:00.000Z"</Str>{"\n"}
    {"}"}
  </code>
);

export const smsNode = (
  <code>
    <Kw>const</Kw> {"{ data, error }"} = <Kw>await</Kw> retransmit.sms.send({"{"}{"\n"}
    {"  "}from: <Str>"Acme"</Str>,{"\n"}
    {"  "}to: <Str>"+237670000000"</Str>,{"\n"}
    {"  "}text: <Str>"Your code is 493 021"</Str>,{"\n"}
    {"}"});{"\n\n"}
    console.log(data.id); <Cm>{"// sms_xxxxxxxxxxxx"}</Cm>
  </code>
);

export const smsResponse = (
  <code>
    {"{"}{"\n"}
    {"  "}<Kw>"id"</Kw>: <Str>"sms_xxxxxxxxxxxx"</Str>,{"\n"}
    {"  "}<Kw>"status"</Kw>: <Str>"queued"</Str>,{"\n"}
    {"  "}<Kw>"created_at"</Kw>: <Str>"2026-09-01T12:00:00.000Z"</Str>{"\n"}
    {"}"}
  </code>
);

export const webhookPayload = (
  <code>
    {"{"}{"\n"}
    {"  "}<Kw>"id"</Kw>: <Str>"whd_xxxxxxxxxxxx"</Str>,{"\n"}
    {"  "}<Kw>"type"</Kw>: <Str>"email.delivered"</Str>,{"\n"}
    {"  "}<Kw>"created_at"</Kw>: <Str>"2026-09-01T12:00:03.000Z"</Str>,{"\n"}
    {"  "}<Kw>"data"</Kw>: {"{"}{"\n"}
    {"    "}<Kw>"emailId"</Kw>: <Str>"em_xxxxxxxxxxxx"</Str>,{"\n"}
    {"    "}<Kw>"to"</Kw>: [<Str>"user@example.com"</Str>],{"\n"}
    {"    "}<Kw>"subject"</Kw>: <Str>"Your receipt"</Str>{"\n"}
    {"  "}{"}"}{"\n"}
    {"}"}
  </code>
);

export const selfHostTerminal = (
  <code>
    <Kw>$</Kw> git clone https://github.com/retransmit-dev/retransmit{"\n"}
    <Kw>$</Kw> cd retransmit && pnpm install{"\n"}
    <Kw>$</Kw> pnpm db:push{"\n"}
    <Kw>$</Kw> pnpm dev{"\n\n"}
    <Cm>{"# api on :3002, dashboard on :3001. your keys, your data"}</Cm>
  </code>
);
