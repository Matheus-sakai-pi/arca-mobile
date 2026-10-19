type Purchase = { purchaseToken?: string | null };
const inFlight = new Map<string, Promise<boolean>>();
export function deliverPurchase<T extends Purchase>(
  owner: string,
  purchase: T,
  verify: (token: string) => Promise<boolean>,
  finish: (purchase: T) => Promise<void>,
): Promise<boolean> {
  const token = purchase.purchaseToken;
  if (!token) return Promise.reject(new Error('Compra sem recibo. Restaure suas compras.'));
  const key = `${owner}:${token}`;
  const existing = inFlight.get(key);
  if (existing) return existing;
  const task = (async () => {
    // Pending payments are registered on the server, but never finished or rewarded.
    if (!(await verify(token))) return false;
    await finish(purchase);
    return true;
  })().finally(() => inFlight.delete(key));
  inFlight.set(key, task);
  return task;
}
