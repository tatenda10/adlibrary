import { useEffect, useState } from 'react';

const imagePool = [
  'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1506368249639-73a05d6f6488?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1551650975-87deedd944c3?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1542744095-291d1f67b221?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1516321497487-e288fb19713f?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1517842645767-c639042777db?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1512428559087-560fa5ceab42?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1596461404969-9ae70f2830c1?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1452860606245-08befc0ff44b?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1526948128573-703ee1aeb6fa?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1529333166437-7750a6dd5a70?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1495020689067-958852a7765e?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1546182990-dffeafbe841d?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1475721027785-f74eccf877e2?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1590602847861-f357a9332bbc?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=900&q=80',
];

const contentFormats = [
  ['Slideshow', 'Multi-image carousel with captions'],
  ['Wall of Text', 'Bold text on a plain background'],
  ['Cutting Fruit', 'Your text over a generated kitchen clip'],
  ['On a Walk', 'Your text over a generated walking selfie'],
  ['Netflix Documentary', 'Your text over a generated interview clip'],
  ['Video Hook & Demo', 'Hook clip + app demo stitched together'],
  ['Speaking Hook & Demo', 'Someone says the hook out loud, then your demo'],
  ['Talking Head UGC', 'AI avatar speaks a script to camera'],
  ['Green Screen Meme', 'Trending video with your background image'],
  ['Talking Head Green Screen', 'AI avatar composited into the corner of a demo video'],
  ['Notes Green Screen', 'A presenter with a mic talks over an iOS Notes list'],
  ['Product Spokesperson', 'A character holds your product and talks about it'],
  ['Unboxing', 'A creator opens the box and talks through the reveal'],
  ['Green Screen Mobile with App', 'A presenter holding a phone with your app on screen'],
  ['Claymation', 'Stop-motion clay ad with narration and captions'],
  ['Lego', 'Stop-motion Lego brick ad with narration and captions'],
  ['Barbie', 'Stop-motion fashion-doll ad with narration and captions'],
  ['Paper Cutout', 'Stop-motion paper cutout ad with narration and captions'],
  ['Talking Objects', 'A niche object talks straight at the viewer to drive the point home'],
  ['Felt', 'Stop-motion felt ad with narration and captions'],
  ['Skeleton', 'Educational skeleton video with narration and captions'],
  ['Studio Ghibli', 'Hand-painted anime short with a storyteller narrating'],
  ['Comic', 'Comic-book style video with narration and captions'],
  ['Baby Podcast', 'Two babies hosting a podcast, deadpan, about your product'],
  ['Street Interview', 'Impromptu street vox-pop that looks like unedited iPhone footage'],
  ['Zack D Films', 'Multi-cut Zack D Films-style 3D animation that explains an idea through a metaphor or story'],
  ['AI News Anchor', "A news anchor breaks your customer's problem as tonight's top story"],
  ['Talking Animals', 'An animal living an ordinary human day talks straight to camera'],
  ['Ted Talk', 'An expert on a conference stage delivering one idea to a room'],
  ['Podcast', 'Two-host podcast video with dialogue and captions'],
  ['Character Swap', 'Swap the character in a video using AI'],
  ['Custom', 'Upload your own video or image'],
];

const trendingSlides = [
  {
    title: 'Weird manager rules that made my team top performers',
    subtitle: 'Your team will remember this one',
    image: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=900&q=80',
    likes: '10.1K',
    views: '223.1K',
    tag: 'B2B App',
  },
  {
    title: '5 ways to become mentally strong before Monday',
    subtitle: 'Simple listicle structure with a strong hook',
    image: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=900&q=80',
    likes: '18.4K',
    views: '411.8K',
    tag: 'B2C App',
  },
  {
    title: 'The tiny habit that made our launch unforgettable',
    subtitle: 'Story-led emotional proof with a product payoff',
    image: 'https://images.unsplash.com/photo-1527529482837-4698179dc6ce?auto=format&fit=crop&w=900&q=80',
    likes: '7.8K',
    views: '79.3K',
    tag: 'SaaS',
  },
];

function assetUrl(path) {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
  return `${apiUrl}${path}`;
}

