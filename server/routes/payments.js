import express from 'express';

export function registerPaymentRoutes(app, {
  stripe,
  stripeWebhookSecret,
  checkoutRateLimit,
  resolveTierFromPriceId,
  resolveCheckoutModeFromPriceId,
  resolveBillingPeriodFromPriceId,
  syncPurchasedTier,
  syncSubscriptionEntitlement,
  isAllowedRedirectUrl,
  normalizeEmail,
  timingSafeEmailMatches,
  sendCheckoutVerificationFailure,
  getAdminDb,
}) {
  function timestampToIso(seconds) {
    return Number.isFinite(seconds) && seconds > 0
      ? new Date(seconds * 1000).toISOString()
      : undefined;
  }

  function getStripeId(value) {
    if (!value) return '';
    if (typeof value === 'string') return value;
    return typeof value.id === 'string' ? value.id : '';
  }

  app.post('/api/stripe/webhook', express.raw({ type: 'application/json', limit: '256kb' }), async (req, res) => {
    if (!stripe || !stripeWebhookSecret) {
      res.status(503).json({ error: 'Stripe webhook handling is not configured.' });
      return;
    }

    const signature = req.headers['stripe-signature'];
    if (typeof signature !== 'string' || !signature.trim()) {
      res.status(400).json({ error: 'Missing Stripe signature.' });
      return;
    }

    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, signature, stripeWebhookSecret);
    } catch (error) {
      console.error('Stripe webhook signature verification failed:', error);
      res.status(400).json({ error: 'Invalid Stripe signature.' });
      return;
    }

    try {
      // ── Idempotency guard ────────────────────────────────────────────────
      // Stripe may deliver the same event more than once (retries on non-2xx).
      // Record each processed event ID in Firestore so replays are ignored.
      const adminDb = typeof getAdminDb === 'function' ? getAdminDb() : null;
      const processedEventRef = adminDb?.collection('processedStripeEvents').doc(event.id) ?? null;
      const markEventProcessed = async () => {
        if (!processedEventRef) return;
        await processedEventRef.set({
          processedAt: new Date().toISOString(),
          type: event.type,
        });
      };
      if (processedEventRef) {
        const existing = await processedEventRef.get();
        if (existing.exists) {
          res.json({ received: true });
          return;
        }
      } else {
        console.warn('Stripe webhook: Firestore unavailable — event deduplication is disabled. Replayed events may be processed more than once.');
      }

      if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        let paidTier = resolveTierFromPriceId(session.metadata?.priceId);
        let checkoutMode = resolveCheckoutModeFromPriceId(session.metadata?.priceId);
        let billingPeriod = resolveBillingPeriodFromPriceId(session.metadata?.priceId);
        if (!paidTier) {
          const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 1 });
          const fallbackPriceId = lineItems.data[0]?.price?.id ?? '';
          paidTier = resolveTierFromPriceId(fallbackPriceId);
          checkoutMode = resolveCheckoutModeFromPriceId(fallbackPriceId);
          billingPeriod = resolveBillingPeriodFromPriceId(fallbackPriceId);
        }
        const customerEmail = typeof session.customer_details?.email === 'string'
          ? session.customer_details.email
          : typeof session.customer_email === 'string'
            ? session.customer_email
            : '';
        if (paidTier && session.payment_status === 'paid') {
          let subscription = null;
          const stripeSubscriptionId = getStripeId(session.subscription);
          if (checkoutMode === 'subscription' && stripeSubscriptionId) {
            subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
          }
          await syncPurchasedTier({
            tier: paidTier,
            email: customerEmail,
            sessionId: session.id,
            checkoutMode,
            stripeCustomerId: getStripeId(session.customer),
            stripeSubscriptionId,
            subscriptionStatus: subscription?.status,
            currentPeriodEnd: timestampToIso(subscription?.current_period_end),
            billingPeriod,
          });
        }
      } else if (
        event.type === 'customer.subscription.updated' ||
        event.type === 'customer.subscription.deleted'
      ) {
        const subscription = event.data.object;
        const priceId = subscription.items?.data?.[0]?.price?.id ?? '';
        const paidTier = resolveTierFromPriceId(priceId);
        if (!paidTier) {
          await markEventProcessed();
          res.json({ received: true });
          return;
        }
        await syncSubscriptionEntitlement({
          tier: paidTier,
          status: subscription.status,
          stripeCustomerId: getStripeId(subscription.customer),
          stripeSubscriptionId: subscription.id,
          currentPeriodEnd: timestampToIso(subscription.current_period_end),
          billingPeriod: resolveBillingPeriodFromPriceId(priceId),
        });
      } else if (event.type === 'invoice.paid') {
        const invoice = event.data.object;
        const stripeSubscriptionId = getStripeId(invoice.subscription);
        if (stripeSubscriptionId) {
          const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
          const priceId = subscription.items?.data?.[0]?.price?.id ?? '';
          const paidTier = resolveTierFromPriceId(priceId);
          if (!paidTier) {
            await markEventProcessed();
            res.json({ received: true });
            return;
          }
          await syncSubscriptionEntitlement({
            tier: paidTier,
            status: subscription.status,
            stripeCustomerId: getStripeId(subscription.customer),
            stripeSubscriptionId: subscription.id,
            currentPeriodEnd: timestampToIso(subscription.current_period_end),
            billingPeriod: resolveBillingPeriodFromPriceId(priceId),
          });
        }
      }

      await markEventProcessed();
      res.json({ received: true });
    } catch (error) {
      console.error('Stripe webhook handling failed:', error);
      res.status(500).json({ error: 'Failed to process Stripe webhook.' });
    }
  });

  app.post('/api/create-checkout-session', express.json({ limit: '256kb' }), checkoutRateLimit, async (req, res) => {
    if (!stripe) {
      res.status(503).json({ error: 'Payment processing is not configured.' });
      return;
    }

    const { priceId, successUrl, cancelUrl, email } = req.body ?? {};
    const normalizedEmail = normalizeEmail(email);
    const paidTier = resolveTierFromPriceId(priceId);
    const checkoutMode = resolveCheckoutModeFromPriceId(priceId);
    const billingPeriod = resolveBillingPeriodFromPriceId(priceId);

    if (!priceId || typeof priceId !== 'string' || !checkoutMode) {
      res.status(400).json({ error: 'Invalid or unsupported price ID.' });
      return;
    }
    if (!billingPeriod) {
      res.status(400).json({ error: 'Billing period is not configured for this price ID.' });
      return;
    }

    if (!isAllowedRedirectUrl(successUrl) || !isAllowedRedirectUrl(cancelUrl)) {
      res.status(400).json({ error: 'successUrl and cancelUrl must use an approved application origin.' });
      return;
    }

    try {
      const checkoutMetadata = {
        priceId,
        checkoutMode,
        billingPeriod,
        ...(paidTier ? { paidTier } : {}),
        ...(normalizedEmail ? { emailLower: normalizedEmail } : {}),
      };
      const session = await stripe.checkout.sessions.create({
        line_items: [{ price: priceId, quantity: 1 }],
        mode: checkoutMode,
        ...(checkoutMode === 'subscription'
          ? { subscription_data: { metadata: checkoutMetadata } }
          : {}),
        ...(typeof email === 'string' && email.trim()
          ? { customer_email: email.trim() }
          : {}),
        metadata: checkoutMetadata,
        success_url: successUrl,
        cancel_url: cancelUrl,
      });
      res.json({ url: session.url });
    } catch (error) {
      console.error('Stripe checkout error:', error);
      res.status(500).json({ error: 'Failed to create checkout session.' });
    }
  });

  app.get('/api/verify-checkout-session', checkoutRateLimit, async (req, res) => {
    if (!stripe) {
      res.status(503).json({ error: 'Payment processing is not configured.' });
      return;
    }

    const sessionId = typeof req.query.session_id === 'string' ? req.query.session_id.trim() : '';
    const expectedEmail = typeof req.query.email === 'string' ? req.query.email.trim().toLowerCase() : '';
    if (!sessionId) {
      res.status(400).json({ error: 'session_id is required.' });
      return;
    }
    if (!expectedEmail) {
      res.status(400).json({ error: 'email is required.' });
      return;
    }

    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      const lineItems = await stripe.checkout.sessions.listLineItems(sessionId, { limit: 1 });
      const priceId = lineItems.data[0]?.price?.id;
      const paidTier = resolveTierFromPriceId(priceId);
      const checkoutMode = resolveCheckoutModeFromPriceId(priceId);
      const billingPeriod = resolveBillingPeriodFromPriceId(priceId);
      const sessionEmail = (session.customer_details?.email ?? session.customer_email ?? '').trim().toLowerCase();

      if (
        !priceId ||
        !paidTier ||
        session.payment_status !== 'paid' ||
        !sessionEmail ||
        !timingSafeEmailMatches(sessionEmail, expectedEmail)
      ) {
        console.warn('Stripe checkout verification rejected.', {
          sessionId,
          hasPriceId: Boolean(priceId),
          hasPaidTier: Boolean(paidTier),
          paymentStatus: session.payment_status,
          hasSessionEmail: Boolean(sessionEmail),
        });
        sendCheckoutVerificationFailure(res);
        return;
      }

      let subscription = null;
      const stripeSubscriptionId = getStripeId(session.subscription);
      if (checkoutMode === 'subscription' && stripeSubscriptionId) {
        subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
      }
      await syncPurchasedTier({
        tier: paidTier,
        email: sessionEmail,
        sessionId,
        checkoutMode,
        stripeCustomerId: getStripeId(session.customer),
        stripeSubscriptionId,
        subscriptionStatus: subscription?.status,
        currentPeriodEnd: timestampToIso(subscription?.current_period_end),
        billingPeriod,
      });
      res.json({
        tier: paidTier,
        email: sessionEmail,
      });
    } catch (error) {
      console.error('Stripe checkout verification error:', error);
      res.status(500).json({ error: 'Failed to verify checkout session.' });
    }
  });
}
