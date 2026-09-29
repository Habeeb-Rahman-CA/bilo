let BASE_Z_INDEX = 2000;
let modalStack: string[] = [];

export function registerModal(modalId: string): number {
  modalStack = modalStack.filter(id => id !== modalId);
  modalStack.push(modalId);
  return BASE_Z_INDEX + modalStack.length * 20;
}

export function unregisterModal(modalId: string): void {
  modalStack = modalStack.filter(id => id !== modalId);
}

export function isTopModal(modalId: string): boolean {
  if (modalStack.length === 0) return true;
  return modalStack[modalStack.length - 1] === modalId;
}

export function getModalZIndex(modalId: string): number {
  const index = modalStack.indexOf(modalId);
  if (index === -1) {
    return BASE_Z_INDEX;
  }
  return BASE_Z_INDEX + (index + 1) * 20;
}

export function getActiveModalCount(): number {
  return modalStack.length;
}

export function resetModalStack(): void {
  modalStack = [];
}
