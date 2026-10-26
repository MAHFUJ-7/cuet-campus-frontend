// Lightweight fallback shown while a lazily-loaded route chunk is fetched.
import { Spinner } from './ui/index.jsx';

export default function PageFallback() {
  return (
    <div
      className="flex min-h-[50vh] w-full flex-1 items-center justify-center p-8"
      role="status"
      aria-label="Loading page"
    >
      <Spinner size={28} className="text-primary dark:text-primary-light" />
    </div>
  );
}
