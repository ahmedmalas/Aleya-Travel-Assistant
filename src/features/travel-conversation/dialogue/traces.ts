import { getTraceList, setTraceList } from './runtime';
import type { DialogueTrace } from './types';

export function getDialogueTraces(): DialogueTrace[] {
  return getTraceList();
}

export function pushDialogueTrace(trace: DialogueTrace): void {
  setTraceList([...getTraceList(), trace].slice(-50));
}

export function clearDialogueTraces(): void {
  setTraceList([]);
}
