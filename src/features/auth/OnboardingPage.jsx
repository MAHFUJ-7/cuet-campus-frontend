// Onboarding — port of onboarding_screen.dart (4 gradient-overlay pages).
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CuetBackground, Icon } from '../../components/ui/index.jsx';
import { KEYS, writeBool } from '../../lib/storage.js';

const PAGES = [
  {
    icon: 'school',
    title: 'Welcome to CUET AI Campus',
    description:
      'Your all-in-one academic companion for Chittagong University of Engineering & Technology.',
    color: '#1565C0',
  },
  {
    icon: 'auto_awesome',
    title: 'AI-Powered Assistant',
    description:
      'Get instant answers about your schedule, campus facilities, and study tips.',
    color: '#7B1FA2',
  },
  {
    icon: 'notifications_active',
    title: 'Real-Time Updates',
    description:
      'Never miss important announcements, room changes, or class cancellations.',
    color: '#2E7D32',
  },
  {
    icon: 'calendar_month',
    title: 'Smart Scheduling',
    description:
      'Manage your routine, track assignments, and never miss a deadline.',
    color: '#E65100',
  },
];

export default function OnboardingPage() {
  const navigate = useNavigate();
  const [index, setIndex] = useState(0);
  const isLast = index === PAGES.length - 1;

  const complete = () => {
    writeBool(KEYS.hasSeenOnboarding, true);
    navigate('/login', { replace: true });
  };

  return (
    <CuetBackground asset="/images/cuet_lake.jpg" overlayOpacity={0.9}>
      <div className="flex min-h-full flex-col">
        <div className="flex justify-end p-3">
          <button
            type="button"
            onClick={complete}
            className="rounded-lg px-3 py-2 text-label-lg font-medium text-white/90 hover:bg-white/10"
          >
            Skip
          </button>
        </div>

        <div className="relative min-h-[330px] flex-1 overflow-hidden">
          <div
            className="flex h-full transition-transform duration-300 ease-in-out"
            style={{ transform: `translateX(-${index * 100}%)` }}
          >
            {PAGES.map((page) => (
              <div key={page.title} className="flex w-full shrink-0 items-center justify-center p-10">
                <div className="max-w-md text-center">
                  <span
                    className="mx-auto flex h-28 w-28 items-center justify-center rounded-full text-white"
                    style={{ backgroundColor: 'rgba(255,255,255,0.16)' }}
                  >
                    <Icon name={page.icon} size={56} />
                  </span>
                  <h2 className="mt-10 text-headline-sm font-bold text-white">{page.title}</h2>
                  <p className="mt-4 text-body-lg text-white/85">{page.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-6">
          <div className="flex items-center justify-center gap-1">
            {PAGES.map((page, i) => (
              <button
                key={page.title}
                type="button"
                aria-label={`Page ${i + 1}`}
                onClick={() => setIndex(i)}
                className="p-1"
              >
                <span
                  className="block h-2 rounded-full bg-white transition-all duration-300"
                  style={{ width: i === index ? 24 : 8, opacity: i === index ? 1 : 0.35 }}
                />
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => (isLast ? complete() : setIndex((i) => Math.min(PAGES.length - 1, i + 1)))}
            className="mt-7 h-12 w-full rounded-xl bg-white text-title-md font-semibold text-primary transition-colors hover:bg-white/90"
          >
            {isLast ? 'Get Started' : 'Next'}
          </button>
        </div>
      </div>
    </CuetBackground>
  );
}
