import { Button, Heading, Hr, Text } from "react-email";
import { EmailLayout, content } from "./components/layout";

export default function OrganizationInvitationEmail({
  url,
  organizationName,
  inviterName,
  inviterEmail,
}: {
  url: string;
  organizationName: string;
  inviterName: string;
  inviterEmail: string;
}) {
  return (
    <EmailLayout
      title={`Join ${organizationName} on Retransmit`}
      preview={`${inviterName} invited you to ${organizationName} on Retransmit`}
    >
      <Heading style={content.heading}>
        Join {organizationName} on Retransmit
      </Heading>
      <Text style={content.copy}>
        {inviterName} ({inviterEmail}) invited you to join {organizationName}{" "}
        on Retransmit.
      </Text>
      <Button href={url} style={content.button}>
        Accept the invitation
      </Button>
      <Hr style={content.rule} />
      <Text style={content.note}>
        The link expires in 7 days. If you were not expecting this, you can
        safely ignore this email.
      </Text>
    </EmailLayout>
  );
}

OrganizationInvitationEmail.PreviewProps = {
  url: "https://app.retransmit.dev/accept-invitation/preview",
  organizationName: "Acme",
  inviterName: "Ada Lovelace",
  inviterEmail: "ada@example.com",
};
