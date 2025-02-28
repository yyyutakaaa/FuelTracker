export function saveHistory(history) {
  localStorage.setItem("rideHistory", JSON.stringify(history));
}
export function loadHistory() {
  const data = localStorage.getItem("rideHistory");
  return data ? JSON.parse(data) : [];
}
