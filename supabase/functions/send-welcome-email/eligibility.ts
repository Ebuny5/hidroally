export function maySendWelcome(verified: boolean, status: string | undefined): boolean {
  return verified && status === 'pending';
}