import { describe, expect, it } from "vitest";

import { providerFromMxHosts } from "./mailbox-provider";

describe("providerFromMxHosts", () => {
  it("recognises a Microsoft 365 tenant behind a custom domain", () => {
    expect(providerFromMxHosts(["acme-roofing-com.mail.protection.outlook.com"])).toBe(
      "microsoft365",
    );
  });

  it("tells consumer Outlook apart from a business tenant", () => {
    expect(providerFromMxHosts(["outlook-com.olc.protection.outlook.com"])).toBe(
      "outlook_consumer",
    );
  });

  it("recognises Google Workspace behind a custom domain", () => {
    expect(
      providerFromMxHosts([
        "aspmx.l.google.com",
        "alt1.aspmx.l.google.com",
        "alt2.aspmx.l.google.com",
      ]),
    ).toBe("google_workspace");
  });

  it("recognises the security gateways that front other providers", () => {
    expect(providerFromMxHosts(["eu-smtp-inbound-1.mimecast.com"])).toBe("mimecast");
    expect(providerFromMxHosts(["mx1-us1.ppe-hosted.com"])).toBe("proofpoint");
  });

  it("ignores a trailing dot and case from the resolver", () => {
    expect(providerFromMxHosts(["ACME-COM.MAIL.PROTECTION.OUTLOOK.COM."])).toBe("microsoft365");
  });

  it("goes by the lowest-preference host, which is sorted first", () => {
    expect(providerFromMxHosts(["mx.zoho.com", "mx2.zoho.com"])).toBe("zoho");
  });

  it("reports a self-hosted or unrecognised server as other", () => {
    expect(providerFromMxHosts(["mail.acme-roofing.com"])).toBe("other");
  });

  it("reports a domain with no MX record as unable to receive mail", () => {
    expect(providerFromMxHosts([])).toBe("none");
  });
});
