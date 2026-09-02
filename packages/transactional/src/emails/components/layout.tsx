import type { ReactNode } from "react";
import {
  Body,
  Container,
  Head,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "react-email";
import { brand } from "./brand";

/**
 * The one frame every Retransmit email renders inside: the wordmark in the
 * header, the content, support and publisher lines in the footer. The
 * wordmark is text rather than an image so nothing has to be fetched from
 * the marketing site. Emails supply the body and a preview line.
 */
export function EmailLayout({
  title,
  preview,
  children,
}: {
  title?: string;
  preview: string;
  children: ReactNode;
}) {
  return (
    <Html lang="en">
      <Head>
        <title>{title ?? brand.name}</title>
      </Head>
      <Preview>{preview}</Preview>
      <Body style={styles.body}>
        <Container style={styles.frame}>
          <Section style={styles.header}>
            <Link href={brand.siteUrl} style={styles.wordmark}>
              retransmit<span style={styles.wordmarkDot}>.</span>
            </Link>
          </Section>
          <Section style={styles.content}>{children}</Section>
          <EmailFooter />
        </Container>
      </Body>
    </Html>
  );
}

function EmailFooter() {
  const year = new Date().getFullYear();
  return (
    <Section style={styles.footer}>
      <Text style={styles.footerText}>
        © {year} {brand.legalName}, the company behind {brand.name}. All
        rights reserved.
      </Text>
      <Text style={styles.footerText}>
        Questions? Write to{" "}
        <Link href={`mailto:${brand.supportEmail}`} style={styles.footerLink}>
          {brand.supportEmail}
        </Link>
      </Text>
    </Section>
  );
}

/* Shared palette, matching the marketing site's tokens in sRGB. */
export const colors = {
  page: "#f5f3f1",
  card: "#ffffff",
  border: "#e8e4e1",
  rule: "#ece8e5",
  ink: "#252322",
  copy: "#696461",
  muted: "#8b8581",
  accent: "#f15a0f",
  accentCrest: "#f4793c",
  accentLedge: "#d6470a",
} as const;

export const fontFamily =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";

const styles = {
  body: {
    backgroundColor: colors.page,
    color: colors.ink,
    fontFamily,
    margin: 0,
    padding: 0,
  },
  frame: {
    backgroundColor: colors.card,
    border: `1px solid ${colors.border}`,
    margin: "0 auto",
    maxWidth: "520px",
    padding: "0 40px 32px",
  },
  header: {
    padding: "32px 0 24px",
    textAlign: "center" as const,
  },
  wordmark: {
    color: colors.ink,
    fontSize: "22px",
    fontWeight: 800,
    letterSpacing: "-0.5px",
    textDecoration: "none",
  },
  wordmarkDot: {
    color: colors.accent,
  },
  content: {
    padding: 0,
  },
  footer: {
    borderTop: `1px solid ${colors.rule}`,
    margin: "36px 0 0",
    padding: "24px 0 0",
    textAlign: "center" as const,
  },
  footerText: {
    color: colors.muted,
    fontSize: "12px",
    lineHeight: "1.6",
    margin: "0 0 4px",
  },
  footerLink: {
    color: colors.muted,
    textDecoration: "underline",
  },
};

/* Content styles emails share. Keeping them here keeps the emails uniform.
   The button's crest and lip are borders rather than inset shadows because
   Gmail and Outlook drop box-shadow. */
export const content = {
  heading: {
    color: colors.ink,
    fontSize: "26px",
    fontWeight: 700,
    letterSpacing: "-0.6px",
    lineHeight: "1.2",
    margin: "0 0 12px",
  },
  copy: {
    color: colors.copy,
    fontSize: "15px",
    lineHeight: "1.6",
    margin: "0 0 28px",
  },
  button: {
    backgroundColor: colors.accent,
    borderBottom: `2px solid ${colors.accentLedge}`,
    borderLeft: `1px solid ${colors.accent}`,
    borderRadius: "14px",
    borderRight: `1px solid ${colors.accent}`,
    borderTop: `2px solid ${colors.accentCrest}`,
    boxSizing: "border-box" as const,
    color: "#ffffff",
    display: "block",
    fontSize: "16px",
    fontWeight: 600,
    lineHeight: "20px",
    padding: "12px 20px",
    textAlign: "center" as const,
    textDecoration: "none",
  },
  rule: {
    borderColor: colors.rule,
    margin: "32px 0 20px",
  },
  note: {
    color: colors.muted,
    fontSize: "13px",
    lineHeight: "1.5",
    margin: 0,
  },
};
