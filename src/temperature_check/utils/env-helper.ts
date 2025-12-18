/**
 * Gets an environment variable or throws an error if it's not defined.
 * @param varName - The name of the environment variable
 * @returns The value of the environment variable
 * @throws Error if the environment variable is not defined or is empty
 */
export function getEnvVarOrThrow(varName: string): string {
  const value = process.env[varName];
  if (!value) {
    throw new Error(`Required environment variable ${varName} is not defined`);
  }
  return value;
}
