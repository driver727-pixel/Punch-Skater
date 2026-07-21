import { normalizeEmail } from '../lib/auth.js';
import {
  TRADE_ECONOMY_VERSION,
  createTradeReputationSnapshot,
  estimateCardTradeValue,
  getSendAbusePreventionMessages,
  getTradeFairnessFlags,
  getTradeValueBand,
} from '../lib/tradeEconomy.js';

const USER_COLLECTION = 'users';
const USER_LOOKUP_COLLECTION = 'userLookup';
const TRADE_COLLECTION = 'trades';

function isPlainObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function isValidCardSnapshot(card) {
  return isPlainObject(card) && typeof card.id === 'string' && card.id.trim() !== '';
}

function buildTradePayload({
  tradeId,
  caller,
  recipientUid,
  recipientEmail,
  offeredCard,
  sentTrades,
  createdAt,
}) {
  const estimatedValue = estimateCardTradeValue(offeredCard);
  return {
    id: tradeId,
    fromUid: caller.uid,
    fromEmail: typeof caller.email === 'string' ? caller.email.trim() : '',
    toUid: recipientUid,
    toEmail: recipientEmail,
    offeredCardId: offeredCard.id,
    offeredCard,
    estimatedValue,
    valueBand: getTradeValueBand(estimatedValue),
    economyVersion: TRADE_ECONOMY_VERSION,
    senderReputation: createTradeReputationSnapshot(sentTrades, caller.uid, createdAt),
    fairPlay: {
      flags: getTradeFairnessFlags(offeredCard, estimatedValue),
      reviewedAt: createdAt,
    },
    confirmations: {
      sender: ['no-real-money', 'estimated-value-reviewed', 'recipient-verified'],
    },
    status: 'pending',
    createdAt,
    updatedAt: createdAt,
  };
}