function ContentCard({ title, description, image, isCustom, onSelect }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="group overflow-hidden rounded-xl border border-slate-200 bg-white text-left transition hover:-translate-y-0.5 hover:border-emerald-300"
    >
      <div className="aspect-[4/3] overflow-hidden bg-slate-100">
        {isCustom ? (
          <div className="flex h-full w-full items-center justify-center bg-emerald-50">
            <svg
              aria-hidden="true"
              className="h-12 w-12 text-emerald-600"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
            </svg>
          </div>
        ) : (
          <img
            src={assetUrl(image)}
            alt={title}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
            loading="lazy"
          />
        )}
      </div>
      <div className="min-h-[86px] border-t border-slate-100 bg-white px-4 py-3">
        <h2 className="text-[15px] font-semibold leading-5 text-slate-950">{title}</h2>
        <p className="mt-1 line-clamp-2 text-sm leading-5 text-slate-500">{description}</p>
      </div>
    </button>
  );
}

function RemixWorkspace({ format }) {
  const [mode, setMode] = useState('remix');
  const [mentionBusiness, setMentionBusiness] = useState(true);
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCurrentSlide((value) => (value + 1) % trendingSlides.length);
    }, 4500);
    return () => window.clearInterval(timer);
  }, []);

  const previousSlide = () => {
    setCurrentSlide((value) => (value - 1 + trendingSlides.length) % trendingSlides.length);
  };

  const nextSlide = () => {
    setCurrentSlide((value) => (value + 1) % trendingSlides.length);
  };

  const slidePosition = (index) => {
    const offset = (index - currentSlide + trendingSlides.length) % trendingSlides.length;
    if (offset === 0) return 'z-30 translate-x-0 scale-100 opacity-100 blur-0';
    if (offset === 1) return 'z-20 translate-x-[74%] scale-90 opacity-45 blur-sm';
    return 'z-20 -translate-x-[74%] scale-90 opacity-45 blur-sm';
  };

  return (
    <section className="h-[calc(100vh-64px)] overflow-hidden bg-white px-8 py-3 text-slate-950">
      <div className="grid h-full gap-8 xl:grid-cols-[430px_minmax(0,1fr)]">
        <aside>
          <h1 className="mb-3 text-base font-semibold">Configuration</h1>

          <div className="space-y-2.5">
            <div className="rounded-md bg-white px-4 py-3">
              <h2 className="mb-3 text-sm font-semibold">Mode</h2>
              <div className="grid grid-cols-2 gap-2">
                {[
                  ['create', 'Create New'],
                  ['remix', 'Remix'],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setMode(value)}
                    className={`rounded-md border px-4 py-2.5 text-sm font-semibold transition ${
                      mode === value
                        ? 'border-emerald-500 bg-emerald-500 text-white'
                        : 'border-slate-200 bg-white text-slate-900'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-md bg-white px-4 py-3">
              <h2 className="mb-3 text-sm font-semibold">Mention your business?</h2>
              <div className="grid grid-cols-2 gap-2">
                {[true, false].map((option) => (
                  <button
                    key={String(option)}
                    type="button"
                    onClick={() => setMentionBusiness(option)}
                    className={`rounded-md border px-4 py-2.5 text-sm font-semibold transition ${
                      mentionBusiness === option
                        ? 'border-emerald-500 bg-emerald-500 text-white'
                        : 'border-slate-200 bg-white text-slate-900'
                    }`}
                  >
                    {option ? 'Yes' : 'No'}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 rounded-md bg-white px-4 py-3">
              <div>
                <h2 className="text-sm font-semibold">Trending {format.title.toLowerCase()}</h2>
                <p className="mt-1 text-xs text-slate-500">Use a proven structure as your starting point.</p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <img src={assetUrl(format.image)} alt="" className="h-10 w-10 rounded-md object-cover" />
                <button type="button" className="rounded-md border border-slate-200 px-3 py-2 text-xs font-semibold">
                  Change
                </button>
              </div>
            </div>

            <div className="rounded-md bg-white px-4 py-3">
              <label htmlFor="content-prompt" className="text-sm font-semibold">
                Prompt <span className="font-normal text-slate-500">(Optional)</span>
              </label>
              <textarea
                id="content-prompt"
                className="mt-3 h-20 w-full resize-none rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:bg-white"
                placeholder={`What should this ${format.title.toLowerCase()} be about?`}
              />
            </div>

            <button
              type="button"
              className="w-full rounded-md bg-emerald-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-600"
            >
              Generate
            </button>
          </div>
        </aside>

        <main className="flex h-full flex-col overflow-hidden bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
            <div className="flex items-center gap-2">
              <button type="button" className="rounded-md bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">
                Trending Content
              </button>
              <button type="button" className="rounded-md px-4 py-2 text-sm font-semibold text-slate-500">
                Preview
              </button>
            </div>
            <button type="button" className="rounded-md border border-slate-200 px-4 py-2 text-sm text-slate-500">
              Media
            </button>
          </div>

          <div className="relative flex flex-1 items-center justify-center overflow-hidden px-4 py-3">
            {trendingSlides.map((slide, index) => (
              <div
                key={slide.title}
                className={`absolute top-5 w-[235px] overflow-hidden rounded-2xl bg-slate-950 transition-all duration-500 xl:w-[270px] 2xl:w-[295px] ${slidePosition(index)}`}
              >
                <div className="absolute left-1/2 top-3 z-20 -translate-x-1/2">
                  <span className="rounded-md border border-emerald-300 bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
                    {slide.tag}
                  </span>
                </div>
                <div className="relative aspect-[9/16]">
                  <img src={slide.image} alt={slide.title} className="h-full w-full object-cover opacity-80" />
                  <div className="absolute inset-0 bg-gradient-to-b from-black/5 via-transparent to-black/45" />
                  <button
                    type="button"
                    onClick={previousSlide}
                    className="absolute left-4 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-black/50 text-xl text-white"
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    onClick={nextSlide}
                    className="absolute right-4 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-black/50 text-xl text-white"
                  >
                    ›
                  </button>
                  <div className="absolute left-8 right-8 top-[30%] text-center">
                    <h3 className="inline rounded-md bg-white px-3 py-1 text-lg font-black leading-tight text-black box-decoration-clone">
                      {slide.title}
                    </h3>
                    <p className="mx-auto mt-16 max-w-[190px] text-xs font-bold leading-tight text-white drop-shadow">
                      {slide.subtitle}
                    </p>
                  </div>
                  <div className="absolute bottom-7 left-1/2 z-20 -translate-x-1/2">
                    <button
                      type="button"
                      className="whitespace-nowrap rounded-full bg-emerald-500 px-6 py-2.5 text-sm font-bold text-white ring-4 ring-white/25 transition hover:bg-emerald-400"
                    >
                      Remix this
                    </button>
                  </div>
                  <div className="absolute bottom-20 right-5 space-y-5 text-center text-white">
                    <div>
                      <div className="text-2xl">♡</div>
                      <div className="text-xs font-bold">{slide.likes}</div>
                    </div>
                    <div>
                      <div className="text-xl">◉</div>
                      <div className="text-xs font-bold">{slide.views}</div>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            <div className="absolute bottom-3 left-1/2 z-40 flex -translate-x-1/2 gap-2 rounded-full bg-slate-950/80 px-3 py-2">
              {trendingSlides.map((slide, index) => (
                <button
                  key={slide.title}
                  type="button"
                  onClick={() => setCurrentSlide(index)}
                  className={`h-2 rounded-full transition-all ${
                    currentSlide === index ? 'w-7 bg-white' : 'w-2 bg-white/40'
                  }`}
                  aria-label={`Show slide ${index + 1}`}
                />
              ))}
            </div>
          </div>
        </main>
      </div>
    </section>
  );
}

function Content() {
  const [selectedFormat, setSelectedFormat] = useState(null);

  if (selectedFormat) {
    return <RemixWorkspace format={selectedFormat} />;
  }

  return (
    <section className="min-h-full bg-white text-slate-950">
      <div className="px-6 py-7">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">Create new content</h1>
          <p className="mt-1 text-sm text-slate-500">Pick a format to get started. You can switch anytime.</p>
        </header>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {contentFormats.map(([title, description], index) => (
            <ContentCard
              key={title}
              title={title}
              description={description}
              image={imagePool[index % imagePool.length]}
              isCustom={title === 'Custom'}
              onSelect={() =>
                setSelectedFormat({
                  title,
                  description,
                  image: imagePool[index % imagePool.length],
                })
              }
            />
          ))}
        </div>
      </div>
    </section>
  );
}

export default Content;
