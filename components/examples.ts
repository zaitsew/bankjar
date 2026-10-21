export type IconName = "wallet" | "jar" | "card" | "globe" | "clock" | "gift";

export interface Example {
  title: string;
  prompt: string;
  icon: IconName;
}

/** The six example prompts on the home page and in empty states. */
export const EXAMPLES: Example[] = [
  { title: "Move my salary", prompt: "Find me the best bank offer for transferring my salary", icon: "wallet" },
  { title: "Park my savings", prompt: "Best savings account for €20,000 with no lock-in", icon: "jar" },
  { title: "Free everyday account", prompt: "A current account with no fees and no conditions", icon: "card" },
  { title: "Account as a non-resident", prompt: "Which bank opens an account for a non-resident with NIE?", icon: "globe" },
  { title: "Best 12-month deposit", prompt: "Highest 12-month deposit rate", icon: "clock" },
  { title: "Bonus without payroll", prompt: "Welcome bonus without moving my salary", icon: "gift" },
];

export const PROMPT_PLACEHOLDER = "Find me the best bank offer for transferring my salary";

export function searchHref(prompt: string): string {
  return `/search?q=${encodeURIComponent(prompt)}`;
}
