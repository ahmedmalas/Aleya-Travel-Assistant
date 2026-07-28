import type { DiscoveryCandidate, DestinationDiscoveryState } from './types';
import { pickDiscoveryQuestion, questionTextFor } from './questions';

function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
}

function describeCandidate(c: DiscoveryCandidate, index: number): string {
  const why = c.reasons.slice(0, 2).join('; ');
  const strength =
    c.matchStrength === 'strong'
      ? 'strongest fit'
      : c.matchStrength === 'good'
        ? 'strong option'
        : 'useful alternative';
  const trade = c.tradeoffs[0] ? ` (${c.tradeoffs[0]})` : '';
  if (index === 0) {
    return `${c.placeName} is the ${strength}${why ? ` — ${why}` : ''}${trade}`;
  }
  return `${c.placeName} is a ${strength}${why ? ` — ${why}` : ''}${trade}`;
}

export function formatRecommendationReply(discovery: DestinationDiscoveryState): string {
  const list = discovery.recommendations;
  if (!list.length) {
    return 'I could not find a strong match in the current catalogue for those constraints. Would you like to widen the flight time, budget, or region?';
  }
  const names = joinNames(list.map((c) => c.placeName));
  const details = list.map((c, i) => describeCandidate(c, i)).join('. ');
  return `I’d shortlist ${names}. ${details}. Which direction feels closest, or what should we adjust?`;
}

export function formatDiscoveryQuestionReply(discovery: DestinationDiscoveryState): string {
  const id = discovery.pendingQuestionId;
  const text = id
    ? questionTextFor(id, discovery.criteria)
    : pickDiscoveryQuestion(discovery.criteria, discovery.lastQuestionId)?.text;

  if (!text) {
    return 'What else matters most for choosing a destination — flight time, budget, or vibe?';
  }

  const knownBits: string[] = [];
  if (discovery.criteria.characters.length) {
    knownBits.push(discovery.criteria.characters.slice(0, 3).join(', '));
  }
  if (discovery.criteria.originLabel) {
    knownBits.push(`from ${discovery.criteria.originLabel}`);
  }
  if (discovery.criteria.maxTravelHours != null) {
    knownBits.push(`within about ${discovery.criteria.maxTravelHours} hours`);
  }
  if (discovery.criteria.exclusions.length) {
    knownBits.push(`excluding ${discovery.criteria.exclusions.join(', ')}`);
  }

  if (knownBits.length) {
    return `Noted — ${knownBits.join('; ')}. ${text}`;
  }
  return text;
}

export function formatDiscoveryAckContinue(discovery: DestinationDiscoveryState): string {
  if (discovery.recommendations.length) {
    return formatRecommendationReply(discovery);
  }
  return formatDiscoveryQuestionReply(discovery);
}
