import { Button, Heading, Hr, Text } from "react-email";
import { EmailLayout, content } from "./components/layout";

export default function MagicLinkEmail({ url }: { url: string }) {
  return (
    <EmailLayout
      title="Sign in to Retransmit"
      preview="Use your secure link to sign in to Retransmit"
    >
      <Heading style={content.heading}>Sign in to Retransmit</Heading>
      <Text style={content.copy}>
        Use the secure button below to finish signing in. This link expires in
        5 minutes and can only be used once.
      </Text>
      <Button href={url} style={content.button}>
        Sign in to Retransmit
      </Button>
      <Hr style={content.rule} />
      <Text style={content.note}>
        If you did not request this email, you can safely ignore it.
      </Text>
    </EmailLayout>
  );
}

MagicLinkEmail.PreviewProps = {
  url: "https://app.retransmit.dev/api/auth/magic-link/verify?token=preview",
};
