import { SectionShell } from "./SectionShell";

/**
 * The video section: a video with an optional poster image and the autoplay,
 * muted and loop flags.
 *
 * `muted` defaults to true, so an autoplaying video is not blocked by the
 * browser's autoplay policy.
 */
export default function VideoSection({ video_url, poster_url, autoplay, muted, loop, style }) {
  return (
    <SectionShell style={style} className="section-video">
      {/* The video section stores no captions track, so there is none to offer. */}
      {/* oxlint-disable-next-line jsx-a11y/media-has-caption */}
      <video
        className="section-video__player"
        src={video_url}
        poster={poster_url || undefined}
        controls
        playsInline
        muted={muted !== false}
        autoPlay={autoplay === true}
        loop={loop === true}
      />
    </SectionShell>
  );
}
