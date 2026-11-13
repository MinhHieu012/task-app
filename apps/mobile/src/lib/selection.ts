import { createContext } from 'react';

/** Set by the wide (sidebar) layout: rows open the task in the side panel instead of a new screen. */
export const Selection = createContext<{ id: string | null; select: (id: string | null) => void } | null>(null);
