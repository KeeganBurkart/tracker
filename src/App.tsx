import { useEffect, useMemo, useState } from 'react'
import './App.css'

type PlanEntry = {
  duration: number
  note?: string
}

type PlanMap = Record<string, PlanEntry>

type CalendarCell = {
  date: Date
  isCurrentMonth: boolean
}

const PLAN_STORAGE_KEY = 'meditation-plan-text'
const COMPLETION_STORAGE_KEY = 'meditation-completions'

const DEFAULT_START_DURATION = 10
const TARGET_DURATION = 60
const DEFAULT_RAMP_DAYS = 30

const SAMPLE_PLAN = `date,duration,note
2024-01-01,15,"Ease in"
2024-01-08,25,
2024-01-15,35,
2024-01-22,45,
2024-01-29,60,"Target reached"`

const formatKey = (date: Date) => {
  const copy = new Date(date)
  copy.setHours(0, 0, 0, 0)
  return copy.toISOString().split('T')[0]
}

const getMonthLabel = (date: Date) =>
  date.toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  })

const formatDisplayDate = (date: Date) =>
  date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

const differenceInDays = (a: Date, b: Date) => {
  const msPerDay = 1000 * 60 * 60 * 24
  const start = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())
  const end = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate())
  return Math.round((start - end) / msPerDay)
}

const getDefaultDuration = (date: Date) => {
  const monthStart = new Date(date.getFullYear(), date.getMonth(), 1)
  const dayIndex = Math.max(0, differenceInDays(date, monthStart))
  if (DEFAULT_RAMP_DAYS <= 1) {
    return TARGET_DURATION
  }
  const dailyIncrease = (TARGET_DURATION - DEFAULT_START_DURATION) / (DEFAULT_RAMP_DAYS - 1)
  const projected = DEFAULT_START_DURATION + dayIndex * dailyIncrease
  const rounded = Math.round(projected / 5) * 5
  return Math.max(DEFAULT_START_DURATION, Math.min(TARGET_DURATION, rounded))
}

const parsePlan = (raw: string) => {
  const map: PlanMap = {}
  const errors: string[] = []

  if (!raw.trim()) {
    return { map, errors }
  }

  const splitCsvLine = (line: string) => {
    const cells: string[] = []
    let current = ''
    let inQuotes = false

    for (let index = 0; index < line.length; index += 1) {
      const char = line[index]
      if (char === '"') {
        if (inQuotes && line[index + 1] === '"') {
          current += '"'
          index += 1
        } else {
          inQuotes = !inQuotes
        }
      } else if (char === ',' && !inQuotes) {
        cells.push(current.trim())
        current = ''
      } else {
        current += char
      }
    }

    cells.push(current.trim())
    return { cells, inQuotes }
  }

  const rows = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  rows.forEach((line, index) => {
    const { cells, inQuotes } = splitCsvLine(line)
    if (inQuotes) {
      errors.push(`Line ${index + 1}: missing closing quote.`)
      return
    }

    const normalizedCells = cells.map((cell) => cell.replace(/^"|"$/g, '').trim())

    const isHeader = index === 0 &&
      normalizedCells.some((cell) => /date/i.test(cell)) &&
      normalizedCells.some((cell) => /duration/i.test(cell))
    if (isHeader) {
      return
    }

    if (normalizedCells.length < 2) {
      errors.push(`Line ${index + 1}: expected at least two columns (date,duration).`)
      return
    }

    const [dateValue, durationValue, noteValue] = normalizedCells

    const parsedDate = new Date(dateValue)
    if (Number.isNaN(parsedDate.getTime())) {
      errors.push(`Line ${index + 1}: could not understand date "${dateValue}".`)
      return
    }

    const parsedDuration = Number.parseFloat(durationValue)
    if (!Number.isFinite(parsedDuration) || parsedDuration <= 0) {
      errors.push(`Line ${index + 1}: duration should be a positive number.`)
      return
    }

    const key = formatKey(parsedDate)
    map[key] = { duration: Math.round(parsedDuration), note: noteValue?.length ? noteValue : undefined }
  })

  return { map, errors }
}

const buildCalendar = (reference: Date): CalendarCell[] => {
  const startOfMonth = new Date(reference.getFullYear(), reference.getMonth(), 1)
  const endOfMonth = new Date(reference.getFullYear(), reference.getMonth() + 1, 0)

  const leadingEmptyDays = startOfMonth.getDay() // 0 (Sun) - 6 (Sat)
  const totalDays = endOfMonth.getDate()
  const totalCells = Math.ceil((leadingEmptyDays + totalDays) / 7) * 7

  return Array.from({ length: totalCells }, (_, index) => {
    const dayOffset = index - leadingEmptyDays
    const date = new Date(reference.getFullYear(), reference.getMonth(), dayOffset + 1)
    return {
      date,
      isCurrentMonth: date.getMonth() === reference.getMonth(),
    }
  })
}

