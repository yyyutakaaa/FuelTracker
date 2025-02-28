export async function getFuelPrice(fuelType) {
  try {
    const response = await fetch(
      "https://bestat.statbel.fgov.be/bestat/api/views/665e2960-bf86-4d64-b4a8-90f2d30ea892/result/JSON"
    );
    if (!response.ok) throw new Error();
    const data = await response.json();
    const filtered = data.facts.filter((i) => i["Product"] === fuelType);
    if (!filtered.length) throw new Error();
    const valid = filtered.filter((i) => i["Price incl. VAT"] !== null);
    if (!valid.length) throw new Error();
    const prices = valid.map((i) => Number(i["Price incl. VAT"]));
    const minP = Math.min(...prices);
    const maxP = Math.max(...prices);
    return (minP + maxP) / 2;
  } catch {
    return 1.7;
  }
}
