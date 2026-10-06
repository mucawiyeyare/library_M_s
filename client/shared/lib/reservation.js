// A waiting reservation that has a copy set aside is shown as READY.
export const holdStatus = (hold) =>
  hold.status === 'waiting' ? (hold.ready ? 'ready' : 'pending') : hold.status
