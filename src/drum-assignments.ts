import {
  mergeTriggers,
  type Assignment,
  type ScheduledTrigger,
} from "./events/contract.ts";
export const defaultAssignments = (): Assignment[] =>
  [
    ["kick", 0, 1, "Kick", 36],
    ["snare", 1, 1, "Snare", 38],
    ["clap", 2, 1, "Clap", 39],
    ["low-tom", 3, 1, "Low Tom", 45],
    ["high-tom", 4, 1, "High Tom", 50],
    ["closed-hat", 5, 1, "Closed Hat", 42],
    ["open-hat", 5, 2, "Open Hat", 46],
    ["percussion", 6, 1, "Percussion", 56],
    ["claves", 7, 1, "Claves", 75],
    ["cymbal", 8, 1, "Cymbal", 49],
  ].map(([id, voice, articulation, name, note]) => ({
    id,
    voice,
    articulation,
    name,
    note,
  })) as Assignment[];
/** Drum-only articulation conflict policy; the shared event library has no drum constants. */
export function resolveDrumTriggers(
  events: ScheduledTrigger[],
  assignments: Assignment[],
) {
  const unique = mergeTriggers(events);
  const closed = new Set(
    unique
      .filter((e) => {
        const a = assignments.find((a) => a.id === e.assignmentId);
        return a?.voice === 5 && a.articulation === 1;
      })
      .map((e) => e.beat),
  );
  return unique.filter((e) => {
    const a = assignments.find((a) => a.id === e.assignmentId);
    return !(a?.voice === 5 && a.articulation === 2 && closed.has(e.beat));
  });
}
