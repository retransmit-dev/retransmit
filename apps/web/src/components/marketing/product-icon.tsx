import {
  Mail,
  MessageCircle,
  MessageSquareText,
  Send,
  Radio,
  type LucideProps,
} from "lucide-react";

const icons = {
  email: Mail,
  sms: MessageSquareText,
  whatsapp: MessageCircle,
  telegram: Send,
};

export function ProductIcon({
  slug,
  ...props
}: LucideProps & { slug: string }) {
  const Icon = icons[slug as keyof typeof icons] ?? Radio;
  return <Icon {...props} />;
}
