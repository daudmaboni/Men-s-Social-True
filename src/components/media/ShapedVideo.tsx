"use client";

// Step 92: a video player that takes the video's own shape.
// 16:9 shows wide and full width. 9:16 shows upright, centred, never taller than `maxHeight`.
// Nothing is cut off and nothing is stretched: the box is made the video's shape, so there are no black bars
// once the video has loaded once (the shape is remembered on the phone, see lib/media/videoShape.ts).

import { forwardRef } from "react";
import { WIDE, useVideoShape } from "@/lib/media/videoShape";

type Props = React.VideoHTMLAttributes<HTMLVideoElement> & {
  src: string | undefined;
  /** The shape to use until the video has loaded once. */
  fallback?: number;
  /** The tallest it may be, as CSS (default: most of the screen). */
  maxHeight?: string;
};

const ShapedVideo = forwardRef<HTMLVideoElement, Props>(function ShapedVideo(
  { src, fallback = WIDE, maxHeight = "78dvh", className = "", style, onLoadedMetadata, ...rest },
  ref,
) {
  const shape = useVideoShape(src, fallback);
  return (
    <video
      ref={ref}
      src={src}
      {...rest}
      onLoadedMetadata={(e) => {
        shape.measure(e);
        onLoadedMetadata?.(e);
      }}
      style={{
        aspectRatio: shape.ratio,
        // As wide as it can be without getting taller than maxHeight
        width: `min(100%, calc(${maxHeight} * ${shape.ratio}))`,
        ...style,
      }}
      className={`mx-auto block h-auto bg-black object-contain ${className}`}
    />
  );
});

export default ShapedVideo;
