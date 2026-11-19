import { Link } from 'react-router-dom'

// Loyce Dairies privacy information.
// Keep this notice aligned with deployed data processing,
// external service arrangements, and the account-erasure process.

const PRIVACY_EMAIL = 'agumekenneth7@gmail.com'

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-cream px-5 py-12 lg:px-8">
      <article className="mx-auto max-w-3xl rounded-3xl border border-brand/10 bg-white p-6 sm:p-10">
        <header>
          <p className="text-xs font-extrabold uppercase tracking-widest text-brand-light">
            LOYCE DAIRIES
          </p>
          <h1 className="mt-4 font-display text-4xl text-brand sm:text-5xl">
            Privacy Policy
          </h1>
          <p className="mt-4 text-sm text-brand/60">
            Last updated: 17 November 2026
          </p>
        </header>

        <div className="mt-10 space-y-9 text-sm leading-7 text-brand/75 sm:text-base">
          <section>
            <h2 className="text-xl font-bold text-brand">1. Introduction</h2>
            <p className="mt-3">
              Loyce Dairies provides a dairy-product ordering platform
              serving customers in Mbarara, Uganda. This policy describes
              how information is handled when you visit our website, use
              our mobile application, create an account, or place an order.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-brand">2. Information We Collect</h2>
            <ul className="mt-3 list-disc space-y-2 pl-6">
              <li>
                <strong>Account details:</strong> full name, email address,
                optional phone number and email-verification status.
                Passwords are stored as hashes rather than plain text.
              </li>
              <li>
                <strong>Order details:</strong> products, quantities, prices,
                payment method, payment status and order history.
              </li>
              <li>
                <strong>Fulfilment details:</strong> recipient name,
                contact phone number, delivery address, delivery zone
                and optional delivery instructions.
              </li>
              <li>
                <strong>Security details:</strong> authentication sessions,
                password-reset and email-verification records, and
                information used to protect the service against misuse.
              </li>
              <li>
                <strong>Staff notifications:</strong> Firebase device
                registration tokens and delivery records for authorized
                staff who enable new-order push alerts.
              </li>
              <li>
                <strong>Technical records:</strong> information processed
                by our application and infrastructure providers to operate,
                secure and troubleshoot the service.
              </li>
            </ul>
            <p className="mt-3">
              The currently implemented checkout supports cash on
              delivery and cash on pickup. Customers are not required
              to enter card details for these payment methods.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-brand">3. How We Use Information</h2>
            <p className="mt-3">
              We use information to register and authenticate accounts,
              verify email addresses, help customers recover access,
              process orders, coordinate pickup and delivery, calculate
              delivery fees, maintain order and inventory records, notify
              authorized staff of new orders, respond to inquiries, and
              protect and maintain the platform.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-brand">4. Sharing and Service Providers</h2>
            <p className="mt-3">
              Authorized Loyce Dairies staff may access information needed
              to manage orders. The platform uses Railway for application
              hosting, Resend for transactional email, and Firebase Cloud
              Messaging for opted-in staff push notifications. These
              providers may process information needed to deliver their
              services, potentially outside Uganda.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-brand">5. Security, Cookies and Storage</h2>
            <p className="mt-3">
              We use password hashing, authenticated sessions and access
              controls. The website uses an HTTP-only authentication
              cookie; native mobile apps store session tokens in protected
              device storage. Shopping-cart selections and some preferences
              may be stored locally on your device. Production API
              connections use HTTPS. No internet-based system can
              guarantee absolute security.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-brand">6. Retention and Account Deletion</h2>
            <p className="mt-3">
              We retain information as needed to operate accounts,
              fulfil orders, address disputes, maintain records and
              satisfy applicable obligations. Some transaction
              information may be retained after an account-deletion
              request for appropriate accounting, security or legal
              reasons. We do not state a fixed retention period here
              because the operational retention schedule is still
              under review.
            </p>
            <p className="mt-3">
              Customers may submit a request from the{' '}
              <Link
                to="/account-deletion"
                className="font-bold text-brand-light underline underline-offset-4"
              >
                account-deletion page
              </Link>
              . Requests require signing in and confirming the account
              password. Submitting a request records it for review
              and does not immediately delete the account. Unresolved
              orders may delay processing. Once a request is processed,
              eligible personal details may be erased while necessary
              order information is retained in a de-identified form.
            </p>
            <p className="mt-3">
              For assistance with a request or retained information,
              contact{' '}
              <a
                href={`mailto:${PRIVACY_EMAIL}`}
                className="font-bold text-brand-light underline underline-offset-4"
              >
                {PRIVACY_EMAIL}
              </a>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-brand">7. Your Privacy Choices</h2>
            <p className="mt-3">
              You may contact us to ask about access to, correction
              of, or deletion of personal information related to
              your account. We may need to verify your identity
              before disclosing or changing account information.
              Staff users can manage notification permissions
              through their device settings.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-brand">8. Changes and Contact</h2>
            <p className="mt-3">
              We may update this policy to reflect changes in
              the application, its service providers or applicable
              requirements. The latest version will appear here.
              For privacy questions, contact Loyce Dairies,
              Mbarara, Uganda, at{' '}
              <a
                href={`mailto:${PRIVACY_EMAIL}`}
                className="font-bold text-brand-light underline underline-offset-4"
              >
                {PRIVACY_EMAIL}
              </a>.
            </p>
          </section>
        </div>
      </article>
    </main>
  )
}
