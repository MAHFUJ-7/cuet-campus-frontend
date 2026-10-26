// Ported from lib/core/utils/validators.dart — messages preserved exactly.
import {
  COORDINATOR_DOMAIN,
  LEGACY_STUDENT_EMAIL_PATTERN,
  STUDENT_EMAIL_PATTERN,
} from './constants.js';

const EMAIL_REGEX = /^[\w-]+(\.[\w-]+)*@([\w-]+\.)+[a-zA-Z]{2,7}$/;

export function validateEmail(value) {
  if (!value) return 'Email is required';
  if (!EMAIL_REGEX.test(value)) return 'Enter a valid email address';
  return null;
}

export function validateCuetEmail(value) {
  const basic = validateEmail(value);
  if (basic) return basic;
  const lower = value.trim().toLowerCase();
  if (!STUDENT_EMAIL_PATTERN.test(lower)) {
    return 'Use your official student email: u2204037@student.cuet.ac.bd';
  }
  return null;
}

export function validateCoordinatorEmail(value) {
  const basic = validateEmail(value);
  if (basic) return basic;
  if (!value.toLowerCase().endsWith(COORDINATOR_DOMAIN)) {
    return 'Only official CUET coordinator emails are allowed';
  }
  return null;
}

/** Login accepts a student email (new or legacy format) or coordinator domain. */
export function validateLoginEmail(value) {
  const basic = validateEmail(value);
  if (basic) return basic;
  const lower = value.trim().toLowerCase();
  if (lower.endsWith(COORDINATOR_DOMAIN)) return null;
  if (STUDENT_EMAIL_PATTERN.test(lower) || LEGACY_STUDENT_EMAIL_PATTERN.test(lower)) {
    return null;
  }
  return 'Use your CUET email, e.g. u2204037@student.cuet.ac.bd';
}

export function validatePassword(value) {
  if (!value) return 'Password is required';
  if (value.length < 8) return 'Password must be at least 8 characters';
  if (!/[A-Z]/.test(value)) return 'Password must contain at least one uppercase letter';
  if (!/[a-z]/.test(value)) return 'Password must contain at least one lowercase letter';
  if (!/[0-9]/.test(value)) return 'Password must contain at least one number';
  return null;
}

export function validateConfirmPassword(value, password) {
  const passwordError = validatePassword(value);
  if (passwordError) return passwordError;
  if (value !== password) return 'Passwords do not match';
  return null;
}

export function validateName(value) {
  if (!value) return 'Name is required';
  if (value.length < 2) return 'Name must be at least 2 characters';
  if (value.length > 100) return 'Name must be less than 100 characters';
  return null;
}

export function validateStudentId(value) {
  if (!value) return 'Student ID is required';
  if (!/^\d{7}$/.test(value)) return 'Student ID must be 7 digits';
  return null;
}

/** Simple login validator — only checks non-empty. */
export function validateLoginPassword(value) {
  if (!value) return 'Password is required';
  return null;
}

export function validateRequired(value, fieldName = 'This field') {
  if (!value) return `${fieldName} is required`;
  return null;
}

export function isCuetEmail(email) {
  return STUDENT_EMAIL_PATTERN.test((email ?? '').trim().toLowerCase());
}
