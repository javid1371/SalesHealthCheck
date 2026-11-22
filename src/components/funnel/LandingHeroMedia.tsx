export const HERO_VIDEO_SRC = "/landing/hero.mp4";
export const HERO_POSTER_SRC = "/landing/hero-poster.webp";

export function LandingHeroMedia() {
  return (
    <div className="mt-8 overflow-hidden rounded-2xl bg-zinc-950">
      <video
        className="aspect-video w-full bg-zinc-950 object-cover"
        controls
        playsInline
        preload="metadata"
        poster={HERO_POSTER_SRC}
        aria-label="ویدیوی معرفی ارزیابی سلامت فروش"
      >
        <source src={HERO_VIDEO_SRC} type="video/mp4" />
      </video>
    </div>
  );
}
