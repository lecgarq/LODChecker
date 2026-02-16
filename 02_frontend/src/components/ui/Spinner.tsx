/** Full-screen loading spinner. */
export default function Spinner() {
  return (
    <div className="w-screen h-screen flex items-center justify-center flex-col gap-4 bg-bg">
      <div className="w-5 h-5 border-2 border-secondary border-t-primary rounded-full animate-spin" />
      <span className="text-[13px] font-medium text-primary tracking-wide opacity-60">
        Loading graph data...
      </span>
    </div>
  );
}
