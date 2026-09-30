import { AspectRatio } from "@multi-tenant-ai-catalog/ui/components/aspect-ratio";
import { cn } from "@multi-tenant-ai-catalog/ui/lib/utils";
import { ImageOff } from "lucide-react";
import { useState } from "react";

/**
 * Fixed 4:3 frame, so cards line up whatever the image size. Falls back to a placeholder
 * when there is no URL or it fails to load (404, hotlink blocked, not an image).
 */
export function ProductImage({
  src,
  alt,
  className,
}: {
  src: string | null;
  alt: string;
  className?: string;
}) {
  // Remember which URL failed rather than a boolean: when `src` changes (live preview in
  // the form, or an edit) the new URL gets its own attempt without a reset effect.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showImage = src !== null && src !== "" && src !== failedSrc;

  return (
    <AspectRatio ratio={4 / 3} className={cn("overflow-hidden bg-muted", className)}>
      {showImage ? (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          className="size-full object-cover"
          onError={() => setFailedSrc(src)}
        />
      ) : (
        <div className="flex size-full items-center justify-center text-muted-foreground">
          <ImageOff className="size-8" aria-hidden />
          <span className="sr-only">Sem imagem</span>
        </div>
      )}
    </AspectRatio>
  );
}