export function registerTradeRoutes(app, {
  adminDb,
  tradeRateLimit,
  authenticateFirebaseUser,
  randomUUID,
}) {
  const registerRoute = (method, path, ...handlers) => {
    if (typeof app?.[method] !== 'function' && typeof app?.post === 'function' && method === 'get') {
      app.get = app.post.bind(app);
    }
    const methodImpl = typeof app?.[method] === 'function' ? app[method].bind(app) : null;
    if (!methodImpl) {
      throw new Error(`Unsupported route method: ${method}`);
    }
    methodImpl(path, ...handlers);
  };

  async function authenticateTradeCaller(req, res, next) {
    try {
      req.caller = await authenticateFirebaseUser(req);
      next();
    } catch (error) {
      res.status(error.statusCode ?? 500).json({ error: error.message ?? 'Authentication failed.' });
    }
  }

  // codeql[js/missing-rate-limiting]: tradeRateLimit is applied before authentication and route handling.
  registerRoute('post', '/api/trades', tradeRateLimit, authenticateTradeCaller, async (req, res) => {
    if (!adminDb) {
      res.status(503).json({ error: 'Trades are not configured on this server.' });
      return;
    }

    const body = req.body;
    if (!isPlainObject(body)) {
      res.status(400).json({ error: 'Trade payload is required.' });
      return;
    }
    if (!Object.keys(body).every((key) => ['offeredCardId', 'recipientEmail'].includes(key))) {
      res.status(400).json({ error: 'Trade creation accepts only offeredCardId and recipientEmail.' });
      return;
    }

    const offeredCardId = typeof body.offeredCardId === 'string' ? body.offeredCardId.trim() : '';
    const recipientEmail = normalizeEmail(body.recipientEmail);

    if (!offeredCardId) {
      res.status(400).json({ error: 'offeredCardId must be a non-empty string.' });
      return;
    }
    if (!recipientEmail || !recipientEmail.includes('@')) {
      res.status(400).json({ error: 'Enter a valid recipient email.' });
      return;
    }

    const caller = req.caller;
    if (recipientEmail === normalizeEmail(caller.email)) {
      res.status(400).json({ error: "You can't trade with yourself." });
      return;
    }

    try {
      const [recipientSnap, sentTradesSnap, cardSnap] = await Promise.all([
        adminDb.collection(USER_LOOKUP_COLLECTION).where('emailLower', '==', recipientEmail).limit(1).get(),
        adminDb.collection(TRADE_COLLECTION).where('fromUid', '==', caller.uid).get(),
        adminDb.collection(USER_COLLECTION).doc(caller.uid).collection('cards').doc(offeredCardId).get(),
      ]);

      if (recipientSnap.empty) {
        res.status(404).json({ error: 'No account found with that email address.' });
        return;
      }

      const recipientProfile = recipientSnap.docs[0].data() ?? {};
      if (typeof recipientProfile.uid !== 'string' || recipientProfile.uid.trim() === '') {
        res.status(409).json({ error: 'Recipient account is unavailable for trades right now.' });
        return;
      }
      if (recipientProfile.uid === caller.uid) {
        res.status(400).json({ error: "You can't trade with yourself." });
        return;
      }

      if (!cardSnap.exists) {
        res.status(404).json({ error: 'That card is no longer in your collection.' });
        return;
      }

      const offeredCard = cardSnap.data();
      if (!isValidCardSnapshot(offeredCard)) {
        res.status(409).json({ error: 'That card is not available for trading right now.' });
        return;
      }

      const sentTrades = sentTradesSnap.docs.map((docSnap) => docSnap.data());
      const pendingTrades = sentTrades.filter((trade) => trade?.status === 'pending');
      const abuseMessages = getSendAbusePreventionMessages(
        pendingTrades,
        recipientProfile.uid,
        offeredCardId,
      );
      if (abuseMessages.length > 0) {
        res.status(409).json({ error: abuseMessages[0] });
        return;
      }

      const createdAt = new Date().toISOString();
      const tradeId = `trade-${randomUUID()}`;
      const trade = buildTradePayload({
        tradeId,
        caller,
        recipientUid: recipientProfile.uid,
        recipientEmail,
        offeredCard,
        sentTrades,
        createdAt,
      });

      await adminDb.collection(TRADE_COLLECTION).doc(tradeId).set(trade, { merge: false });
      res.status(201).json({ trade });
    } catch (error) {
      console.error('Trade creation error:', error);
      res.status(error.statusCode ?? 500).json({ error: error.message ?? 'Failed to create trade offer.' });
    }
  });

  registerRoute('get', '/api/trades/market', tradeRateLimit, authenticateTradeCaller, async (req, res) => {
    if (!adminDb) {
      res.status(503).json({ error: 'Trades are not configured on this server.' });
      return;
    }

    try {
      const caller = req.caller;
      const marketSnap = await adminDb.collection(TRADE_COLLECTION)
        .where('status', '==', 'pending')
        .get();
      const trades = marketSnap.docs
        .map((docSnap) => ({ id: docSnap.id, ...(docSnap.data() ?? {}) }))
        .filter((trade) => trade.fromUid !== caller.uid && trade.toUid !== caller.uid)
        .sort((left, right) => (left.createdAt < right.createdAt ? 1 : left.createdAt > right.createdAt ? -1 : 0))
        .slice(0, 50);
      res.json({ trades });
    } catch (error) {
      console.error('Trade market read error:', error);
      res.status(error.statusCode ?? 500).json({ error: error.message ?? 'Failed to load the community market.' });
    }
  });

  registerRoute('post', '/api/trades/:tradeId/status', tradeRateLimit, authenticateTradeCaller, async (req, res) => {
    if (!adminDb) {
      res.status(503).json({ error: 'Trades are not configured on this server.' });
      return;
    }

    const tradeId = typeof req.params.tradeId === 'string' ? req.params.tradeId.trim() : '';
    const nextStatus = typeof req.body?.status === 'string' ? req.body.status.trim().toLowerCase() : '';
    const caller = req.caller;

    if (!tradeId || !['accepted', 'declined', 'cancelled'].includes(nextStatus)) {
      res.status(400).json({ error: 'A valid tradeId and status are required.' });
      return;
    }

    const tradeRef = adminDb.collection(TRADE_COLLECTION).doc(tradeId);

    try {
      const updatedTrade = await adminDb.runTransaction(async (tx) => {
        const tradeSnap = await tx.get(tradeRef);
        if (!tradeSnap.exists) {
          throw Object.assign(new Error('This offer no longer exists.'), { statusCode: 404 });
        }

        const currentTrade = tradeSnap.data() ?? {};
        if (currentTrade.status !== 'pending') {
          throw Object.assign(new Error('This offer is no longer pending.'), { statusCode: 409 });
        }

        const isRecipientAction = currentTrade.toUid === caller.uid;
        const isOffererAction = currentTrade.fromUid === caller.uid;
        if ((nextStatus === 'accepted' || nextStatus === 'declined') && !isRecipientAction) {
          throw Object.assign(new Error('This offer is no longer assigned to your account.'), { statusCode: 403 });
        }
        if (nextStatus === 'cancelled' && !isOffererAction) {
          throw Object.assign(new Error('This offer is no longer owned by your account.'), { statusCode: 403 });
        }

        if (nextStatus === 'accepted') {
          const offeredCardId = currentTrade.offeredCardId ?? currentTrade.offeredCard?.id;
          if (!offeredCardId) {
            throw Object.assign(new Error('This offer does not contain a transferable card.'), { statusCode: 409 });
          }

          const fromCardRef = adminDb.collection(USER_COLLECTION).doc(currentTrade.fromUid).collection('cards').doc(offeredCardId);
          const toCardRef = adminDb.collection(USER_COLLECTION).doc(currentTrade.toUid).collection('cards').doc(offeredCardId);
          const [fromCardSnap, toCardSnap] = await Promise.all([
            tx.get(fromCardRef),
            tx.get(toCardRef),
          ]);

          if (!fromCardSnap.exists) {
            throw Object.assign(new Error('The sender no longer owns this card.'), { statusCode: 409 });
          }
          if (toCardSnap.exists) {
            throw Object.assign(new Error('You already have this card in your collection.'), { statusCode: 409 });
          }

          const currentOfferedCard = fromCardSnap.data();
          tx.delete(fromCardRef);
          tx.set(toCardRef, currentOfferedCard);
          const updatedAt = new Date().toISOString();
          const nextTrade = {
            ...currentTrade,
            status: 'accepted',
            confirmations: {
              ...(currentTrade.confirmations ?? {}),
              recipient: ['estimated-value-reviewed', 'sender-reputation-reviewed', 'card-only-trade'],
            },
            updatedAt,
          };
          tx.update(tradeRef, {
            status: 'accepted',
            confirmations: nextTrade.confirmations,
            updatedAt,
          });
          return nextTrade;
        }

        const updatedAt = new Date().toISOString();
        tx.update(tradeRef, { status: nextStatus, updatedAt });
        return {
          ...currentTrade,
          status: nextStatus,
          updatedAt,
        };
      });

      res.json({ trade: updatedTrade });
    } catch (error) {
      console.error('Trade status update error:', error);
      res.status(error.statusCode ?? 500).json({ error: error.message ?? 'Failed to update trade status.' });
    }
  });
}
