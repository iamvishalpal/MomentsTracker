import { FormEvent, useEffect, useMemo, useState } from "react"
import type { Session } from "@supabase/supabase-js"
import { momentsApiUrl, supabase } from "./supabase"

type EventMode = "since" | "until"
type Filter = "all" | EventMode
type AuthView = "signin" | "signup" | "forgot"
type EntryAction = "current" | "older"

type MomentEntry = {
  id: string
  date: string
  note: string
  recordedAt: string
}

type DayEvent = {
  id: string
  title: string
  date: string
  mode: EventMode
  entries: MomentEntry[]
}

type IconProps = {
  className?: string
}

const DAY_IN_MS = 86_400_000
const STORAGE_KEY = "moments-tracker-events"
const LEGACY_STORAGE_KEY = "daymark-events"
const PAGE_SIZE = 8
const MOMENT_PALETTES = [
  "from-[#ff6b67] to-[#f43f68]",
  "from-[#ec4899] to-[#f70472]",
  "from-[#7c3aed] to-[#4f46e5]",
  "from-[#c855c7] to-[#e84a9a]",
  "from-[#0ea5a0] to-[#22c55e]",
  "from-[#f59e0b] to-[#ef4444]",
]

function toDateInput(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function shiftDate(days: number) {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() + days)
  return toDateInput(date)
}

function starterEvents(): DayEvent[] {
  return [
    {
      id: "swimming",
      title: "Started swimming",
      date: shiftDate(-20),
      mode: "since",
      entries: [],
    },
    {
      id: "birthday",
      title: "Mom’s birthday",
      date: shiftDate(21),
      mode: "until",
      entries: [],
    },
  ]
}

function normalizeEvents(value: unknown): DayEvent[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is DayEvent =>
      Boolean(
        item &&
          typeof item === "object" &&
          "id" in item &&
          "title" in item &&
          "date" in item &&
          "mode" in item,
      ),
    )
    .map((item) => ({
      ...item,
      entries: Array.isArray(item.entries) ? item.entries : [],
    }))
}

function getInitialEvents() {
  try {
    const saved =
      localStorage.getItem(STORAGE_KEY) ??
      localStorage.getItem(LEGACY_STORAGE_KEY)
    if (saved) return normalizeEvents(JSON.parse(saved))
  } catch {
    // Fall back to starter moments when browser storage is unavailable.
  }
  return starterEvents()
}

function daysFromToday(dateString: string) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const [year, month, day] = dateString.split("-").map(Number)
  return Math.round(
    (new Date(year, month - 1, day).getTime() - today.getTime()) / DAY_IN_MS,
  )
}

function formatDate(dateString: string) {
  const [year, month, day] = dateString.split("-").map(Number)
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(year, month - 1, day))
}

function getAuthRedirectUrl() {
  return new URL(import.meta.env.BASE_URL, window.location.origin).toString()
}

function CalendarIcon({ className = "" }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M7 3v3m10-3v3M4 9h16M6 5h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  )
}

function PlusIcon({ className = "" }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M12 5v14M5 12h14"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2"
      />
    </svg>
  )
}

function TrashIcon({ className = "" }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M4 7h16m-10 4v6m4-6v6M9 7l1-3h4l1 3m3 0-1 14H7L6 7"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  )
}

function CloseIcon({ className = "" }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="m6 6 12 12M18 6 6 18"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2"
      />
    </svg>
  )
}

function HistoryIcon({ className = "" }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M4 12a8 8 0 1 0 2.35-5.65L4 8.7M4 4v4.7h4.7M12 7.5V12l3 2"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  )
}

function UserIcon({ className = "" }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm7 8a7 7 0 0 0-14 0"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  )
}

function CloudIcon({ className = "" }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M7 18h10a4 4 0 0 0 .4-7.98A6 6 0 0 0 6 8.5 4.75 4.75 0 0 0 7 18Zm2.5-5.5 2 2 3.5-4"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  )
}

