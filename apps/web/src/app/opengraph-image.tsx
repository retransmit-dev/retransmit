import { OG_SIZE, renderOgImage } from "@/lib/og";
import { siteConfig } from "@/lib/site";

export const alt = `${siteConfig.name}, ${siteConfig.tagline.toLowerCase()}`;
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return renderOgImage({
    title: "One API. Every message.",
    description:
      "Transactional email and SMS from one API and one prepaid balance. Signed webhooks, self-hostable. WhatsApp next.",
  });
}
