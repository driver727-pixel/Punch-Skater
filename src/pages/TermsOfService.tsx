export function TermsOfService() {
  const effectiveDate = "April 7, 2025";

  return (
    <div className="page credits-page">
      <h1 className="page-title">TERMS OF SERVICE</h1>
      <p className="page-sub">Last updated: {effectiveDate}</p>

      <section className="credits-section">
        <h2 className="credits-heading">Agreement</h2>
        <p className="legal-body">
          By accessing or using Punch Skater (operated by SP Digital LLC at{" "}
          <a href="https://punchskater.com" target="_blank" rel="noopener noreferrer" className="credits-link">
            punchskater.com
          </a>
          ), you agree to be bound by these Terms of Service. If you do not agree, do not use the
          service.
        </p>
      </section>

      <section className="credits-section">
        <h2 className="credits-heading">Use of Service</h2>
        <ul className="legal-list">
          <li>You must be at least 13 years old to create an account.</li>
          <li>You are responsible for maintaining the security of your account credentials.</li>
          <li>
            You may not use the service for any unlawful purpose or in a way that violates these
            Terms.
          </li>
          <li>
            You may not attempt to reverse-engineer, scrape, or abuse the service's APIs or
            infrastructure.
          </li>
          <li>
            All content you generate must comply with our content guidelines: no illegal content,
            hate speech, or material that violates third-party rights.
          </li>
        </ul>
      </section>

      <section className="credits-section">
        <h2 className="credits-heading">Paid Tiers</h2>
        <p className="legal-body">
          Punch Skater offers optional paid tiers (Street Creator and Deck Master) that unlock
          additional features. Payments are processed by Stripe and are subject to Stripe's terms.
          All purchases are final. See the Refund Policy section below.
        </p>
      </section>

      <section className="credits-section">
        <h2 className="credits-heading">Refund Policy</h2>
        <div className="credits-card">
          <p className="credits-desc">
            All purchases on Punch Skater are for <strong>digital goods and services</strong> and
            are <strong>non-refundable</strong> once payment is completed and access is granted,
            except where required by applicable law.
          </p>
          <p className="credits-desc" style={{ marginTop: "8px" }}>
            If you believe you were charged in error, contact us within 14 days of the transaction
            at the support address below and we will review your case.
          </p>
        </div>
      </section>

      <section className="credits-section">
        <h2 className="credits-heading">Intellectual Property</h2>
        <p className="legal-body">
          "Punch Skater", the game, card mechanics, artwork concepts, and all associated
          intellectual property are owned exclusively by SP Digital LLC. You may not reproduce,
          distribute, or create derivative works without written permission.
        </p>
        <p className="legal-body" style={{ marginTop: "8px" }}>
          User-generated card content (names, descriptions) remains yours, but by using the
          service you grant SP Digital LLC a non-exclusive license to store and display that
          content as part of operating the service.
        </p>
      </section>

      <section className="credits-section">
        <h2 className="credits-heading">Disclaimer of Warranties</h2>
        <p className="legal-body">
          The service is provided "as is" without warranties of any kind, express or implied.
          SP Digital LLC does not warrant that the service will be uninterrupted, error-free, or
          free of harmful components.
        </p>
      </section>

      <section className="credits-section">
        <h2 className="credits-heading">Limitation of Liability</h2>
        <p className="legal-body">
          To the maximum extent permitted by law, SP Digital LLC shall not be liable for any
          indirect, incidental, special, consequential, or punitive damages arising from your use
          of the service.
        </p>
      </section>

      <section className="credits-section">
        <h2 className="credits-heading">Governing Law</h2>
        <p className="legal-body">
          These Terms are governed by the laws of the United States. Any disputes shall be
          resolved in the applicable jurisdiction.
        </p>
      </section>

      <section className="credits-section">
        <h2 className="credits-heading">Changes to These Terms</h2>
        <p className="legal-body">
          We may update these Terms from time to time. We will post the updated Terms on this page
          with a new effective date. Continued use of the service constitutes acceptance.
        </p>
      </section>

      <section className="credits-section">
        <h2 className="credits-heading">Contact &amp; Support</h2>
        <div className="credits-card">
          <p className="credits-desc">
            Questions about these Terms, refund requests, or general support:
          </p>
          <a href="mailto:driver727@gmail.com" className="credits-link">
            driver727@gmail.com
          </a>
          <p className="credits-desc">SP Digital LLC</p>
        </div>
      </section>
    </div>
  );
}
