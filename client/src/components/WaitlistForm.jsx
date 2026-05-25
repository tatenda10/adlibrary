function WaitlistForm() {
  return (
    <form className="mx-auto flex w-full max-w-[640px] flex-col gap-3 sm:flex-row" onSubmit={(event) => event.preventDefault()}>
      <input
        type="email"
        placeholder="Enter your email to join the waitlist..."
        className="h-14 flex-1 rounded-full border border-white/15 bg-white/5 px-6 text-base text-white placeholder:text-slate-400 focus:border-lime-400 focus:outline-none"
      />
      <button
        type="submit"
        className="h-14 rounded-full bg-lime-400 px-8 text-lg font-bold text-slate-950 shadow-[0_0_26px_rgba(163,230,53,0.45)] transition hover:bg-lime-300"
      >
        Join Waiting List
      </button>
    </form>
  );
}

export { WaitlistForm };
