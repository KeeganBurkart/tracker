# Meditation Ramp Calendar

A focused, monochrome meditation tracker that pairs a single-month calendar with a customizable ramp-up plan. The interface borrows from Apple's minimal aesthetic with SF Pro typography, rounded cards, and neutral grays.

## Features

- 📆 **Single-month calendar** with Sunday as the first day of the week.
- ⏱️ **Planned duration per day**—automatically ramps toward 60 minutes if no custom plan is supplied.
- ✅ **One-click completion tracking** that persists locally via `localStorage`.
- 📝 **Custom CSV ramp-up plans** with optional notes and robust parsing for quoted values.
- 🖨️ **Print-friendly layout** and a dedicated print button for quick hard copies.
- 📊 **Monthly summary** highlighting completions and the size of the custom plan.

## Getting started

```bash
npm install
npm run dev
```

The app is served at [http://localhost:5173](http://localhost:5173). Use the navigation arrows or the **Today** button to change months.

## Supplying a custom plan

Paste a CSV plan into the editor and choose **Apply plan**. Any rows that cannot be parsed are reported for quick fixes. The CSV accepts an optional header row. Supported columns:

| Column      | Required | Notes                                                  |
| ----------- | -------- | ------------------------------------------------------ |
| `date`      | ✅        | ISO dates (`YYYY-MM-DD`).                              |
| `duration`  | ✅        | Planned minutes for the day (positive number).        |
| `note`      | ❌        | Additional context; wrap in quotes to keep commas.    |

Example:

```csv
date,duration,note
2024-02-01,20,"Light stretch"
2024-02-15,35,
2024-03-01,45,"Deep focus"
```

Days that are not listed fall back to the automatic ramp that begins near 10 minutes and caps at 60 minutes. Plan data and completion states are both stored in the browser, so clearing site data resets progress.

## Printing

Select **Print** in the header (or use your browser's print shortcut). Interactive controls and text areas are hidden in print mode to keep the calendar clean.
