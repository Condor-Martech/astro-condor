import { useState, useEffect, useCallback, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";

interface Slide {
  id: number;
  title: string;
  subtitle: string;
  cta: { label: string; href: string };
  desktop: string;
  mobile: string;
}

interface HeroCarouselProps {
  slides: Slide[];
}

const AUTOPLAY_MS = 5000;

export default function HeroCarousel({ slides }: HeroCarouselProps) {
  const [current, setCurrent] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [direction, setDirection] = useState(1);
  const progressRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const goTo = useCallback(
    (index: number) => {
      setDirection(index > current ? 1 : -1);
      setCurrent(index);
    },
    [current],
  );

  const next = useCallback(() => {
    setDirection(1);
    setCurrent((prev) => (prev + 1) % slides.length);
  }, []);

  const prev = useCallback(() => {
    setDirection(-1);
    setCurrent((prev) => (prev - 1 + slides.length) % slides.length);
  }, []);

  // Autoplay
  useEffect(() => {
    if (isPaused) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    timerRef.current = setInterval(next, AUTOPLAY_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPaused, next, current]);

  // Progress bar restart
  useEffect(() => {
    const el = progressRef.current;
    if (!el) return;
    el.style.animation = "none";
    // Force reflow
    void el.offsetHeight;
    el.style.animation = "";
  }, [current]);

  const slide = slides[current];

  return (
    <section
      className="hero-carousel"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      aria-roledescription="carousel"
      aria-label="Banner principal"
    >
      {/* Slides */}
      <AnimatePresence mode="wait" initial={false} custom={direction}>
        <motion.div
          key={slide.id}
          className="hero-slide"
          custom={direction}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.7, ease: "easeInOut" }}
          role="group"
          aria-roledescription="slide"
          aria-label={`Slide ${current + 1} de ${slides.length}`}
        >
          {/* Image with Ken Burns */}
          <picture>
            <source media="(max-width: 767px)" srcSet={slide.mobile} />
            <source media="(min-width: 768px)" srcSet={slide.desktop} />
            <motion.img
              src={slide.desktop}
              alt=""
              className="hero-image"
              initial={{ scale: 1 }}
              animate={{ scale: 1.08 }}
              transition={{ duration: AUTOPLAY_MS / 1000 + 0.7, ease: "linear" }}
              draggable={false}
            />
          </picture>

          {/* Gradient overlay */}
          <div className="hero-overlay" />

          {/* Content */}
          <div className="hero-content">
            <motion.p
              className="hero-subtitle"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.5 }}
            >
              {slide.subtitle}
            </motion.p>
            <motion.h2
              className="hero-title"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.6 }}
            >
              {slide.title}
            </motion.h2>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45, duration: 0.5 }}
            >
              <a href={slide.cta.href} className="hero-cta">
                {slide.cta.label}
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  className="hero-cta-arrow"
                >
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </a>
            </motion.div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Arrows — desktop only */}
      <button
        className="hero-arrow hero-arrow--prev"
        onClick={prev}
        aria-label="Slide anterior"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>
      <button
        className="hero-arrow hero-arrow--next"
        onClick={next}
        aria-label="Slide siguiente"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M9 18l6-6-6-6" />
        </svg>
      </button>

      {/* Dots + Progress */}
      <div className="hero-controls">
        <div className="hero-dots">
          {slides.map((s, i) => (
            <button
              key={s.id}
              className={`hero-dot ${i === current ? "hero-dot--active" : ""}`}
              onClick={() => goTo(i)}
              aria-label={`Ir al slide ${i + 1}`}
              aria-current={i === current ? "true" : undefined}
            >
              {i === current && (
                <div
                  ref={progressRef}
                  className="hero-dot-progress"
                  style={{
                    animationDuration: `${AUTOPLAY_MS}ms`,
                    animationPlayState: isPaused ? "paused" : "running",
                  }}
                />
              )}
            </button>
          ))}
        </div>

        {/* Slide counter */}
        <span className="hero-counter">
          <span className="hero-counter-current">
            {String(current + 1).padStart(2, "0")}
          </span>
          <span className="hero-counter-sep">/</span>
          <span className="hero-counter-total">
            {String(slides.length).padStart(2, "0")}
          </span>
        </span>
      </div>
    </section>
  );
}
