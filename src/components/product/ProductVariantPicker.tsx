/**
import type { ProductDetailDto } from "@/types/api/ProductDetailDto";

type Props = {
  variants: ProductDetailDto["variants"];
  currentIndex: number;
  onSelect: (index: number) => void;
};

export function ProductVariantPicker({
  variants,
  currentIndex,
  onSelect,
}: Props) {
  if (variants.length <= 1) return null;

  return (
    <div>
      <p className="font-sans text-sm font-semibold text-zinc-900 dark:text-white">
        Available Colors
      </p>

      <div className="mt-4 flex flex-wrap gap-3">
        {variants.map((variant, index) => {
          const selected = currentIndex === index;

          return (
            <button
              key={variant.id}
              type="button"
              onClick={() => onSelect(index)}
              className={`overflow-hidden rounded-xl border-2 transition-all ${
                selected
                  ? "border-orange-500 ring-2 ring-orange-500/20"
                  : "border-zinc-200 hover:border-zinc-400"
              }`}
            >
              <img
                src={variant.images[0]?.image_url}
                alt={variant.color}
                className="h-20 w-16 object-cover"
              />

              <div className="px-2 py-1 text-xs font-medium">
                {variant.color}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}*/


import type { ProductDetailDto } from "@/types/api/ProductDetailDto";

type Props = {
  variants: ProductDetailDto["variants"];
  currentIndex: number;
  onSelect: (index: number) => void;
};

function safeImage(url: string) {
  return url.includes("cdn.yourbrand.com")
    ? "/images/no-image.png"
    : url;
}

export function ProductVariantPicker({
  variants,
  currentIndex,
  onSelect,
}: Props) {
  if (variants.length <= 1) return null;

  return (
    <div>
      <p className="font-sans text-sm font-semibold text-zinc-900 dark:text-white">
        Available Colors
      </p>

      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
        Select your preferred color.
      </p>

      <div className="mt-4 flex flex-wrap gap-3">
        {variants.map((variant, index) => {
          const selected = currentIndex === index;

          return (
            <button
              key={variant.id}
              type="button"
              onClick={() => onSelect(index)}
              className={`overflow-hidden rounded-xl border-2 bg-white transition-all duration-200 dark:bg-zinc-900 ${
                selected
                  ? "border-orange-500 shadow-md ring-2 ring-orange-500/20"
                  : "border-zinc-200 hover:border-zinc-400 dark:border-zinc-700"
              }`}
            >
              <div className="aspect-[4/5] w-20 overflow-hidden bg-zinc-100 dark:bg-zinc-800">
                <img
                  src={safeImage(variant.images[0]?.image_url ?? "")}
                  alt={variant.color}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              </div>

              <div
                className={`px-2 py-2 text-center text-xs font-semibold ${
                  selected
                    ? "text-orange-600 dark:text-orange-400"
                    : "text-zinc-700 dark:text-zinc-300"
                }`}
              >
                {variant.color}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}