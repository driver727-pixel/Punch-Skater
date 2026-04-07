export function PrivacyPolicy() {
  const effectiveDate = "April 7, 2025";

  return (
    <div className="page credits-page">
      <h1 className="page-title">PRIVACY POLICY</h1>
      <p className="page-sub">Last updated: {effectiveDate}</p>

      <section className="credits-section">
        <h2 className="credits-heading">Overview</h2>
        <p className="legal-body">
          SP Digital LLC ("we", "us", or "our") operates the Punch Skater web application at{" "}
          <a href="https://punchskater.com" target="_blank" rel="noopener noreferrer" className="credits-link">
            punchskater.com
          </a>
          . This Privacy Policy describes how we collect, use, and protect information about you
          when you use our service.
        </p>
      </section>

      <section className="credits-section">
        <h2 className="credits-heading">Information We Collect</h2>
        <p className="legal-body">We collect the following information when you use Punch Skater:</p>
        <ul className="legal-list">
          <li>
            <strong>Account information</strong> — when you register, we collect your email address
            and a hashed password via Firebase Authentication. You may also sign in using your
            Google account, in which case we receive your Google email address and display name.
          </li>
          <li>
            <strong>User-generated content</strong> — cards, decks, and trade records you create
            are stored in our Firebase Firestore database linked to your user account.
          </li>
          <li>
            <strong>Payment information</strong> — payments are processed by Stripe. We do not
            store any credit card or banking details on our servers. Stripe's privacy policy
            applies to all payment data.
          </li>
          <li>
            <strong>Usage data</strong> — we may collect general analytics about how the app is
            used (e.g., page views). This data is not linked to individual identities.
          </li>
        </ul>
      </section>

      <section className="credits-section">
        <h2 className="credits-heading">How We Use Your Information</h2>
        <ul className="legal-list">
          <li>To operate, maintain, and improve the Punch Skater service.</li>
          <li>To associate your saved cards and decks with your account.</li>
          <li>To process payments and verify purchase status for paid tiers.</li>
          <li>To respond to support requests sent to our support email.</li>
          <li>To detect and prevent fraud or abuse.</li>
        </ul>
      </section>

      <section className="credits-section">
        <h2 className="credits-heading">Data Sharing</h2>
        <p className="legal-body">
          We do not sell, rent, or trade your personal information to third parties. We share data
          only with the following service providers as necessary to operate the service:
        </p>
        <ul className="legal-list">
          <li>
            <strong>Google Firebase</strong> — authentication and database storage.
          </li>
          <li>
            <strong>Stripe</strong> — payment processing.
          </li>
          <li>
            <strong>Fal.ai</strong> — AI image generation (prompts only, no personal data).
          </li>
        </ul>
      </section>

      <section className="credits-section">
        <h2 className="credits-heading">Data Retention</h2>
        <p className="legal-body">
          Your account and associated data are retained for as long as your account is active. You
          may request deletion of your account and data at any time by contacting us at the support
          email below.
        </p>
      </section>

      <section className="credits-section">
        <h2 className="credits-heading">Children's Privacy</h2>
        <p className="legal-body">
          Punch Skater is not directed to children under the age of 13. We do not knowingly collect
          personal information from children under 13. If you believe a child has provided us with
          personal information, please contact us and we will delete it.
        </p>
      </section>

      <section className="credits-section">
        <h2 className="credits-heading">Changes to This Policy</h2>
        <p className="legal-body">
          We may update this Privacy Policy from time to time. We will post the updated policy on
          this page with a new effective date. Continued use of the service after changes constitutes
          acceptance of the revised policy.
        </p>
      </section>

      <section className="credits-section">
        <h2 className="credits-heading">Contact</h2>
        <div className="credits-card">
          <p className="credits-desc">
            Questions or concerns about this Privacy Policy? Contact us:
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
