export type BusEvent = {
  type: string;
  payload: Record<string, unknown>;
  at: string;
};

export function publish(event: Omit<BusEvent, "at">): void {
  console.log(`[bus] ${event.type} ${JSON.stringify(event.payload)}`);
}

export function publishMany(events: Array<Omit<BusEvent, "at">>): void {
  for (const event of events) {
    publish(event);
  }
}