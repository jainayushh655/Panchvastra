import { Link } from 'react-router-dom'

/**
 * A campaign-style Custom Piece feature for the homepage. It uses only the existing
 * PANCHVASTRA garment artwork and links to the existing /custom-piece builder.
 */
export function CustomPieceBanner() {
  return (
    <section className="px-3 py-5 sm:px-5 sm:py-7 lg:px-8 lg:py-9">
      <Link
        to="/custom-piece"
        aria-label="Create your own PANCHVASTRA piece"
        className="group relative mx-auto block min-h-[620px] max-w-[1600px] overflow-hidden bg-[#efebe2] text-[#171717] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-black sm:min-h-[660px] lg:min-h-[600px]"
      >
        {/* Warm editorial paper field */}
        <div
          className="absolute inset-0"
          aria-hidden="true"
          style={{
            backgroundImage:
              'radial-gradient(circle at 72% 34%, rgba(233,78,68,.16), transparent 23%), linear-gradient(115deg, #f6f2e9 0%, #e8e1d4 100%)',
          }}
        />

        {/* Ultra-light oversized type carries the campaign without a generic banner feel. */}
        <div
          className="pointer-events-none absolute bottom-[-5%] left-[-2%] whitespace-nowrap font-display text-[150px] font-black uppercase leading-none tracking-[-0.09em] text-black/[0.035] sm:text-[240px] lg:text-[300px]"
          aria-hidden="true"
        >
          NOT OFF THE RACK
        </div>

        <div className="relative grid min-h-[620px] grid-cols-1 lg:min-h-[600px] lg:grid-cols-[46%_54%]">
          {/* Editorial copy */}
          <div className="relative z-10 flex flex-col px-6 pb-0 pt-8 sm:px-10 sm:pt-10 lg:px-14 lg:py-12 xl:px-16">
            <div className="flex items-center gap-3">
              <span className="h-px w-9 bg-[#171717]" aria-hidden="true" />
              <p className="text-[10px] font-black uppercase tracking-[0.34em] sm:text-xs">
                Panchvastra / Custom Studio
              </p>
            </div>

            <div className="mt-8 sm:mt-10 lg:mt-12">
              <h2 className="font-display text-[58px] font-black uppercase leading-[0.82] tracking-[-0.07em] sm:text-[82px] lg:text-[92px] xl:text-[112px]">
                Your Style.
                <span className="relative mt-2 block text-[#e34c43]">
                  No Rules.
                  <svg
                    className="absolute -bottom-3 left-0 w-[68%] text-[#e34c43] sm:-bottom-4"
                    viewBox="0 0 420 18"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path d="M3 12C92 2 231 19 417 5" stroke="currentColor" strokeWidth="7" strokeLinecap="round" />
                  </svg>
                </span>
              </h2>

              <p className="mt-8 max-w-[430px] text-sm font-semibold leading-6 text-black/65 sm:text-base lg:mt-10">
                A piece that starts with a silhouette—and ends with your signature.
              </p>
            </div>

            {/* CTA stays at the bottom of the copy block on every screen. */}
            <div className="mt-8 flex items-center gap-4 lg:mt-auto lg:pb-2">
              <span className="inline-flex items-center gap-6 bg-[#171717] px-6 py-4 text-xs font-black uppercase tracking-[0.18em] text-white transition-all duration-300 group-hover:bg-[#e34c43] sm:px-8 sm:py-5 sm:text-sm">
                Create Your Own
                <span className="text-xl leading-none transition-transform duration-300 group-hover:translate-x-2" aria-hidden="true">
                  ↗
                </span>
              </span>
              <span className="hidden text-[9px] font-black uppercase leading-4 tracking-[0.22em] text-black/45 sm:block">
                01 / Build
                <br />02 / Wear
              </span>
            </div>
          </div>

          {/* Garment stage: one bold hero object instead of a crowded collage. */}
          <div className="relative mt-[-20px] min-h-[250px] overflow-hidden lg:mt-0 lg:min-h-full">
            <div
              className="absolute right-[15%] top-[11%] h-[52px] w-[52px] rounded-full border border-black/20 sm:h-[72px] sm:w-[72px] lg:right-[12%] lg:top-[15%]"
              aria-hidden="true"
            />
            <div
              className="absolute right-[calc(15%+18px)] top-[calc(11%+18px)] h-[16px] w-[16px] rounded-full bg-[#e34c43] sm:right-[calc(15%+27px)] sm:top-[calc(11%+27px)] lg:right-[calc(12%+27px)] lg:top-[calc(15%+27px)]"
              aria-hidden="true"
            />

            <p
              className="absolute right-[9%] top-[31%] hidden rotate-90 text-[9px] font-black uppercase tracking-[0.32em] text-black/35 lg:block"
              aria-hidden="true"
            >
              Designed in motion
            </p>

            <img
              src="/images/feature-tshirt.png"
              alt=""
              aria-hidden="true"
              width={512}
              height={512}
              loading="lazy"
              decoding="async"
              className="absolute bottom-[-72px] left-1/2 h-[420px] w-[420px] -translate-x-1/2 object-contain drop-shadow-[0_32px_28px_rgba(31,25,18,.24)] transition-all duration-700 group-hover:-translate-y-3 group-hover:scale-[1.045] sm:h-[500px] sm:w-[500px] lg:-bottom-10 lg:left-[54%] lg:h-[620px] lg:w-[620px] xl:h-[680px] xl:w-[680px]"
            />

            {/* Small product/spec label makes the composition feel designed, not decorative. */}
            <div className="absolute bottom-5 left-5 z-[3] border-l-2 border-[#e34c43] bg-[#f6f2e9]/90 px-4 py-3 backdrop-blur-sm sm:left-8 lg:bottom-8 lg:left-12">
              <p className="text-[9px] font-black uppercase tracking-[0.26em] text-black/45">Your edition</p>
              <p className="mt-1 font-display text-sm font-black uppercase sm:text-base">One / One</p>
            </div>
          </div>
        </div>
      </Link>
    </section>
  )
}
