let csrfToken: string | null = null;

export function setCsrfToken(nextToken: string | null): void {
  csrfToken = nextToken;
}

export function getCsrfToken(): string | null {
  return csrfToken;
}
