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
      road_source: loc.road_source,
      road_user_raw: loc.road_user_raw,
      road_confirmed: loc.road_confirmed,
      landmark: loc.landmark,
      override: loc.address_override ?? loc.override ?? null,
    },
    classification: caseDoc.classification,
    jurisdiction: caseDoc.jurisdiction,
  };
}
