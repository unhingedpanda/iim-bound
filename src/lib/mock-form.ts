/**
 * What the mock form's action reports back.
 *
 * Its own module because a `"use server"` file may only export async
 * functions: sharing a type with the client form needs somewhere else to live.
 */
export type MockFormState = { ok: boolean; error: string | null };

export const EMPTY_MOCK_FORM: MockFormState = { ok: false, error: null };
