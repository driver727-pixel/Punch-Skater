function shuffleArray(items, rng = Math.random) {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function badRequest(message, status = 400) {
  return Object.assign(new Error(message), { statusCode: status });
}

function normalizeLoanerCard(uid, docSnap) {
  const data = docSnap.data() ?? {};
  return {
    id: docSnap.id,
    ownerUid: uid,
    ...data,
  };
}

export async function requireFreeTierCaller(db, caller) {
  if (!db || !caller?.uid) {
    throw badRequest('Free solo mode is not configured.', 503);
  }
  if (caller.admin === true) {
    throw badRequest('This solo trial is reserved for signed-in free users.', 403);
  }

  const profileSnap = await db.collection('userProfiles').doc(caller.uid).get();
  const profile = profileSnap.exists ? (profileSnap.data() ?? {}) : {};
  if (profile.isAdmin === true || profile.tier === 'tier2' || profile.tier === 'tier3') {
    throw badRequest('This solo trial is reserved for signed-in free users.', 403);
  }
}

export async function loadAdminLoanerCards(db, { count, rng = Math.random }) {
  const desiredCount = Math.max(1, Math.floor(Number(count) || 0));
  const adminProfilesSnap = await db.collection('userProfiles').where('isAdmin', '==', true).get();
  const adminUids = shuffleArray(adminProfilesSnap.docs.map((docSnap) => docSnap.id).filter(Boolean), rng);

  if (adminUids.length === 0) {
    throw badRequest('No admin loaner cards are available yet.', 503);
  }

  const selected = [];
  const seen = new Set();

  for (const uid of adminUids) {
    const cardsSnap = await db.collection('users').doc(uid).collection('cards').get();
    const cards = shuffleArray(cardsSnap.docs.map((docSnap) => normalizeLoanerCard(uid, docSnap)), rng);
    for (const card of cards) {
      const dedupeKey = `${card.ownerUid}:${card.id}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      selected.push(card);
      if (selected.length >= desiredCount) {
        return shuffleArray(selected, rng).slice(0, desiredCount);
      }
    }
  }

  throw badRequest(`Only ${selected.length} admin loaner card${selected.length === 1 ? ' is' : 's are'} available right now.`, 503);
}
