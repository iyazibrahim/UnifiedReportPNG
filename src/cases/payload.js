export function toDispatchPayload(caseDoc) {
  const loc = caseDoc.location || {};
  return {
    ref: caseDoc.ref,
    channel: caseDoc.channel,
    reporter: caseDoc.reporter,
    intake: caseDoc.intake,
    location: {
      lat: loc.lat,
      lng: loc.lng,
      accuracy_m: loc.accuracy_m,
      source: loc.source,
      confirmed: loc.confirmed,
      confirmed_at: loc.confirmed_at,
      display_name: loc.display_name,
      road: loc.road,
      landmark: loc.landmark,
      override: loc.address_override ?? loc.override ?? null,
    },
    classification: caseDoc.classification,
    jurisdiction: caseDoc.jurisdiction,
  };
}
