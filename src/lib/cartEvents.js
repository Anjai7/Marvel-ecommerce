/**
 * Any surface that adds to the cart can ask the header to slide the cart
 * panel open. A window event keeps the product card and the product page
 * independent of the header's local drawer state.
 */
export function openCartDrawer() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("marvel:cart:open"));
}
