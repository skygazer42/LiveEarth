const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

function normalizeDegrees(value: number): number {
  return ((value % 360) + 360) % 360;
}

export function solarAltitudeDegrees(at: Date, latitude: number, longitude: number): number {
  const julianDay = at.getTime() / 86_400_000 + 2_440_587.5;
  const days = julianDay - 2_451_545;
  const meanLongitude = normalizeDegrees(280.46 + 0.9856474 * days);
  const meanAnomaly = normalizeDegrees(357.528 + 0.9856003 * days) * DEG_TO_RAD;
  const eclipticLongitude =
    (meanLongitude + 1.915 * Math.sin(meanAnomaly) + 0.02 * Math.sin(2 * meanAnomaly)) *
    DEG_TO_RAD;
  const obliquity = (23.439 - 0.0000004 * days) * DEG_TO_RAD;
  const rightAscension = Math.atan2(
    Math.cos(obliquity) * Math.sin(eclipticLongitude),
    Math.cos(eclipticLongitude),
  );
  const declination = Math.asin(Math.sin(obliquity) * Math.sin(eclipticLongitude));
  const greenwichSiderealDegrees = normalizeDegrees(
    (18.697374558 + 24.06570982441908 * days) * 15,
  );
  const hourAngle =
    (normalizeDegrees(greenwichSiderealDegrees + longitude - rightAscension * RAD_TO_DEG + 180) -
      180) *
    DEG_TO_RAD;
  const latitudeRadians = latitude * DEG_TO_RAD;
  const altitude = Math.asin(
    Math.sin(latitudeRadians) * Math.sin(declination) +
      Math.cos(latitudeRadians) * Math.cos(declination) * Math.cos(hourAngle),
  );
  return altitude * RAD_TO_DEG;
}

export function isAfterCivilDusk(at: Date, latitude: number, longitude: number): boolean {
  return solarAltitudeDegrees(at, latitude, longitude) < -6;
}

export function nightTemporalRelevance(at: Date, latitude: number, longitude: number): number {
  const altitude = solarAltitudeDegrees(at, latitude, longitude);
  if (altitude <= -12) return 100;
  if (altitude <= -6) return 90;
  if (altitude <= 0) return 55;
  return 5;
}
