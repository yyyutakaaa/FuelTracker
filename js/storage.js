export function saveHistory(history) {
  const d = new Date();
  d.setTime(d.getTime() + 7 * 24 * 60 * 60 * 1000);
  document.cookie =
    "rideHistory=" +
    encodeURIComponent(JSON.stringify(history)) +
    ";expires=" +
    d.toUTCString() +
    ";path=/";
}

export function loadHistory() {
  const name = "rideHistory=";
  const ca = document.cookie.split(";");
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i].trim();
    if (c.indexOf(name) === 0) {
      try {
        return JSON.parse(
          decodeURIComponent(c.substring(name.length, c.length))
        );
      } catch (e) {
        return [];
      }
    }
  }
  return [];
}
