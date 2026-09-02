import { OG_SIZE, renderOgImage } from "@/lib/og";
import { siteConfig } from "@/lib/site";

export const alt = `${siteConfig.name}, ${siteConfig.tagline.toLowerCase()}`;
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return renderOgImage({
    title: "Email, anywhere.",
    description:
      "Send transactional email from our cloud or yours. Batch up to 10,000, signed webhooks, self-hostable.",
  });
}