export default function App() {
  const [events, setEvents] = useState<DayEvent[]>(getInitialEvents)
  const [session, setSession] = useState<Session | null>(null)
  const [filter, setFilter] = useState<Filter>("all")
  const [page, setPage] = useState(1)
  const [isAdding, setIsAdding] = useState(false)
  const [deletingEvent, setDeletingEvent] = useState<DayEvent | null>(null)
  const [historyId, setHistoryId] = useState<string | null>(null)
  const [showAccountMenu, setShowAccountMenu] = useState(false)
  const [authView, setAuthView] = useState<AuthView | null>(null)
  const [title, setTitle] = useState("")
  const [mode, setMode] = useState<EventMode>("since")
  const [date, setDate] = useState(shiftDate(-1))
  const [entryAction, setEntryAction] = useState<EntryAction>("current")
  const [entryDate, setEntryDate] = useState(shiftDate(0))
  const [entryNote, setEntryNote] = useState("")
  const [authName, setAuthName] = useState("")
  const [authEmail, setAuthEmail] = useState("")
  const [authPassword, setAuthPassword] = useState("")
  const [authConfirm, setAuthConfirm] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [acceptTerms, setAcceptTerms] = useState(false)
  const [authMessage, setAuthMessage] = useState("")
  const [authBusy, setAuthBusy] = useState(false)
  const [syncState, setSyncState] = useState<"local" | "syncing" | "synced">(
    "local",
  )

  const filteredEvents = useMemo(
    () =>
      [...events]
        .filter((event) => filter === "all" || event.mode === filter)
        .sort(
          (a, b) =>
            Math.abs(daysFromToday(a.date)) - Math.abs(daysFromToday(b.date)),
        ),
    [events, filter],
  )
  const pageCount = Math.max(1, Math.ceil(filteredEvents.length / PAGE_SIZE))
  const visibleEvents = filteredEvents.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE,
  )
  const historyEvent = events.find((event) => event.id === historyId) ?? null

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      if (data.session) {
        void loadCloudEvents(data.session)
      } else {
        const defaults = starterEvents()
        setEvents(defaults)
        localStorage.setItem(STORAGE_KEY, JSON.stringify(defaults))
        setSyncState("local")
      }
    })
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      if (nextSession) {
        void loadCloudEvents(nextSession)
      } else {
        const defaults = starterEvents()
        setEvents(defaults)
        localStorage.setItem(STORAGE_KEY, JSON.stringify(defaults))
        setSyncState("local")
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    setPage(1)
  }, [filter])

  useEffect(() => {
    if (page > pageCount) setPage(pageCount)
  }, [page, pageCount])

  async function loadCloudEvents(activeSession: Session) {
    setSyncState("syncing")
    try {
      let cloudEvents: DayEvent[] = []

      // 1. Fetch user data from Supabase Auth User Metadata (works across all devices)
      const { data: userData } = await supabase.auth.getUser()
      if (userData?.user?.user_metadata?.moments) {
        cloudEvents = normalizeEvents(userData.user.user_metadata.moments)
      }

      // 2. Fallback check: Edge Function if deployed
      if (!cloudEvents.length) {
        try {
          const response = await fetch(momentsApiUrl, {
            headers: { Authorization: `Bearer ${activeSession.access_token}` },
          })
          if (response.ok) {
            const data = await response.json()
            cloudEvents = normalizeEvents(data.moments)
          }
        } catch {
          // Edge function fallback catch
        }
      }

      if (cloudEvents.length) {
        setEvents(cloudEvents)
        localStorage.setItem(STORAGE_KEY, JSON.stringify(cloudEvents))
        setSyncState("synced")
      } else {
        // First login — upload local events to cloud account
        await syncEvents(events, activeSession)
      }
    } catch {
      setSyncState("local")
    }
  }

  async function syncEvents(nextEvents: DayEvent[], activeSession = session) {
    if (!activeSession) {
      setSyncState("local")
      return
    }
    setSyncState("syncing")
    try {
      // 1. Save directly to Supabase Auth user metadata (persists globally)
      const { error: updateError } = await supabase.auth.updateUser({
        data: { moments: nextEvents },
      })
      if (updateError) throw updateError

      // 2. Also send to edge function endpoint if active
      try {
        await fetch(momentsApiUrl, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${activeSession.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ moments: nextEvents }),
        })
      } catch {
        // Ignore edge function error since user_metadata sync succeeded
      }

      setSyncState("synced")
    } catch {
      setSyncState("local")
    }
  }

  function saveEvents(nextEvents: DayEvent[]) {
    setEvents(nextEvents)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextEvents))
    void syncEvents(nextEvents)
  }

  function openComposer(nextMode: EventMode = "since") {
    setMode(nextMode)
    setTitle("")
    setDate(shiftDate(nextMode === "since" ? -1 : 1))
    setIsAdding(true)
  }

  function addEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!title.trim() || !date) return
    saveEvents([
      ...events,
      {
        id: crypto.randomUUID(),
        title: title.trim(),
        date,
        mode,
        entries: [],
      },
    ])
    setIsAdding(false)
  }

  function confirmDelete() {
    if (!deletingEvent) return
    saveEvents(events.filter((event) => event.id !== deletingEvent.id))
    setDeletingEvent(null)
  }

  function openHistory(id: string) {
    setHistoryId(id)
    setEntryAction("current")
    setEntryDate(shiftDate(0))
    setEntryNote("")
  }

  function recordEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!historyEvent || !entryDate) return

    const updated = events.map((moment) => {
      if (moment.id !== historyEvent.id) return moment
      if (entryAction === "older") {
        return {
          ...moment,
          entries: [
            ...moment.entries,
            {
              id: crypto.randomUUID(),
              date: entryDate,
              note: entryNote.trim() || "Previous entry",
              recordedAt: new Date().toISOString(),
            },
          ],
        }
      }
      return {
        ...moment,
        date: entryDate,
        entries: [
          ...moment.entries,
          {
            id: crypto.randomUUID(),
            date: moment.date,
            note: entryNote.trim() || "Previous current entry",
            recordedAt: new Date().toISOString(),
          },
        ],
      }
    })
    saveEvents(updated)
    setEntryNote("")
    setEntryDate(shiftDate(0))
  }

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setAuthMessage("")
    setAuthBusy(true)
    try {
      const cleanEmail = authEmail.trim().toLowerCase()
      if (!cleanEmail || !cleanEmail.includes("@")) {
        throw new Error("Please enter a valid email address.")
      }

      if (authView === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
          redirectTo: getAuthRedirectUrl(),
        })
        if (error) throw error
        setAuthMessage("Password reset instructions have been sent.")
      } else if (authView === "signup") {
        if (authPassword.length < 8) {
          throw new Error("Use at least 8 characters for your password.")
        }
        if (authPassword.length > 128) {
          throw new Error("Password must be 128 characters or fewer.")
        }
        if (authPassword !== authConfirm) {
          throw new Error("The passwords do not match.")
        }
        if (!acceptTerms) {
          throw new Error("Please accept the terms to create an account.")
        }
        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password: authPassword,
          options: {
            data: {
              app_name: "Moments Tracker",
              name: authName.trim().slice(0, 50),
            },
            emailRedirectTo: getAuthRedirectUrl(),
          },
        })
        if (error) throw error
        if (data.session) setAuthView(null)
        else setAuthMessage("Check your email to confirm your new account.")
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password: authPassword,
        })
        if (error) throw error
        setAuthView(null)
      }
    } catch (error) {
      setAuthMessage(
        error instanceof Error ? error.message : "Something went wrong.",
      )
    } finally {
      setAuthBusy(false)
    }
  }

  async function resendConfirmation() {
    if (!authEmail) {
      setAuthMessage("Enter your email address first.")
      return
    }
    setAuthBusy(true)
    setAuthMessage("")
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: authEmail,
      options: { emailRedirectTo: getAuthRedirectUrl() },
    })
    setAuthMessage(
      error
        ? error.message
        : "A new Moments Tracker confirmation email has been sent.",
    )
    setAuthBusy(false)
  }

  function openAuth(view: AuthView) {
    setAuthView(view)
    setAuthMessage("")
    setAuthPassword("")
    setAuthConfirm("")
    setShowPassword(false)
    setShowConfirmPassword(false)
    setShowAccountMenu(false)
  }

  const accountName =
    session?.user.user_metadata.name || session?.user.email?.split("@")[0]

  return (
    <div className="min-h-screen bg-[#f5f5f7] text-[#151729]">
      <header className="sticky top-0 z-30 border-b border-black/5 bg-[#f5f5f7]/90 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
          <div
            className="flex items-center gap-2.5"
            aria-label="Moments Tracker home"
          >
            <div className="grid size-9 place-items-center rounded-xl bg-[#151729] text-white">
              <CalendarIcon className="size-4.5" />
            </div>
            <span className="text-sm font-extrabold tracking-[-0.03em] sm:text-base">
              Moments Tracker
            </span>
          </div>
          <div className="flex items-center gap-2">
            {session && (
              <span className="hidden items-center gap-1.5 text-[0.65rem] font-bold text-[#777987] sm:flex">
                <CloudIcon className="size-4" />
                {syncState === "syncing"
                  ? "Syncing"
                  : syncState === "synced"
                    ? "Synced"
                    : "Saved locally"}
              </span>
            )}
            <button
              className="flex items-center gap-2 rounded-full bg-[#151729] px-3.5 py-2.5 text-xs font-bold text-white transition hover:bg-[#292c43] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#151729] sm:px-4"
              onClick={() => openComposer()}
              type="button"
            >
              <PlusIcon className="size-4" />
              <span className="hidden sm:inline">Add moment</span>
              <span className="sm:hidden">Add</span>
            </button>
            <div className="relative">
              <button
                aria-label={session ? "Open account menu" : "Sign in"}
                className="grid size-10 place-items-center rounded-full border border-black/10 bg-white text-[#151729] transition hover:border-black/20"
                onClick={() =>
                  session
                    ? setShowAccountMenu((current) => !current)
                    : openAuth("signin")
                }
                type="button"
              >
                {session ? (
                  <span className="text-xs font-extrabold uppercase">
                    {accountName?.slice(0, 2)}
                  </span>
                ) : (
                  <UserIcon className="size-4.5" />
                )}
              </button>
              {showAccountMenu && session && (
                <div className="absolute right-0 mt-2 w-64 rounded-2xl border border-black/10 bg-white p-2 shadow-xl">
                  <div className="border-b border-black/5 px-3 py-3">
                    <p className="truncate text-sm font-extrabold">
                      {accountName}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-[#7b8290]">
                      {session.user.email}
                    </p>
                  </div>
                  <button
                    className="mt-1 w-full rounded-xl px-3 py-2.5 text-left text-sm font-bold text-[#b43f32] hover:bg-[#f8e5df]"
                    onClick={() => {
                      const defaults = starterEvents()
                      setEvents(defaults)
                      localStorage.setItem(STORAGE_KEY, JSON.stringify(defaults))
                      setSyncState("local")
                      void supabase.auth.signOut()
                      setShowAccountMenu(false)
                    }}
                    type="button"
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-5 pb-16 pt-8 sm:px-8 sm:pt-10">
        <section className="flex items-end justify-between gap-6">
          <div>
            <p className="text-xs font-bold text-[#898b98]">Your collection</p>
            <h1 className="mt-1 text-3xl font-extrabold tracking-[-0.045em] sm:text-4xl">
              Moments
            </h1>
            <p className="mt-2 text-sm text-[#777987]">
              Keep track of the days that matter.
            </p>
          </div>
        </section>

        {!session && (
          <aside className="mt-6 flex items-center justify-between gap-4 rounded-2xl bg-white px-4 py-3 shadow-[0_1px_0_rgba(0,0,0,0.06)]">
            <div>
              <p className="text-xs font-extrabold">Save and sync your moments</p>
              <p className="mt-0.5 hidden text-xs text-[#898b98] sm:block">
                Access your history on any device.
              </p>
            </div>
            <div className="flex shrink-0 gap-1.5">
              <button
                className="rounded-xl px-3 py-2 text-xs font-extrabold text-[#555867] hover:bg-[#f2f2f5]"
                onClick={() => openAuth("signin")}
                type="button"
              >
                Sign in
              </button>
              <button
                className="rounded-xl bg-[#151729] px-3 py-2 text-xs font-extrabold text-white"
                onClick={() => openAuth("signup")}
                type="button"
              >
                Create account
              </button>
            </div>
          </aside>
        )}

        <section className="mt-7" aria-label="Your moments">
          <div className="mb-5 flex items-center justify-between gap-3">
            <p className="text-xs font-bold text-[#898b98]">
              {filteredEvents.length}{" "}
              {filteredEvents.length === 1 ? "moment" : "moments"}
            </p>
            <div className="flex rounded-full bg-[#e9e9ed] p-1">
              {(["all", "since", "until"] as const).map((item) => (
                <button
                  className={`rounded-full px-3 py-1.5 text-[0.65rem] font-extrabold capitalize transition ${
                    filter === item
                      ? "bg-white text-[#151729] shadow-sm"
                      : "text-[#777987] hover:text-[#151729]"
                  }`}
                  key={item}
                  onClick={() => setFilter(item)}
                  type="button"
                >
                  {item === "until" ? "Upcoming" : item}
                </button>
              ))}
            </div>
          </div>

          {visibleEvents.length ? (
            <>
              <div className="grid grid-cols-2 gap-x-3 gap-y-7 sm:gap-x-5 md:grid-cols-3 lg:grid-cols-4">
                {visibleEvents.map((event, index) => {
                  const days = Math.abs(daysFromToday(event.date))
                  const palette =
                    MOMENT_PALETTES[
                      ((page - 1) * PAGE_SIZE + index) %
                        MOMENT_PALETTES.length
                    ]
                  return (
                    <article
                      className="group min-w-0"
                      key={event.id}
                    >
                      <div
                        className={`relative aspect-[1.45/1] overflow-hidden rounded-2xl bg-gradient-to-br ${palette} p-4 text-white transition duration-300 group-hover:-translate-y-1 group-hover:shadow-lg sm:rounded-3xl sm:p-5`}
                      >
                        <div className="absolute -left-10 top-1/2 size-36 -translate-y-1/2 rounded-full bg-black/5 sm:size-44" />
                        <div className="relative z-10 flex items-start justify-between">
                          <span className="text-[0.55rem] font-extrabold uppercase tracking-[0.14em] text-white/75">
                            {event.mode === "since" ? "Since" : "Until"}
                          </span>
                          <div className="flex">
                            <button
                              aria-label={`View ${event.title} history`}
                              className="grid size-7 place-items-center rounded-full text-white/75 transition hover:bg-white/15 hover:text-white"
                              onClick={() => openHistory(event.id)}
                              type="button"
                            >
                              <HistoryIcon className="size-3.5" />
                            </button>
                            <button
                              aria-label={`Delete ${event.title}`}
                              className="grid size-7 place-items-center rounded-full text-white/75 transition hover:bg-white/15 hover:text-white"
                              onClick={() => setDeletingEvent(event)}
                              type="button"
                            >
                              <TrashIcon className="size-3.5" />
                            </button>
                          </div>
                        </div>
                        <button
                          className="absolute inset-x-0 bottom-0 z-0 flex h-[78%] items-end p-4 text-left sm:p-5"
                          onClick={() => openHistory(event.id)}
                          type="button"
                        >
                          <span>
                            <span className="block text-4xl font-semibold leading-none tracking-[-0.06em] sm:text-5xl">
                              {days}
                            </span>
                            <span className="mt-1 block text-xs font-semibold text-white/80">
                              {days === 1 ? "day" : "days"}
                            </span>
                          </span>
                        </button>
                      </div>

                      <div className="px-1 pt-3">
                        <div className="flex items-start justify-between gap-2">
                          <h2 className="truncate text-sm font-extrabold tracking-[-0.02em] sm:text-base">
                            {event.title}
                          </h2>
                          {event.entries.length > 0 && (
                            <span className="shrink-0 rounded-full bg-[#e7e7eb] px-1.5 py-0.5 text-[0.55rem] font-extrabold text-[#777987]">
                              {event.entries.length}
                            </span>
                          )}
                        </div>
                        <p className="mt-1 truncate text-xs text-[#9294a0]">
                          {event.mode === "since" ? "Started" : "Scheduled"} on{" "}
                          {formatDate(event.date)}
                        </p>
                      </div>
                    </article>
                  )
                })}
              </div>

              {pageCount > 1 && (
                <nav
                  className="mt-10 flex items-center justify-center gap-3"
                  aria-label="Moments pages"
                >
                  <button
                    className="rounded-full bg-white px-4 py-2 text-xs font-extrabold shadow-sm disabled:cursor-not-allowed disabled:opacity-40"
                    disabled={page === 1}
                    onClick={() => setPage((current) => current - 1)}
                    type="button"
                  >
                    Previous
                  </button>
                  <span className="text-xs font-bold text-[#898b98]">
                    {page} / {pageCount}
                  </span>
                  <button
                    className="rounded-full bg-white px-4 py-2 text-xs font-extrabold shadow-sm disabled:cursor-not-allowed disabled:opacity-40"
                    disabled={page === pageCount}
                    onClick={() => setPage((current) => current + 1)}
                    type="button"
                  >
                    Next
                  </button>
                </nav>
              )}
            </>
          ) : (
            <div className="rounded-3xl bg-white px-6 py-16 text-center">
              <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-[#ededf1] text-[#777987]">
                <CalendarIcon className="size-5" />
              </div>
              <p className="mt-4 text-sm font-extrabold">No moments yet</p>
              <p className="mt-1.5 text-xs text-[#898b98]">
                Add a date and start counting.
              </p>
              <button
                className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#151729] px-5 py-3 text-xs font-bold text-white"
                onClick={() => openComposer()}
                type="button"
              >
                <PlusIcon className="size-4" />
                Add moment
              </button>
            </div>
          )}
        </section>
      </main>

      {isAdding && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) =>
            event.target === event.currentTarget && setIsAdding(false)
          }
        >
          <div
            aria-labelledby="composer-title"
            aria-modal="true"
            className="modal-panel"
            role="dialog"
          >
            <div className="flex items-start justify-between gap-5">
              <div>
                <p className="eyebrow">New moment</p>
                <h2 className="modal-title" id="composer-title">
                  What are we counting?
                </h2>
              </div>
              <button
                aria-label="Close"
                className="icon-button"
                onClick={() => setIsAdding(false)}
                type="button"
              >
                <CloseIcon className="size-5" />
              </button>
            </div>
            <form className="mt-7 space-y-5" onSubmit={addEvent}>
              <fieldset>
                <legend className="field-label">I want to count</legend>
                <div className="segmented-control">
                  {(["since", "until"] as const).map((item) => (
                    <button
                      className={`segment ${
                        mode === item ? "segment-active" : ""
                      }`}
                      key={item}
                      onClick={() => {
                        setMode(item)
                        setDate(shiftDate(item === "since" ? -1 : 1))
                      }}
                      type="button"
                    >
                      Days {item}
                    </button>
                  ))}
                </div>
              </fieldset>
              <label className="block">
                <span className="field-label">Moment name</span>
                <input
                  autoFocus
                  className="text-field"
                  maxLength={50}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder={
                    mode === "since" ? "e.g. Last beer" : "e.g. Mom’s birthday"
                  }
                  required
                  value={title}
                />
              </label>
              <label className="block">
                <span className="field-label">Date</span>
                <input
                  className="text-field"
                  max={mode === "since" ? shiftDate(0) : undefined}
                  min={mode === "until" ? shiftDate(0) : undefined}
                  onChange={(event) => setDate(event.target.value)}
                  required
                  type="date"
                  value={date}
                />
              </label>
              <button className="primary-action" type="submit">
                <PlusIcon className="size-4" />
                Start counting
              </button>
            </form>
          </div>
        </div>
      )}

      {deletingEvent && (
        <div className="modal-backdrop">
          <div
            aria-labelledby="delete-title"
            aria-modal="true"
            className="modal-panel sm:max-w-md"
            role="alertdialog"
          >
            <div className="grid size-12 place-items-center rounded-2xl bg-[#f8d8cf] text-[#b43f32]">
              <TrashIcon className="size-5" />
            </div>
            <h2 className="modal-title mt-5" id="delete-title">
              Delete this moment?
            </h2>
            <p className="mt-3 text-sm leading-6 text-[#697180]">
              “{deletingEvent.title}” and all of its recorded history will be
              permanently removed.
            </p>
            <div className="mt-7 grid grid-cols-2 gap-3">
              <button
                className="secondary-action"
                onClick={() => setDeletingEvent(null)}
                type="button"
              >
                Keep moment
              </button>
              <button
                className="danger-action"
                onClick={confirmDelete}
                type="button"
              >
                Delete permanently
              </button>
            </div>
          </div>
        </div>
      )}

      {historyEvent && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) =>
            event.target === event.currentTarget && setHistoryId(null)
          }
        >
          <div
            aria-labelledby="history-title"
            aria-modal="true"
            className="modal-panel max-h-[90vh] overflow-y-auto sm:max-w-xl"
            role="dialog"
          >
            <div className="flex items-start justify-between gap-5">
              <div>
                <p className="eyebrow">Entry history</p>
                <h2 className="modal-title" id="history-title">
                  {historyEvent.title}
                </h2>
                <p className="mt-2 text-sm text-[#737b89]">
                  Your current date and every previous record in one place.
                </p>
              </div>
              <button
                aria-label="Close"
                className="icon-button"
                onClick={() => setHistoryId(null)}
                type="button"
              >
                <CloseIcon className="size-5" />
              </button>
            </div>

            <div className="mt-6 rounded-2xl bg-[#cfe8dc] p-4">
              <p className="text-[0.6rem] font-black uppercase tracking-[0.12em] text-[#46695a]">
                Current entry
              </p>
              <div className="mt-2 flex items-end justify-between gap-4">
                <div>
                  <p className="text-xl font-extrabold">
                    {formatDate(historyEvent.date)}
                  </p>
                  <p className="mt-1 text-xs text-[#506b60]">
                    {Math.abs(daysFromToday(historyEvent.date))} days{" "}
                    {historyEvent.mode}
                  </p>
                </div>
                <span className="text-3xl font-black text-white/70">NOW</span>
              </div>
            </div>

            <form
              className="mt-6 rounded-2xl border border-[#ded8cb] bg-[#f7f4ed] p-4"
              onSubmit={recordEntry}
            >
              <p className="text-sm font-extrabold">Record an entry</p>
              <div className="segmented-control mt-3">
                <button
                  className={`segment ${
                    entryAction === "current" ? "segment-active" : ""
                  }`}
                  onClick={() => setEntryAction("current")}
                  type="button"
                >
                  New occurrence
                </button>
                <button
                  className={`segment ${
                    entryAction === "older" ? "segment-active" : ""
                  }`}
                  onClick={() => setEntryAction("older")}
                  type="button"
                >
                  Older entry
                </button>
              </div>
              <p className="mt-2 text-xs leading-5 text-[#737b89]">
                {entryAction === "current"
                  ? "Updates the main counter and automatically archives its current date."
                  : "Adds a past record without changing your current counter."}
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label>
                  <span className="field-label">Entry date</span>
                  <input
                    className="text-field"
                    max={
                      historyEvent.mode === "since" ? shiftDate(0) : undefined
                    }
                    onChange={(event) => setEntryDate(event.target.value)}
                    required
                    type="date"
                    value={entryDate}
                  />
                </label>
                <label>
                  <span className="field-label">Note (optional)</span>
                  <input
                    className="text-field"
                    maxLength={60}
                    onChange={(event) => setEntryNote(event.target.value)}
                    placeholder="What happened?"
                    value={entryNote}
                  />
                </label>
              </div>
              <button
                className="mt-3 w-full rounded-xl bg-[#17223b] px-4 py-3 text-xs font-extrabold text-white"
                type="submit"
              >
                Save entry
              </button>
            </form>

            <div className="mt-6">
              <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-[#7b8290]">
                Previous entries · {historyEvent.entries.length}
              </p>
              {historyEvent.entries.length ? (
                <div className="mt-3 space-y-2">
                  {[...historyEvent.entries]
                    .sort((a, b) => b.date.localeCompare(a.date))
                    .map((entry) => (
                      <div
                        className="flex items-start justify-between gap-4 rounded-2xl border border-[#e3ded4] bg-white p-4"
                        key={entry.id}
                      >
                        <div>
                          <p className="text-sm font-extrabold">
                            {formatDate(entry.date)}
                          </p>
                          <p className="mt-1 text-xs text-[#7b8290]">
                            {entry.note}
                          </p>
                        </div>
                        <span className="shrink-0 rounded-full bg-[#f0ede6] px-2.5 py-1 text-[0.65rem] font-bold text-[#6f7683]">
                          {Math.abs(daysFromToday(entry.date))}d ago
                        </span>
                      </div>
                    ))}
                </div>
              ) : (
                <div className="mt-3 rounded-2xl border-2 border-dashed border-[#ded8cb] px-5 py-8 text-center text-sm text-[#7b8290]">
                  No previous entries recorded yet.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {authView && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) =>
            event.target === event.currentTarget && setAuthView(null)
          }
        >
          <div
            aria-labelledby="auth-title"
            aria-modal="true"
            className="modal-panel sm:max-w-md"
            role="dialog"
          >
            <div className="flex items-start justify-between gap-5">
              <div>
                <p className="eyebrow">Moments Tracker</p>
                <h2 className="modal-title" id="auth-title">
                  {authView === "signin"
                    ? "Welcome back"
                    : authView === "signup"
                      ? "Create your account"
                      : "Reset your password"}
                </h2>
              </div>
              <button
                aria-label="Close"
                className="icon-button"
                onClick={() => setAuthView(null)}
                type="button"
              >
                <CloseIcon className="size-5" />
              </button>
            </div>
            <p className="mt-3 text-sm leading-6 text-[#737b89]">
              {authView === "signin"
                ? "Sign in to sync your moments securely across devices."
                : authView === "signup"
                  ? "Save your counters, history, and progress in one private place."
                  : "Enter your email and we’ll send you recovery instructions."}
            </p>

            <form className="mt-6 space-y-4" onSubmit={submitAuth}>
              {authView === "signup" && (
                <label className="block">
                  <span className="field-label">Your name</span>
                  <input
                    autoComplete="name"
                    className="text-field"
                    onChange={(event) => setAuthName(event.target.value)}
                    placeholder="Alex Morgan"
                    required
                    value={authName}
                  />
                </label>
              )}
              <label className="block">
                <span className="field-label">Email address</span>
                <input
                  autoComplete="email"
                  className="text-field"
                  onChange={(event) => setAuthEmail(event.target.value)}
                  placeholder="you@example.com"
                  required
                  type="email"
                  value={authEmail}
                />
              </label>
              {authView !== "forgot" && (
                <label className="block">
                  <span className="field-label">Password</span>
                  <span className="relative block">
                    <input
                      autoComplete={
                        authView === "signup"
                          ? "new-password"
                          : "current-password"
                      }
                      className="text-field pr-16"
                      minLength={8}
                      onChange={(event) => setAuthPassword(event.target.value)}
                      placeholder="At least 8 characters"
                      required
                      type={showPassword ? "text" : "password"}
                      value={authPassword}
                    />
                    <button
                      className="absolute inset-y-0 right-0 px-4 text-xs font-extrabold text-[#596275] hover:text-[#17223b]"
                      onClick={() => setShowPassword((current) => !current)}
                      type="button"
                    >
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </span>
                </label>
              )}
              {authView === "signup" && (
                <>
                  <label className="block">
                    <span className="field-label">Confirm password</span>
                    <span className="relative block">
                      <input
                        autoComplete="new-password"
                        className="text-field pr-16"
                        minLength={8}
                        onChange={(event) => setAuthConfirm(event.target.value)}
                        placeholder="Repeat your password"
                        required
                        type={showConfirmPassword ? "text" : "password"}
                        value={authConfirm}
                      />
                      <button
                        className="absolute inset-y-0 right-0 px-4 text-xs font-extrabold text-[#596275] hover:text-[#17223b]"
                        onClick={() =>
                          setShowConfirmPassword((current) => !current)
                        }
                        type="button"
                      >
                        {showConfirmPassword ? "Hide" : "Show"}
                      </button>
                    </span>
                  </label>
                  <label className="flex items-start gap-2.5 text-xs leading-5 text-[#697180]">
                    <input
                      checked={acceptTerms}
                      className="mt-1 accent-[#17223b]"
                      onChange={(event) => setAcceptTerms(event.target.checked)}
                      type="checkbox"
                    />
                    <span>
                      I agree to the Terms of Service and Privacy Policy.
                    </span>
                  </label>
                </>
              )}
              {authMessage && (
                <p
                  className="rounded-xl bg-[#f1eee7] px-3 py-2.5 text-xs font-bold text-[#596275]"
                  role="status"
                >
                  {authMessage}
                </p>
              )}
              <button
                className="primary-action disabled:cursor-wait disabled:opacity-60"
                disabled={authBusy}
                type="submit"
              >
                {authBusy
                  ? "Please wait…"
                  : authView === "signin"
                    ? "Sign in"
                    : authView === "signup"
                      ? "Create account"
                      : "Send reset link"}
              </button>
            </form>

            <div className="mt-5 flex items-center justify-center gap-1 text-xs text-[#737b89]">
              {authView === "signin" ? (
                <>
                  <button
                    className="font-extrabold text-[#17223b]"
                    onClick={() => openAuth("forgot")}
                    type="button"
                  >
                    Forgot password?
                  </button>
                  <span>·</span>
                  <button
                    className="font-extrabold text-[#17223b]"
                    onClick={() => openAuth("signup")}
                    type="button"
                  >
                    Create account
                  </button>
                </>
              ) : (
                <>
                  <span>
                    {authView === "signup"
                      ? "Already have an account?"
                      : "Remembered your password?"}
                  </span>
                  <button
                    className="font-extrabold text-[#17223b]"
                    onClick={() => openAuth("signin")}
                    type="button"
                  >
                    Sign in
                  </button>
                </>
              )}
            </div>
            {authView === "signup" && (
              <button
                className="mx-auto mt-3 block text-xs font-extrabold text-[#596275] underline decoration-[#596275]/30 underline-offset-4"
                disabled={authBusy}
                onClick={() => void resendConfirmation()}
                type="button"
              >
                Already signed up? Resend confirmation email
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
