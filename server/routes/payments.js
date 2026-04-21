import express from 'express';

export function registerPaymentRoutes(app, {
  stripe,
  stripeWebhookSecret,
  checkoutRateLimit,
  resolveTierFromPriceId,
  syncPurchasedTier,
  isAllowedRedirectUrl,
  normalizeEmail,
  timingSafeEmailMatches,
  sendCheckoutVerificationFailure,
}) {
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
      if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        let paidTier = resolveTierFromPriceId(session.metadata?.priceId);
        if (!paidTier) {
          const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 1 });
          const fallbackPriceId = lineItems.data[0]?.price?.id ?? '';
          paidTier = resolveTierFromPriceId(fallbackPriceId);
        }
        const customerEmail = typeof session.customer_details?.email === 'string'
          ? session.customer_details.email
          : typeof session.customer_email === 'string'
            ? session.customer_email
            : '';
        if (paidTier && session.payment_status === 'paid') {
          await syncPurchasedTier({
            tier: paidTier,
            email: customerEmail,
            sessionId: session.id,
          });
        }
      }

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

    if (!priceId || typeof priceId !== 'string' || !paidTier) {
      res.status(400).json({ error: 'Invalid or unsupported price ID.' });
      return;
    }

    if (!isAllowedRedirectUrl(successUrl) || !isAllowedRedirectUrl(cancelUrl)) {
      res.status(400).json({ error: 'successUrl and cancelUrl must use an approved application origin.' });
      return;
    }

    try {
      const session = await stripe.checkout.sessions.create({
        line_items: [{ price: priceId, quantity: 1 }],
        mode: 'payment',
        ...(typeof email === 'string' && email.trim()
          ? { customer_email: email.trim() }
          : {}),
        metadata: {
          priceId,
          paidTier,
          ...(normalizedEmail ? { emailLower: normalizedEmail } : {}),
        },
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

      await syncPurchasedTier({
        tier: paidTier,
        email: sessionEmail,
        sessionId,
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