function App() {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const [draftPlanText, setDraftPlanText] = useState('')
  const [plan, setPlan] = useState<PlanMap>({})
  const [planErrors, setPlanErrors] = useState<string[]>([])
  const [completions, setCompletions] = useState<Record<string, boolean>>({})

  useEffect(() => {
    const storedPlan = localStorage.getItem(PLAN_STORAGE_KEY)
    if (storedPlan) {
      setDraftPlanText(storedPlan)
      const { map, errors } = parsePlan(storedPlan)
      setPlan(map)
      setPlanErrors(errors)
    } else {
      setDraftPlanText(SAMPLE_PLAN)
    }

    const storedCompletions = localStorage.getItem(COMPLETION_STORAGE_KEY)
    if (storedCompletions) {
      try {
        const parsed = JSON.parse(storedCompletions) as Record<string, boolean>
        setCompletions(parsed)
      } catch (error) {
        console.warn('Unable to restore completion data:', error)
      }
    }
  }, [])

  useEffect(() => {
    localStorage.setItem(COMPLETION_STORAGE_KEY, JSON.stringify(completions))
  }, [completions])

  const calendar = useMemo(() => buildCalendar(currentMonth), [currentMonth])

  const { monthDays, completedCount } = useMemo(() => {
    const days = calendar.filter((cell) => cell.isCurrentMonth)
    const completed = days.filter((cell) => completions[formatKey(cell.date)]).length
    return { monthDays: days.map((cell) => cell.date), completedCount: completed }
  }, [calendar, completions])

  const planEntryList = useMemo(() => {
    return Object.entries(plan)
      .map(([key, entry]) => ({
        key,
        date: new Date(key),
        entry,
      }))
      .sort((a, b) => a.date.getTime() - b.date.getTime())
  }, [plan])

  const handleToggleDay = (date: Date) => {
    const key = formatKey(date)
    setCompletions((prev) => ({
      ...prev,
      [key]: !prev[key],
    }))
  }

  const handleApplyPlan = () => {
    const { map, errors } = parsePlan(draftPlanText)
    setPlan(map)
    setPlanErrors(errors)
    localStorage.setItem(PLAN_STORAGE_KEY, draftPlanText)
  }

  const handleResetPlan = () => {
    localStorage.removeItem(PLAN_STORAGE_KEY)
    const { map, errors } = parsePlan('')
    setPlan(map)
    setPlanErrors(errors)
    setDraftPlanText('')
  }

  const todayKey = formatKey(new Date())
  const today = new Date()

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <p className="app-tagline">Meditation focus</p>
          <h1>{getMonthLabel(currentMonth)}</h1>
        </div>
        <div className="header-actions no-print">
          <button
            type="button"
            className="ghost-button"
            onClick={() => setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
            aria-label="Previous month"
          >
            ‹
          </button>
          <button
            type="button"
            className="ghost-button"
            onClick={() => setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
            aria-label="Next month"
          >
            ›
          </button>
          <button
            type="button"
            className="ghost-button"
            onClick={() => setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1))}
          >
            Today
          </button>
          <button type="button" className="ghost-button" onClick={() => window.print()}>
            Print
          </button>
        </div>
      </header>

      <section className="summary">
        <div>
          <p className="summary-title">This month</p>
          <p className="summary-value">
            {completedCount} / {monthDays.length} completed
          </p>
        </div>
        <div>
          <p className="summary-title">Target duration</p>
          <p className="summary-value">up to {TARGET_DURATION} min</p>
        </div>
        <div>
          <p className="summary-title">Custom plan days</p>
          <p className="summary-value">{planEntryList.length}</p>
        </div>
      </section>

      <section className="calendar" aria-label="Meditation calendar">
        <div className="weekdays" aria-hidden="true">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((label) => (
            <div key={label} className="weekday">
              {label}
            </div>
          ))}
        </div>
        <div className="calendar-grid">
          {calendar.map(({ date, isCurrentMonth }) => {
            const key = formatKey(date)
            const plannedDuration = plan[key]?.duration ?? getDefaultDuration(date)
            const note = plan[key]?.note
            const isCompleted = Boolean(completions[key])
            const isToday = key === todayKey

            return (
              <button
                key={key + isCurrentMonth}
                type="button"
                className={[
                  'day-cell',
                  isCurrentMonth ? 'current' : 'adjacent',
                  isCompleted ? 'completed' : '',
                  isToday ? 'today' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => handleToggleDay(date)}
                aria-pressed={isCompleted}
              >
                <span className="day-number">{date.getDate()}</span>
                <span className="day-duration">{plannedDuration} min</span>
                {note && <span className="day-note">{note}</span>}
                <span className="day-status" aria-hidden="true">
                  {isCompleted ? '✓' : ''}
                </span>
              </button>
            )
          })}
        </div>
      </section>

      <section className="plan-editor">
        <div className="plan-header">
          <h2>Custom ramp-up plan</h2>
          <div className="plan-buttons no-print">
            <button type="button" className="ghost-button" onClick={handleApplyPlan}>
              Apply plan
            </button>
            <button type="button" className="ghost-button" onClick={handleResetPlan}>
              Clear
            </button>
          </div>
        </div>
        <p className="plan-description">
          Paste a CSV with <code>date</code>, <code>duration</code>, and optional <code>note</code> columns.
          Dates must be in ISO format (<code>YYYY-MM-DD</code>). Durations are stored per day. Any days
          not listed use the default gradual ramp that reaches 60 minutes.
        </p>
        <textarea
          className="plan-input no-print"
          value={draftPlanText}
          onChange={(event) => setDraftPlanText(event.target.value)}
          spellCheck={false}
        />
        {planErrors.length > 0 && (
          <ul className="plan-errors no-print" role="alert">
            {planErrors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        )}
        {planEntryList.length > 0 && (
          <div className="plan-preview">
            <p className="plan-preview-title">Upcoming milestones</p>
            <ol>
              {planEntryList.slice(0, 6).map(({ key, entry, date }) => (
                <li key={key}>
                  <span>{formatDisplayDate(date)}</span>
                  <span>{entry.duration} min{entry.note ? ` — ${entry.note}` : ''}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </section>
    </div>
  )
}

export default App
