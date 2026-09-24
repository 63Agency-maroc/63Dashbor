"use client";

import Link from "next/link";
import { useThemeSettings } from "@/components/providers/ThemeProvider";
import { BRAND_NAME, LOGO_ON_DARK, LOGO_ON_LIGHT } from "@/lib/constants/brand";

export { BRAND_NAME, LOGO_ON_DARK as LOGO_DARK_BG, LOGO_ON_LIGHT as LOGO_LIGHT_BG } from "@/lib/constants/brand";

type LogoVariant = "auto" | "onLight" | "onDark";

type Props = {
  /** auto = suit le ThemeProvider ; onLight/onDark = forcé (ex. login) */
  variant?: LogoVariant;
  className?: string;
  /** Hauteur CSS (ex. 28, "1.75rem") */
  height?: number | string;
  /** Si fourni, enveloppe dans un Link */
  href?: string;
  alt?: string;
};

/**
 * Logo 63 Agency contrasté avec le fond :
 * - dark theme / fond sombre → whit63.png (blanc)
 * - light theme / fond clair → darck63.png (foncé)
 */
export function AgencyLogo({
  variant = "auto",
  className = "",
  height = 32,
  href,
  alt = BRAND_NAME,
}: Props) {
  const { settings } = useThemeSettings();

  const useWhiteLogo =
    variant === "onDark" || (variant === "auto" && settings.appTheme === "dark");

  const src = useWhiteLogo ? LOGO_ON_DARK : LOGO_ON_LIGHT;
  const h = typeof height === "number" ? `${height}px` : height;

  const img = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={className}
      style={{ height: h, width: "auto", maxWidth: "100%", objectFit: "contain", display: "block" }}
    />
  );

  if (href) {
    return (
      <Link href={href} aria-label={alt} className="d-inline-flex align-items-center">
        {img}
      </Link>
    );
  }

  return img;
}

/** Texte marque (sidebar panneau, etc.) */
export function BrandText({ className = "" }: { className?: string }) {
  return <span className={className}>{BRAND_NAME}</span>;
}
