import type { TripBriefInput, TripBriefValidationErrors } from './models';

export function validateTripBrief(input: TripBriefInput): TripBriefValidationErrors {
  const errors: TripBriefValidationErrors = {};

  if (!input.destination.trim()) {
    errors.destination = 'Destination is required.';
  }

  if (!input.startDate) {
    errors.startDate = 'Start date is required.';
  }

  if (!input.endDate) {
    errors.endDate = 'End date is required.';
  }

  if (input.startDate && input.endDate) {
    const start = new Date(input.startDate);
    const end = new Date(input.endDate);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      errors.endDate = 'Please provide valid travel dates.';
    } else if (end < start) {
      errors.endDate = 'End date must be on or after start date.';
    }
  }

  if (!Number.isInteger(input.travelers) || input.travelers < 1) {
    errors.travelers = 'At least one traveler is required.';
  }

  if (input.interests.length === 0) {
    errors.interests = 'Select at least one interest.';
  }

  return errors;
}

export function hasTripBriefErrors(errors: TripBriefValidationErrors): boolean {
  return Object.keys(errors).length > 0;
}
