import Image from "next/image";

/**
 * Drop the banner at this path, then set HERO_BANNER_READY to true.
 * Later the same file can be used as the video `poster`.
 */
export const HERO_BANNER_SRC = "/landing/hero-banner.webp";
export const HERO_BANNER_READY = false;

export function LandingHeroMedia() {
  if (!HERO_BANNER_READY) {
    return (
      <div
        className="mt-8 aspect-video rounded-2xl bg-zinc-100"
        aria-hidden
      />
    );
  }

  return (
    <div className="mt-8 overflow-hidden rounded-2xl">
      <Image
        src={HERO_BANNER_SRC}
        alt="معرفی ارزیابی سلامت فروش"
        width={1280}
        height={720}
        className="aspect-video w-full object-cover"
        priority
      />
    </div>
  );
}
