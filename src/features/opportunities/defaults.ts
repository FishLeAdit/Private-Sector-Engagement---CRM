// Assessment examples only. Managers explicitly opt in and may replace these.
export const provisionalStages = [
  "New",
  "Scoping",
  "Preparation",
  "Submitted",
  "Pending",
  "Won",
  "Lost",
  "Abandoned",
] as const;
export const provisionalCategories = [
  ["DSP", "Digital School Program"],
  ["SAC", "Sponsor a Child"],
  ["DISASTER", "Disaster Campaign"],
  ["PROJECT", "Project"],
  ["EVENT_CAMPAIGN", "Event & Campaign"],
  ["GENERAL", "General"],
] as const;
